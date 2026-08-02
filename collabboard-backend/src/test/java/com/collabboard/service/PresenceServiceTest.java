package com.collabboard.service;

import com.collabboard.dto.UserPresenceDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class PresenceServiceTest {

    private SimpMessagingTemplate messagingTemplate;
    private PresenceService presenceService;

    @BeforeEach
    void setUp() {
        messagingTemplate = mock(SimpMessagingTemplate.class);
        presenceService = new PresenceService(messagingTemplate);
    }

    @Test
    void joinAddsUserAndBroadcastsRoster() {
        presenceService.join("sess-1", "ROOM01", user("u1", "BlueFox12"));

        assertThat(presenceService.getUsers("ROOM01"))
                .extracting(UserPresenceDto::getUserId)
                .containsExactly("u1");
        verify(messagingTemplate, atLeastOnce())
                .convertAndSend(eq("/topic/room/ROOM01/presence"), any(Object.class));
    }

    @Test
    void joinIsIdempotentPerUserId() {
        presenceService.join("sess-1", "ROOM01", user("u1", "BlueFox12"));
        presenceService.join("sess-2", "ROOM01", user("u1", "BlueFox12"));

        assertThat(presenceService.getUsers("ROOM01")).hasSize(1);
    }

    @Test
    void roomsAreIsolatedFromEachOther() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));
        presenceService.join("s2", "ROOM02", user("u2", "B"));

        assertThat(presenceService.getUsers("ROOM01")).hasSize(1);
        assertThat(presenceService.getUsers("ROOM02")).hasSize(1);
    }

    @Test
    void leaveRemovesUser() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));
        presenceService.join("s2", "ROOM01", user("u2", "B"));

        presenceService.leave("ROOM01", "u1");

        assertThat(presenceService.getUsers("ROOM01"))
                .extracting(UserPresenceDto::getUserId)
                .containsExactly("u2");
    }

    @Test
    void disconnectRemovesTheUserBoundToThatSession() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));

        presenceService.disconnect("s1");

        assertThat(presenceService.getUsers("ROOM01")).isEmpty();
    }

    @Test
    void disconnectOfUnknownSessionIsANoOp() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));

        presenceService.disconnect("does-not-exist");

        assertThat(presenceService.getUsers("ROOM01")).hasSize(1);
    }

    @Test
    void invalidJoinsAreIgnored() {
        presenceService.join("s1", null, user("u1", "A"));
        presenceService.join("s2", "ROOM01", null);
        presenceService.join("s3", "ROOM01", user(null, "A"));

        assertThat(presenceService.getUsers("ROOM01")).isEmpty();
    }

    @Test
    void getUsersForUnknownRoomReturnsEmptyList() {
        List<UserPresenceDto> users = presenceService.getUsers("MISSING");
        assertThat(users).isNotNull().isEmpty();
    }

    private UserPresenceDto user(String id, String name) {
        return new UserPresenceDto(id, name, "#FF6B6B");
    }
}
