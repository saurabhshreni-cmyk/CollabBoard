package com.collabboard.config;

import com.collabboard.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Cleans up presence when a STOMP session disconnects (browser closed, network
 * drop, etc.). The corresponding "join" is handled via a message mapping so we
 * receive the user's identity payload.
 */
@Component
public class WebSocketEventListener {

    private final PresenceService presenceService;

    public WebSocketEventListener(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        presenceService.leave(event.getSessionId());
    }
}
