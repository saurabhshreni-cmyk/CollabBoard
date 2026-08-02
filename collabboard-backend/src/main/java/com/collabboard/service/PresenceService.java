package com.collabboard.service;

import com.collabboard.dto.UserPresenceDto;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks which users are currently connected to which rooms and broadcasts
 * the roster whenever it changes. Keyed structures are concurrent because
 * STOMP events arrive on multiple threads.
 */
@Service
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;

    // roomCode -> (userId -> presence)
    private final Map<String, Map<String, UserPresenceDto>> roomUsers = new ConcurrentHashMap<>();
    // sessionId -> SessionInfo (for disconnect cleanup)
    private final Map<String, SessionInfo> sessions = new ConcurrentHashMap<>();

    public PresenceService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void join(String sessionId, String roomCode, UserPresenceDto user) {
        if (roomCode == null || user == null || user.getUserId() == null) {
            return;
        }
        roomUsers
                .computeIfAbsent(roomCode, k -> new ConcurrentHashMap<>())
                .put(user.getUserId(), user);

        if (sessionId != null) {
            sessions.put(sessionId, new SessionInfo(roomCode, user.getUserId()));
        }
        broadcast(roomCode);
    }

    public void leave(String roomCode, String userId) {
        if (roomCode == null || userId == null) {
            return;
        }
        Map<String, UserPresenceDto> users = roomUsers.get(roomCode);
        if (users != null) {
            users.remove(userId);
            if (users.isEmpty()) {
                roomUsers.remove(roomCode);
            }
        }
        broadcast(roomCode);
    }

    public void disconnect(String sessionId) {
        if (sessionId == null) {
            return;
        }
        SessionInfo info = sessions.remove(sessionId);
        if (info != null) {
            leave(info.roomCode(), info.userId());
        }
    }

    public List<UserPresenceDto> getUsers(String roomCode) {
        Map<String, UserPresenceDto> users = roomUsers.get(roomCode);
        if (users == null) {
            return new ArrayList<>();
        }
        return new ArrayList<>(users.values());
    }

    private void broadcast(String roomCode) {
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/presence", getUsers(roomCode));
    }

    public record SessionInfo(String roomCode, String userId) {
    }
}
