package com.collabboard.service;

import com.collabboard.dto.UserPresenceDto;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Tracks who is connected to which room and broadcasts the roster whenever it
 * changes.
 * <p>
 * Presence is tracked per WebSocket <em>session</em>, not per user: one person
 * with the board open in two tabs holds two sessions and stays online until
 * the last one closes. The roster shown to clients lists each user once.
 * Structures are concurrent because STOMP events arrive on multiple threads.
 */
@Service
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;
    private final AtomicLong joinSequence = new AtomicLong();

    // sessionId -> where that connection is and who it belongs to
    private final Map<String, Connection> connections = new ConcurrentHashMap<>();

    public PresenceService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void join(String sessionId, String roomCode, UserPresenceDto user) {
        if (sessionId == null || roomCode == null || user == null || user.getUserId() == null) {
            return;
        }
        Connection previous = connections.put(
                sessionId, new Connection(roomCode, user, joinSequence.incrementAndGet()));
        if (previous != null && !previous.roomCode().equals(roomCode)) {
            broadcast(previous.roomCode());
        }
        broadcast(roomCode);
    }

    /** Removes one connection; called on an explicit leave and on disconnect. */
    public void leave(String sessionId) {
        if (sessionId == null) {
            return;
        }
        Connection removed = connections.remove(sessionId);
        if (removed != null) {
            broadcast(removed.roomCode());
        }
    }

    /** @return each user currently in the room once, in the order they joined. */
    public List<UserPresenceDto> getUsers(String roomCode) {
        Map<String, UserPresenceDto> byUserId = new LinkedHashMap<>();
        connections.values().stream()
                .filter(c -> c.roomCode().equals(roomCode))
                .sorted(Comparator.comparingLong(Connection::sequence))
                .forEach(c -> byUserId.putIfAbsent(c.user().getUserId(), c.user()));
        return List.copyOf(byUserId.values());
    }

    private void broadcast(String roomCode) {
        messagingTemplate.convertAndSend(
                "/topic/room/" + roomCode + "/presence", getUsers(roomCode));
    }

    private record Connection(String roomCode, UserPresenceDto user, long sequence) {
    }
}
