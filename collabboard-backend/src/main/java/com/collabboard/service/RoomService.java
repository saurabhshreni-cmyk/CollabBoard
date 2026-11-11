package com.collabboard.service;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.ShapeDto;
import com.collabboard.exception.BoardEventRejectedException;
import com.collabboard.model.Room;
import com.collabboard.repository.RoomRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class RoomService {

    public static final String DEFAULT_BOARD_NAME = "Untitled Board";

    /** Upper bound on the stored JSON, so one board cannot exhaust the database. */
    static final int MAX_SNAPSHOT_CHARS = 4_000_000;

    private static final Logger log = LoggerFactory.getLogger(RoomService.class);
    private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int CODE_LENGTH = 6;
    private static final Pattern CODE_PATTERN = Pattern.compile("[A-Z0-9]{4,10}");
    private static final int MAX_BOARD_NAME_LENGTH = 100;
    private static final String EMPTY_SNAPSHOT = "[]";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final TypeReference<List<ShapeDto>> SHAPE_LIST = new TypeReference<>() {};

    private final RoomRepository roomRepository;
    private final ObjectMapper objectMapper;

    public RoomService(RoomRepository roomRepository, ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.objectMapper = objectMapper;
    }

    public Room createRoom() {
        String code;
        do {
            code = generateCode();
        } while (roomRepository.existsByRoomCode(code));

        Room room = Room.builder()
                .roomCode(code)
                .boardName(DEFAULT_BOARD_NAME)
                .boardSnapshot(EMPTY_SNAPSHOT)
                .build();

        return roomRepository.save(room);
    }

    public Room getRoom(String roomCode) {
        String code = normalizeCode(roomCode);
        return roomRepository.findByRoomCode(code).orElseThrow(() -> notFound(code));
    }

    @Transactional
    public Room updateBoardName(String roomCode, String boardName) {
        Room room = lockRoom(roomCode);
        room.setBoardName(normalizeBoardName(boardName));
        room.setLastActivityAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    @Transactional
    public Room clearBoard(String roomCode) {
        Room room = lockRoom(roomCode);
        room.setBoardSnapshot(EMPTY_SNAPSHOT);
        room.setLastActivityAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    /**
     * Applies a board-altering event to the persisted snapshot.
     * <p>
     * The room row is locked for the duration of the transaction, so
     * concurrent events on the same board are applied one after another
     * instead of overwriting each other's read-modify-write.
     *
     * @param event an event that has already been through {@link BoardEventSanitizer}
     * @throws BoardEventRejectedException if applying it would exceed the board limits
     */
    @Transactional
    public Room updateSnapshot(String roomCode, DrawEventDto event) {
        Room room = lockRoom(roomCode);
        if (event == null || event.getType() == null) {
            return room;
        }

        if ("rename".equals(event.getType())) {
            // Board metadata only: the shape snapshot is untouched.
            room.setBoardName(normalizeBoardName(event.getBoardName()));
            room.setLastActivityAt(LocalDateTime.now());
            return roomRepository.save(room);
        }

        List<ShapeDto> current = parseSnapshot(room);
        List<ShapeDto> next = switch (event.getType()) {
            case "clear" -> List.of();
            case "replace" -> event.getShapes() != null ? event.getShapes() : current;
            case "draw" -> put(current, event.getShape(), event.getUserId(), true);
            // Only "draw" creates a shape. An update for one that is gone
            // (deleted while someone else was still editing it) must not
            // bring it back.
            case "update" -> put(current, event.getShape(), event.getUserId(), false);
            case "delete" -> remove(current, event);
            default -> null; // ephemeral types never reach the database
        };
        if (next == null) {
            return room;
        }

        room.setBoardSnapshot(serializeSnapshot(next));
        room.setLastActivityAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    public long countRooms() {
        return roomRepository.count();
    }

    /**
     * Trims, defaults and truncates a user-supplied board name so REST and
     * WebSocket renames always agree on the stored value.
     */
    static String normalizeBoardName(String boardName) {
        if (boardName == null || boardName.isBlank()) {
            return DEFAULT_BOARD_NAME;
        }
        String name = boardName.trim();
        return name.length() > MAX_BOARD_NAME_LENGTH ? name.substring(0, MAX_BOARD_NAME_LENGTH) : name;
    }

    /** Room codes are case-insensitive for people, upper-case in storage. */
    static String normalizeCode(String roomCode) {
        if (roomCode == null || roomCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room code is required");
        }
        String code = roomCode.trim().toUpperCase(Locale.ROOT);
        if (!CODE_PATTERN.matcher(code).matches()) {
            // Never echo unvalidated input back to the caller.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found");
        }
        return code;
    }

    private Room lockRoom(String roomCode) {
        String code = normalizeCode(roomCode);
        return roomRepository.findByRoomCodeForUpdate(code).orElseThrow(() -> notFound(code));
    }

    private static ResponseStatusException notFound(String code) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found: " + code);
    }

    /**
     * Replaces the existing shape with the same id in place. If there is none,
     * the shape is appended when {@code addIfMissing} is set and ignored otherwise.
     */
    private List<ShapeDto> put(List<ShapeDto> current, ShapeDto shape, String eventUserId, boolean addIfMissing) {
        if (shape == null || shape.getId() == null) {
            return current;
        }
        ShapeDto owned = shape.getUserId() == null && eventUserId != null
                ? shape.toBuilder().userId(eventUserId).build()
                : shape;

        List<ShapeDto> next = new ArrayList<>(current.size() + 1);
        boolean replaced = false;
        for (ShapeDto existing : current) {
            if (!replaced && owned.getId().equals(existing.getId())) {
                next.add(owned);
                replaced = true;
            } else {
                next.add(existing);
            }
        }
        if (!replaced) {
            if (!addIfMissing) {
                return current;
            }
            if (current.size() >= BoardEventSanitizer.MAX_SHAPES_PER_BOARD) {
                throw new BoardEventRejectedException(
                        "This board is full (" + BoardEventSanitizer.MAX_SHAPES_PER_BOARD + " items). Delete something first.");
            }
            next.add(owned);
        }
        return next;
    }

    private List<ShapeDto> remove(List<ShapeDto> current, DrawEventDto event) {
        Set<String> ids = new HashSet<>();
        if (event.getShapeId() != null) {
            ids.add(event.getShapeId());
        }
        if (event.getShapeIds() != null) {
            ids.addAll(event.getShapeIds());
        }
        if (ids.isEmpty()) {
            return current;
        }
        return current.stream().filter(s -> !ids.contains(s.getId())).toList();
    }

    private List<ShapeDto> parseSnapshot(Room room) {
        String snapshot = room.getBoardSnapshot();
        if (snapshot == null || snapshot.isBlank()) {
            return List.of();
        }
        try {
            List<ShapeDto> parsed = objectMapper.readValue(snapshot, SHAPE_LIST);
            return parsed != null ? parsed : List.of();
        } catch (JsonProcessingException e) {
            // Only this service writes snapshots, so this should be impossible.
            // Starting over keeps the board usable rather than bricking it.
            log.error("Room {} has an unreadable snapshot; treating it as empty", room.getRoomCode(), e);
            return List.of();
        }
    }

    private String serializeSnapshot(List<ShapeDto> shapes) {
        String json;
        try {
            json = objectMapper.writeValueAsString(shapes);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise board snapshot", e);
        }
        if (json.length() > MAX_SNAPSHOT_CHARS) {
            throw new BoardEventRejectedException("This board is too large to save. Delete something first.");
        }
        return json;
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        }
        return sb.toString();
    }
}
