package com.collabboard.service;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.ShapeDto;
import com.collabboard.model.Room;
import com.collabboard.repository.RoomRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class RoomService {

    private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

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
        } while (roomRepository.findByRoomCode(code).isPresent());

        Room room = Room.builder()
                .roomCode(code)
                .boardName("Untitled Board")
                .boardSnapshot("[]")
                .build();

        return roomRepository.save(room);
    }

    public Room save(Room room) {
        return roomRepository.save(room);
    }

    public Room getRoom(String roomCode) {
        if (roomCode == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room code is required");
        }
        return roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Room not found: " + roomCode));
    }

    @Transactional
    public Room updateBoardName(String roomCode, String boardName) {
        Room room = getRoom(roomCode);
        String name = (boardName == null || boardName.isBlank()) ? "Untitled Board" : boardName.trim();
        if (name.length() > 100) {
            name = name.substring(0, 100);
        }
        room.setBoardName(name);
        room.setLastActivityAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    @Transactional
    public Room clearBoard(String roomCode) {
        Room room = getRoom(roomCode);
        room.setBoardSnapshot("[]");
        room.setLastActivityAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    /**
     * Apply a board-altering draw event to the persisted snapshot. Synchronized
     * per call via @Transactional plus a method-level lock on the room code to
     * avoid lost updates from concurrent draw events.
     */
    @Transactional
    public synchronized Room updateSnapshot(String roomCode, DrawEventDto event) {
        Room room = getRoom(roomCode);
        if (event == null || event.getType() == null) {
            return room;
        }

        String type = event.getType();
        List<Map<String, Object>> shapes = parseSnapshot(room.getBoardSnapshot());

        switch (type) {
            case "clear" -> shapes = new ArrayList<>();
            case "replace", "undo", "redo" -> {
                if (event.getShapes() != null) {
                    shapes = shapesToMaps(event.getShapes());
                }
            }
            case "draw", "erase" -> {
                if (event.getShape() != null) {
                    shapes.add(shapeToMap(event.getShape(), event.getUserId()));
                }
            }
            case "update" -> {
                ShapeDto shape = event.getShape();
                if (shape != null && shape.getId() != null) {
                    Map<String, Object> updated = shapeToMap(shape, event.getUserId());
                    boolean replaced = false;
                    for (int i = 0; i < shapes.size(); i++) {
                        if (shape.getId().equals(shapes.get(i).get("id"))) {
                            shapes.set(i, updated);
                            replaced = true;
                            break;
                        }
                    }
                    if (!replaced) {
                        shapes.add(updated);
                    }
                }
            }
            case "delete" -> {
                Set<String> ids = new HashSet<>();
                if (event.getShapeId() != null) {
                    ids.add(event.getShapeId());
                }
                if (event.getShapeIds() != null) {
                    ids.addAll(event.getShapeIds());
                }
                if (!ids.isEmpty()) {
                    shapes.removeIf(s -> ids.contains(String.valueOf(s.get("id"))));
                }
            }
            default -> {
                // cursor / laser / join / leave are ephemeral; nothing persisted.
                return room;
            }
        }

        room.setBoardSnapshot(serializeSnapshot(shapes));
        room.setLastActivityAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    public long countRooms() {
        return roomRepository.count();
    }

    private Map<String, Object> shapeToMap(ShapeDto shape, String userId) {
        @SuppressWarnings("unchecked")
        Map<String, Object> map = objectMapper.convertValue(shape, Map.class);
        if (map.get("userId") == null && userId != null) {
            map.put("userId", userId);
        }
        return map;
    }

    private List<Map<String, Object>> shapesToMaps(List<ShapeDto> shapes) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (ShapeDto shape : shapes) {
            if (shape != null) {
                result.add(shapeToMap(shape, shape.getUserId()));
            }
        }
        return result;
    }

    private List<Map<String, Object>> parseSnapshot(String snapshot) {
        if (snapshot == null || snapshot.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<Map<String, Object>> parsed =
                    objectMapper.readValue(snapshot, new TypeReference<List<Map<String, Object>>>() {});
            return parsed != null ? parsed : new ArrayList<>();
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String serializeSnapshot(List<Map<String, Object>> shapes) {
        try {
            return objectMapper.writeValueAsString(shapes);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        }
        return sb.toString();
    }
}
