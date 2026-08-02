package com.collabboard.controller;

import com.collabboard.dto.RoomResponseDto;
import com.collabboard.dto.UserPresenceDto;
import com.collabboard.model.Room;
import com.collabboard.service.PresenceService;
import com.collabboard.service.RoomService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final PresenceService presenceService;

    public RoomController(RoomService roomService, PresenceService presenceService) {
        this.roomService = roomService;
        this.presenceService = presenceService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponseDto createRoom() {
        return toDto(roomService.createRoom());
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<RoomResponseDto> getRoom(@PathVariable String roomCode) {
        return ResponseEntity.ok(toDto(roomService.getRoom(roomCode)));
    }

    @PutMapping("/{roomCode}/name")
    public ResponseEntity<RoomResponseDto> updateName(
            @PathVariable String roomCode,
            @RequestBody(required = false) Map<String, String> body) {
        String boardName = body != null ? body.get("boardName") : null;
        return ResponseEntity.ok(toDto(roomService.updateBoardName(roomCode, boardName)));
    }

    @DeleteMapping("/{roomCode}/clear")
    public ResponseEntity<RoomResponseDto> clearRoom(@PathVariable String roomCode) {
        return ResponseEntity.ok(toDto(roomService.clearBoard(roomCode)));
    }

    @GetMapping("/{roomCode}/users")
    public List<UserPresenceDto> getUsers(@PathVariable String roomCode) {
        return presenceService.getUsers(roomCode);
    }

    private RoomResponseDto toDto(Room room) {
        return new RoomResponseDto(
                room.getId(),
                room.getRoomCode(),
                room.getBoardName(),
                room.getBoardSnapshot(),
                room.getCreatedAt(),
                room.getLastUpdatedAt()
        );
    }
}
