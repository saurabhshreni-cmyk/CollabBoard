package com.collabboard.controller;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.ShapeDto;
import com.collabboard.dto.UserPresenceDto;
import com.collabboard.exception.BoardEventRejectedException;
import com.collabboard.model.Room;
import com.collabboard.service.BoardEventSanitizer;
import com.collabboard.service.PresenceService;
import com.collabboard.service.RoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WhiteboardControllerTest {

    private RoomService roomService;
    private PresenceService presenceService;
    private WhiteboardController controller;

    @BeforeEach
    void setUp() {
        roomService = mock(RoomService.class);
        presenceService = mock(PresenceService.class);
        controller = new WhiteboardController(roomService, presenceService, new BoardEventSanitizer());
    }

    @Test
    void boardAlteringEventsArePersistedAndRelayed() {
        DrawEventDto relayed = controller.receiveDrawEvent("ROOM01", drawEvent());

        verify(roomService).updateSnapshot(eq("ROOM01"), any(DrawEventDto.class));
        assertThat(relayed.getType()).isEqualTo("draw");
        assertThat(relayed.getClientId()).isEqualTo("tab-1");
        assertThat(relayed.getShape().getId()).isEqualTo("s1");
    }

    @Test
    void renameIsPersistedAndRelayedWithTheNormalisedName() {
        DrawEventDto event = new DrawEventDto();
        event.setType("rename");
        event.setUserId("u1");
        event.setBoardName("  Sprint Planning  ");

        Room saved = Room.builder().roomCode("ROOM01").boardName("Sprint Planning").build();
        when(roomService.updateSnapshot(eq("ROOM01"), any(DrawEventDto.class))).thenReturn(saved);

        DrawEventDto relayed = controller.receiveDrawEvent("ROOM01", event);

        assertThat(relayed.getBoardName()).isEqualTo("Sprint Planning");
    }

    @Test
    void cursorEventsAreRelayedWithoutTouchingTheDatabase() {
        DrawEventDto event = new DrawEventDto();
        event.setType("cursor");
        event.setCursorX(1.0);
        event.setCursorY(2.0);

        DrawEventDto relayed = controller.receiveDrawEvent("ROOM01", event);

        verify(roomService, never()).updateSnapshot(any(), any());
        assertThat(relayed.getCursorX()).isEqualTo(1.0);
    }

    @Test
    void typingPreviewsAreRelayedButNeverSaved() {
        DrawEventDto event = drawEvent();
        event.setType("preview");

        DrawEventDto relayed = controller.receiveDrawEvent("ROOM01", event);

        verify(roomService, never()).updateSnapshot(any(), any());
        assertThat(relayed.getType()).isEqualTo("preview");
        assertThat(relayed.getShape().getId()).isEqualTo("s1");
    }

    @Test
    void unknownEventTypesAreDropped() {
        DrawEventDto event = new DrawEventDto();
        event.setType("selfDestruct");

        assertThat(controller.receiveDrawEvent("ROOM01", event)).isNull();
        verify(roomService, never()).updateSnapshot(any(), any());
    }

    @Test
    void malformedShapeIsDroppedInsteadOfBroadcast() {
        DrawEventDto event = drawEvent();
        event.getShape().setTool("<script>");

        assertThat(controller.receiveDrawEvent("ROOM01", event)).isNull();
        verify(roomService, never()).updateSnapshot(any(), any());
    }

    @Test
    void nullEventIsHandledSafely() {
        assertThat(controller.receiveDrawEvent("ROOM01", null)).isNull();
        verify(roomService, never()).updateSnapshot(any(), any());
    }

    @Test
    void eventOverTheBoardLimitIsAnsweredWithARejectionForTheSender() {
        when(roomService.updateSnapshot(any(), any()))
                .thenThrow(new BoardEventRejectedException("This board is full."));

        DrawEventDto relayed = controller.receiveDrawEvent("ROOM01", drawEvent());

        assertThat(relayed.getType()).isEqualTo("rejected");
        assertThat(relayed.getClientId()).isEqualTo("tab-1");
        assertThat(relayed.getReason()).isEqualTo("This board is full.");
        assertThat(relayed.getShape()).isNull();
    }

    @Test
    void eventForAMissingRoomIsRejectedRatherThanThrown() {
        when(roomService.updateSnapshot(any(), any()))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found: NOPE00"));

        DrawEventDto relayed = controller.receiveDrawEvent("NOPE00", drawEvent());

        assertThat(relayed.getType()).isEqualTo("rejected");
    }

    @Test
    void unexpectedFailureDoesNotLeakInternalDetails() {
        when(roomService.updateSnapshot(any(), any()))
                .thenThrow(new IllegalStateException("jdbc:postgresql://secret-host/db is down"));

        DrawEventDto relayed = controller.receiveDrawEvent("ROOM01", drawEvent());

        assertThat(relayed.getType()).isEqualTo("rejected");
        assertThat(relayed.getReason()).doesNotContain("jdbc");
    }

    @Test
    void joinRegistersSanitisedPresenceWithTheStompSessionId() {
        DrawEventDto event = new DrawEventDto();
        event.setType("join");
        event.setUserId("u1");
        event.setUserName("  " + "N".repeat(200));
        event.setUserColor("#FF6B6B");

        controller.handlePresence("ROOM01", event, headers("sess-1"));

        ArgumentCaptor<UserPresenceDto> captor = ArgumentCaptor.forClass(UserPresenceDto.class);
        verify(presenceService).join(eq("sess-1"), eq("ROOM01"), captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo("u1");
        assertThat(captor.getValue().getDisplayName()).hasSize(40);
    }

    @Test
    void joinWithoutAUserIdIsIgnored() {
        DrawEventDto event = new DrawEventDto();
        event.setType("join");

        controller.handlePresence("ROOM01", event, headers("sess-1"));

        verify(presenceService, never()).join(any(), any(), any());
    }

    @Test
    void leaveRemovesOnlyTheSendersOwnConnection() {
        DrawEventDto event = new DrawEventDto();
        event.setType("leave");
        event.setUserId("someone-else");

        controller.handlePresence("ROOM01", event, headers("sess-1"));

        verify(presenceService).leave("sess-1");
    }

    private DrawEventDto drawEvent() {
        ShapeDto shape = new ShapeDto();
        shape.setId("s1");
        shape.setTool("pen");
        DrawEventDto event = new DrawEventDto();
        event.setType("draw");
        event.setUserId("u1");
        event.setClientId("tab-1");
        event.setShape(shape);
        return event;
    }

    private SimpMessageHeaderAccessor headers(String sessionId) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId(sessionId);
        return accessor;
    }
}
