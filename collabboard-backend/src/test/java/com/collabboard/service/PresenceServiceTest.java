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

        assertThat(userIds("ROOM01")).containsExactly("u1");
        verify(messagingTemplate, atLeastOnce())
                .convertAndSend(eq("/topic/room/ROOM01/presence"), any(Object.class));
    }

    @Test
    void sameUserInTwoTabsIsListedOnce() {
        presenceService.join("sess-1", "ROOM01", user("u1", "BlueFox12"));
        presenceService.join("sess-2", "ROOM01", user("u1", "BlueFox12"));

        assertThat(presenceService.getUsers("ROOM01")).hasSize(1);
    }

    @Test
    void userStaysOnlineUntilTheirLastTabCloses() {
        presenceService.join("sess-1", "ROOM01", user("u1", "BlueFox12"));
        presenceService.join("sess-2", "ROOM01", user("u1", "BlueFox12"));

        presenceService.leave("sess-1");
        assertThat(userIds("ROOM01")).containsExactly("u1");

        presenceService.leave("sess-2");
        assertThat(presenceService.getUsers("ROOM01")).isEmpty();
    }

    @Test
    void rosterIsInJoinOrder() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));
        presenceService.join("s2", "ROOM01", user("u2", "B"));
        presenceService.join("s3", "ROOM01", user("u3", "C"));

        assertThat(userIds("ROOM01")).containsExactly("u1", "u2", "u3");
    }

    @Test
    void roomsAreIsolatedFromEachOther() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));
        presenceService.join("s2", "ROOM02", user("u2", "B"));

        assertThat(userIds("ROOM01")).containsExactly("u1");
        assertThat(userIds("ROOM02")).containsExactly("u2");
    }

    @Test
    void leaveRemovesOnlyThatConnection() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));
        presenceService.join("s2", "ROOM01", user("u2", "B"));

        presenceService.leave("s1");

        assertThat(userIds("ROOM01")).containsExactly("u2");
    }

    @Test
    void sessionThatSwitchesRoomLeavesTheOldOne() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));

        presenceService.join("s1", "ROOM02", user("u1", "A"));

        assertThat(presenceService.getUsers("ROOM01")).isEmpty();
        assertThat(userIds("ROOM02")).containsExactly("u1");
    }

    @Test
    void leaveOfUnknownSessionIsANoOp() {
        presenceService.join("s1", "ROOM01", user("u1", "A"));

        presenceService.leave("does-not-exist");
        presenceService.leave(null);

        assertThat(presenceService.getUsers("ROOM01")).hasSize(1);
    }

    @Test
    void invalidJoinsAreIgnored() {
        presenceService.join("s1", null, user("u1", "A"));
        presenceService.join("s2", "ROOM01", null);
        presenceService.join("s3", "ROOM01", user(null, "A"));
        presenceService.join(null, "ROOM01", user("u4", "A"));

        assertThat(presenceService.getUsers("ROOM01")).isEmpty();
    }

    @Test
    void getUsersForUnknownRoomReturnsEmptyList() {
        assertThat(presenceService.getUsers("MISSING")).isNotNull().isEmpty();
    }

    private List<String> userIds(String roomCode) {
        return presenceService.getUsers(roomCode).stream().map(UserPresenceDto::getUserId).toList();
    }

    private UserPresenceDto user(String id, String name) {
        return new UserPresenceDto(id, name, "#FF6B6B");
    }
}
