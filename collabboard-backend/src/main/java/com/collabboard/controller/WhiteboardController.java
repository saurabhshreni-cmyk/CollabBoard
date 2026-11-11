package com.collabboard.controller;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.UserPresenceDto;
import com.collabboard.exception.BoardEventRejectedException;
import com.collabboard.model.Room;
import com.collabboard.service.BoardEventSanitizer;
import com.collabboard.service.PresenceService;
import com.collabboard.service.RoomService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

@Controller
public class WhiteboardController {

    private static final Logger log = LoggerFactory.getLogger(WhiteboardController.class);

    private final RoomService roomService;
    private final PresenceService presenceService;
    private final BoardEventSanitizer sanitizer;

    public WhiteboardController(RoomService roomService,
                                PresenceService presenceService,
                                BoardEventSanitizer sanitizer) {
        this.roomService = roomService;
        this.presenceService = presenceService;
        this.sanitizer = sanitizer;
    }

    /**
     * Receives one board event, persists it if it alters the board, and
     * returns what should be broadcast to the room. Returning {@code null}
     * broadcasts nothing, which is how malformed input is dropped.
     */
    @MessageMapping("/room/{roomCode}/draw")
    @SendTo("/topic/room/{roomCode}")
    public DrawEventDto receiveDrawEvent(@DestinationVariable String roomCode, DrawEventDto event) {
        Optional<DrawEventDto> sanitized = sanitizer.sanitize(event);
        if (sanitized.isEmpty()) {
            return null;
        }
        DrawEventDto clean = sanitized.get();
        if (!sanitizer.isBoardAltering(clean.getType())) {
            // cursor / laser / sync are simply relayed to all subscribers.
            return clean;
        }

        try {
            Room room = roomService.updateSnapshot(roomCode, clean);
            if ("rename".equals(clean.getType())) {
                // Echo back the normalised (trimmed / defaulted / truncated) name
                // so every client shows exactly what was persisted.
                return clean.toBuilder().boardName(room.getBoardName()).build();
            }
            return clean;
        } catch (BoardEventRejectedException e) {
            return rejected(clean, e.getMessage());
        } catch (ResponseStatusException e) {
            return rejected(clean, "This board no longer exists.");
        } catch (RuntimeException e) {
            log.error("Failed to apply {} event to room {}", clean.getType(), roomCode, e);
            return rejected(clean, "The server could not save that change.");
        }
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
            String userId = sanitizer.id(event.getUserId());
            if (userId == null) {
                return;
            }
            UserPresenceDto user = new UserPresenceDto(
                    userId,
                    sanitizer.displayName(event.getUserName()),
                    sanitizer.style(event.getUserColor()));
            presenceService.join(sessionId, roomCode, user);
        } else if ("leave".equals(event.getType())) {
            // A connection can only remove itself, never someone else.
            presenceService.leave(sessionId);
        }
    }

    /**
     * Tells the sender (matched by clientId) that its change was not saved, so
     * it can show the reason and reload the authoritative board.
     */
    private DrawEventDto rejected(DrawEventDto event, String reason) {
        return DrawEventDto.builder()
                .type("rejected")
                .clientId(event.getClientId())
                .userId(event.getUserId())
                .reason(reason)
                .build();
    }
}
