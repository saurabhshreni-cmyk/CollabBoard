package com.collabboard.controller;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.ShapeDto;
import com.collabboard.service.PresenceService;
import com.collabboard.service.RoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class WhiteboardControllerTest {

    private RoomService roomService;
    private PresenceService presenceService;
    private WhiteboardController controller;

    @BeforeEach
    void setUp() {
        roomService = mock(RoomService.class);
        presenceService = mock(PresenceService.class);
        controller = new WhiteboardController(roomService, presenceService);
    }

    @Test
    void boardAlteringEventsArePersistedAndRelayed() {
        DrawEventDto event = new DrawEventDto();
        event.setType("draw");
        event.setUserId("u1");
        ShapeDto shape = new ShapeDto();
        shape.setId("s1");
        shape.setTool("pen");
        event.setShape(shape);

        DrawEventDto relayed = controller.receiveDrawEvent("ROOM01", event);

        verify(roomService).updateSnapshot("ROOM01", event);
        assertThat(relayed).isSameAs(event);
    }

    @Test
    void cursorEventsAreRelayedWithoutTouchingTheDatabase() {
        DrawEventDto event = new DrawEventDto();
        event.setType("cursor");
        event.setCursorX(1.0);
        event.setCursorY(2.0);

        DrawEventDto relayed = controller.receiveDrawEvent("ROOM01", event);

        verify(roomService, never()).updateSnapshot(any(), any());
        assertThat(relayed).isSameAs(event);
    }

    @Test
    void laserEventsAreNeverPersisted() {
        DrawEventDto event = new DrawEventDto();
        event.setType("laser");

        controller.receiveDrawEvent("ROOM01", event);

        verify(roomService, never()).updateSnapshot(any(), any());
    }

    @Test
    void nullEventIsHandledSafely() {
        assertThat(controller.receiveDrawEvent("ROOM01", null)).isNull();
        verify(roomService, never()).updateSnapshot(any(), any());
    }

    @Test
    void joinRegistersPresenceWithTheStompSessionId() {
        DrawEventDto event = new DrawEventDto();
        event.setType("join");
        event.setUserId("u1");
        event.setUserName("BlueFox12");
        event.setUserColor("#FF6B6B");

        controller.handlePresence("ROOM01", event, headers("sess-1"));

        ArgumentCaptor<com.collabboard.dto.UserPresenceDto> captor =
                ArgumentCaptor.forClass(com.collabboard.dto.UserPresenceDto.class);
        verify(presenceService).join(eq("sess-1"), eq("ROOM01"), captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo("u1");
        assertThat(captor.getValue().getDisplayName()).isEqualTo("BlueFox12");
    }

    @Test
    void leaveRemovesPresence() {
        DrawEventDto event = new DrawEventDto();
        event.setType("leave");
        event.setUserId("u1");

        controller.handlePresence("ROOM01", event, headers("sess-1"));

        verify(presenceService).leave("ROOM01", "u1");
    }

    private SimpMessageHeaderAccessor headers(String sessionId) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId(sessionId);
        return accessor;
    }
}
