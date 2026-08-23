package com.collabboard.controller;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.UserPresenceDto;
import com.collabboard.model.Room;
import com.collabboard.service.PresenceService;
import com.collabboard.service.RoomService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.util.Set;

@Controller
public class WhiteboardController {

    private static final Set<String> PERSISTED_TYPES = Set.of(
            "draw", "erase", "update", "delete", "replace", "clear", "undo", "redo", "rename");

    private final RoomService roomService;
    private final PresenceService presenceService;

    public WhiteboardController(RoomService roomService, PresenceService presenceService) {
        this.roomService = roomService;
        this.presenceService = presenceService;
    }

    @MessageMapping("/room/{roomCode}/draw")
    @SendTo("/topic/room/{roomCode}")
    public DrawEventDto receiveDrawEvent(@DestinationVariable String roomCode, DrawEventDto event) {
        if (event != null && event.getType() != null && PERSISTED_TYPES.contains(event.getType())) {
            Room room = roomService.updateSnapshot(roomCode, event);
            if ("rename".equals(event.getType())) {
                // Echo back the normalised (trimmed / defaulted / truncated) name
                // so every client shows exactly what was persisted.
                event.setBoardName(room.getBoardName());
            }
        }
        // cursor / laser are simply relayed to all subscribers.
        return event;
    }

    @MessageMapping("/room/{roomCode}/presence")
    public void handlePresence(
            @DestinationVariable String roomCode,
            DrawEventDto event,
            SimpMessageHeaderAccessor headerAccessor) {
        if (event == null) {
            return;
        }
        String sessionId = headerAccessor.getSessionId();
        if ("join".equals(event.getType())) {
            UserPresenceDto user = new UserPresenceDto(
                    event.getUserId(), event.getUserName(), event.getUserColor());
            presenceService.join(sessionId, roomCode, user);
        } else if ("leave".equals(event.getType())) {
            presenceService.leave(roomCode, event.getUserId());
        }
    }
}
