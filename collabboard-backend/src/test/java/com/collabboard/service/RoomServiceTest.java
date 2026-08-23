package com.collabboard.service;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.ShapeDto;
import com.collabboard.model.Room;
import com.collabboard.repository.RoomRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
class RoomServiceTest {

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void clean() {
        roomRepository.deleteAll();
    }

    // ---------- room creation ----------

    @Test
    void createRoomGeneratesSixCharacterCodeAndDefaults() {
        Room room = roomService.createRoom();

        assertThat(room.getId()).isNotNull();
        assertThat(room.getRoomCode()).hasSize(6).matches("[A-Z0-9]{6}");
        assertThat(room.getBoardName()).isEqualTo("Untitled Board");
        assertThat(room.getBoardSnapshot()).isEqualTo("[]");
        assertThat(room.getCreatedAt()).isNotNull();
        assertThat(room.getLastActivityAt()).isNotNull();
    }

    @Test
    void createRoomProducesUniqueCodes() {
        Set<String> codes = new HashSet<>();
        for (int i = 0; i < 25; i++) {
            codes.add(roomService.createRoom().getRoomCode());
        }
        assertThat(codes).hasSize(25);
    }

    // ---------- lookup ----------

    @Test
    void getRoomReturnsPersistedRoom() {
        String code = roomService.createRoom().getRoomCode();
        assertThat(roomService.getRoom(code).getRoomCode()).isEqualTo(code);
    }

    @Test
    void getRoomThrowsNotFoundForUnknownCode() {
        ResponseStatusException ex =
                assertThrows(ResponseStatusException.class, () -> roomService.getRoom("NOPE00"));
        assertThat(ex.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void getRoomThrowsBadRequestForNullCode() {
        ResponseStatusException ex =
                assertThrows(ResponseStatusException.class, () -> roomService.getRoom(null));
        assertThat(ex.getStatusCode().value()).isEqualTo(400);
    }

    // ---------- board name ----------

    @Test
    void updateBoardNameTrimsAndFallsBackToDefault() {
        String code = roomService.createRoom().getRoomCode();

        assertThat(roomService.updateBoardName(code, "  Sprint Retro  ").getBoardName())
                .isEqualTo("Sprint Retro");
        assertThat(roomService.updateBoardName(code, "   ").getBoardName())
                .isEqualTo("Untitled Board");
        assertThat(roomService.updateBoardName(code, null).getBoardName())
                .isEqualTo("Untitled Board");
    }

    @Test
    void updateBoardNameTruncatesAtHundredCharacters() {
        String code = roomService.createRoom().getRoomCode();
        String longName = "x".repeat(150);

        assertThat(roomService.updateBoardName(code, longName).getBoardName()).hasSize(100);
    }

    @Test
    void renameEventPersistsTheNameAndLeavesTheSnapshotAlone() {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateSnapshot(code, drawEvent("s1", "pen"));

        DrawEventDto rename = new DrawEventDto();
        rename.setType("rename");
        rename.setUserId("u1");
        rename.setBoardName("  Sprint Retro  ");

        Room room = roomService.updateSnapshot(code, rename);

        assertThat(room.getBoardName()).isEqualTo("Sprint Retro");
        assertThat(parse(room.getBoardSnapshot())).hasSize(1);
        assertThat(roomService.getRoom(code).getBoardName()).isEqualTo("Sprint Retro");
    }

    @Test
    void renameEventWithoutANameFallsBackToTheDefault() {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateBoardName(code, "Something");

        DrawEventDto rename = new DrawEventDto();
        rename.setType("rename");

        assertThat(roomService.updateSnapshot(code, rename).getBoardName()).isEqualTo("Untitled Board");
    }

    // ---------- snapshot mutations ----------

    @Test
    void drawEventAppendsShapeToSnapshot() {
        String code = roomService.createRoom().getRoomCode();

        Room room = roomService.updateSnapshot(code, drawEvent("s1", "rectangle"));

        List<Map<String, Object>> shapes = parse(room.getBoardSnapshot());
        assertThat(shapes).hasSize(1);
        assertThat(shapes.get(0)).containsEntry("id", "s1").containsEntry("tool", "rectangle");
        assertThat(shapes.get(0)).containsEntry("userId", "u1");
    }

    @Test
    void updateEventReplacesMatchingShapeInPlace() {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateSnapshot(code, drawEvent("s1", "rectangle"));
        roomService.updateSnapshot(code, drawEvent("s2", "circle"));

        DrawEventDto update = new DrawEventDto();
        update.setType("update");
        update.setUserId("u2");
        ShapeDto moved = shape("s1", "rectangle");
        moved.setX(999.0);
        update.setShape(moved);

        Room room = roomService.updateSnapshot(code, update);

        List<Map<String, Object>> shapes = parse(room.getBoardSnapshot());
        assertThat(shapes).hasSize(2);
        assertThat(shapes.get(0)).containsEntry("id", "s1");
        assertThat(((Number) shapes.get(0).get("x")).doubleValue()).isEqualTo(999.0);
        assertThat(shapes.get(1)).containsEntry("id", "s2");
    }

    @Test
    void updateEventAppendsWhenShapeIsUnknown() {
        String code = roomService.createRoom().getRoomCode();

        DrawEventDto update = new DrawEventDto();
        update.setType("update");
        update.setShape(shape("ghost", "text"));

        Room room = roomService.updateSnapshot(code, update);

        assertThat(parse(room.getBoardSnapshot())).hasSize(1);
    }

    @Test
    void deleteEventRemovesShapesById() {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateSnapshot(code, drawEvent("s1", "pen"));
        roomService.updateSnapshot(code, drawEvent("s2", "pen"));
        roomService.updateSnapshot(code, drawEvent("s3", "pen"));

        DrawEventDto delete = new DrawEventDto();
        delete.setType("delete");
        delete.setShapeIds(List.of("s1", "s3"));

        Room room = roomService.updateSnapshot(code, delete);

        List<Map<String, Object>> shapes = parse(room.getBoardSnapshot());
        assertThat(shapes).hasSize(1);
        assertThat(shapes.get(0)).containsEntry("id", "s2");
    }

    @Test
    void replaceEventSwapsTheWholeBoard() {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateSnapshot(code, drawEvent("s1", "pen"));

        DrawEventDto replace = new DrawEventDto();
        replace.setType("replace");
        List<ShapeDto> next = new ArrayList<>();
        next.add(shape("a", "circle"));
        next.add(shape("b", "diamond"));
        replace.setShapes(next);

        Room room = roomService.updateSnapshot(code, replace);

        List<Map<String, Object>> shapes = parse(room.getBoardSnapshot());
        assertThat(shapes).extracting(s -> s.get("id")).containsExactly("a", "b");
    }

    @Test
    void clearEventEmptiesTheBoard() {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateSnapshot(code, drawEvent("s1", "pen"));

        DrawEventDto clear = new DrawEventDto();
        clear.setType("clear");

        assertThat(parse(roomService.updateSnapshot(code, clear).getBoardSnapshot())).isEmpty();
    }

    @Test
    void ephemeralEventsDoNotTouchTheSnapshot() {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateSnapshot(code, drawEvent("s1", "pen"));

        DrawEventDto cursor = new DrawEventDto();
        cursor.setType("cursor");
        cursor.setCursorX(10.0);
        cursor.setCursorY(20.0);

        Room room = roomService.updateSnapshot(code, cursor);

        assertThat(parse(room.getBoardSnapshot())).hasSize(1);
    }

    @Test
    void clearBoardResetsSnapshotAndBumpsActivity() {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateSnapshot(code, drawEvent("s1", "pen"));

        Room room = roomService.clearBoard(code);

        assertThat(room.getBoardSnapshot()).isEqualTo("[]");
        assertThat(room.getLastActivityAt()).isNotNull();
    }

    @Test
    void corruptSnapshotIsTreatedAsEmptyRatherThanFailing() {
        Room room = roomService.createRoom();
        room.setBoardSnapshot("not json at all");
        roomRepository.save(room);

        Room updated = roomService.updateSnapshot(room.getRoomCode(), drawEvent("s1", "pen"));

        assertThat(parse(updated.getBoardSnapshot())).hasSize(1);
    }

    @Test
    void countRoomsReflectsPersistedRooms() {
        roomService.createRoom();
        roomService.createRoom();
        assertThat(roomService.countRooms()).isEqualTo(2);
    }

    // ---------- helpers ----------

    private DrawEventDto drawEvent(String shapeId, String tool) {
        DrawEventDto event = new DrawEventDto();
        event.setType("draw");
        event.setUserId("u1");
        event.setShape(shape(shapeId, tool));
        return event;
    }

    private ShapeDto shape(String id, String tool) {
        ShapeDto shape = new ShapeDto();
        shape.setId(id);
        shape.setTool(tool);
        shape.setX(10.0);
        shape.setY(20.0);
        shape.setWidth(100.0);
        shape.setHeight(50.0);
        shape.setColor("#FF6B6B");
        shape.setStrokeWidth(4.0);
        return shape;
    }

    private List<Map<String, Object>> parse(String snapshot) {
        try {
            return objectMapper.readValue(snapshot, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Snapshot was not valid JSON: " + snapshot, e);
        }
    }
}
