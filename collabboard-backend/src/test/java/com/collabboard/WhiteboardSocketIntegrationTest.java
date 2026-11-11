package com.collabboard;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.ShapeDto;
import com.collabboard.dto.UserPresenceDto;
import com.collabboard.model.Room;
import com.collabboard.service.PresenceService;
import com.collabboard.service.RoomService;
import jakarta.websocket.ContainerProvider;
import jakarta.websocket.WebSocketContainer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Drives the real STOMP-over-SockJS endpoint on a live port, the same way the
 * browser does, so transport limits and message ordering are actually covered.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class WhiteboardSocketIntegrationTest {

    private static final int TIMEOUT_SECONDS = 10;
    private static final int CLIENT_BUFFER_BYTES = 4 * 1024 * 1024;

    @LocalServerPort
    private int port;

    @Autowired
    private RoomService roomService;

    @Autowired
    private PresenceService presenceService;

    private final List<WebSocketStompClient> clients = new ArrayList<>();
    private String roomCode;

    @BeforeEach
    void createRoom() {
        roomCode = roomService.createRoom().getRoomCode();
    }

    @AfterEach
    void stopClients() {
        clients.forEach(WebSocketStompClient::stop);
    }

    @Test
    void drawEventFromOneClientReachesAnotherAndIsPersisted() throws Exception {
        StompSession alice = connect();
        StompSession bob = connect();
        BlockingQueue<DrawEventDto> bobInbox = subscribeToBoard(bob);

        alice.send(drawDestination(), drawEvent("tab-a", shape("s1", 4)));

        DrawEventDto received = bobInbox.poll(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        assertThat(received).isNotNull();
        assertThat(received.getShape().getId()).isEqualTo("s1");
        assertThat(received.getClientId()).isEqualTo("tab-a");
        assertThat(roomService.getRoom(roomCode).getBoardSnapshot()).contains("\"s1\"");
    }

    @Test
    void longPenStrokeDoesNotDropTheConnection() throws Exception {
        StompSession alice = connect();
        StompSession bob = connect();
        BlockingQueue<DrawEventDto> bobInbox = subscribeToBoard(bob);

        // ~4000 points serialises to well over the 8 KB default frame buffer.
        alice.send(drawDestination(), drawEvent("tab-a", shape("long", 8000)));

        DrawEventDto received = bobInbox.poll(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        assertThat(received).as("large stroke should be relayed").isNotNull();
        assertThat(received.getShape().getPoints()).hasSize(8000);
        assertThat(alice.isConnected()).isTrue();
    }

    @Test
    void eventsFromOneClientAreAppliedInTheOrderTheyWereSent() throws Exception {
        StompSession alice = connect();
        StompSession bob = connect();
        BlockingQueue<DrawEventDto> bobInbox = subscribeToBoard(bob);

        int rounds = 40;
        for (int i = 0; i < rounds; i++) {
            String id = "s" + i;
            alice.send(drawDestination(), drawEvent("tab-a", shape(id, 4)));
            DrawEventDto delete = new DrawEventDto();
            delete.setType("delete");
            delete.setClientId("tab-a");
            delete.setShapeIds(List.of(id));
            alice.send(drawDestination(), delete);
        }

        for (int i = 0; i < rounds * 2; i++) {
            assertThat(bobInbox.poll(TIMEOUT_SECONDS, TimeUnit.SECONDS)).isNotNull();
        }
        // Every draw was followed by its delete; a reordering would leave a zombie.
        assertThat(roomService.getRoom(roomCode).getBoardSnapshot()).isEqualTo("[]");
    }

    @Test
    void twoTabsOfTheSameUserStayOnlineUntilBothLeave() throws Exception {
        StompSession tabOne = connect();
        StompSession tabTwo = connect();
        StompSession watcher = connect();
        BlockingQueue<UserPresenceDto[]> roster = subscribeToPresence(watcher);

        tabOne.send(presenceDestination(), presence("join", "u1"));
        assertThat(awaitRosterSize(roster, 1)).isTrue();
        tabTwo.send(presenceDestination(), presence("join", "u1"));
        Thread.sleep(300);

        tabOne.disconnect();

        // The user must still be listed: their second tab is open.
        Thread.sleep(500);
        assertThat(presenceUserIds()).containsExactly("u1");

        tabTwo.disconnect();
        assertThat(awaitRosterSize(roster, 0)).isTrue();
    }

    private List<String> presenceUserIds() {
        return presenceService.getUsers(roomCode).stream().map(UserPresenceDto::getUserId).toList();
    }

    private boolean awaitRosterSize(BlockingQueue<UserPresenceDto[]> roster, int size) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(TIMEOUT_SECONDS);
        while (System.nanoTime() < deadline) {
            UserPresenceDto[] users = roster.poll(200, TimeUnit.MILLISECONDS);
            if (users != null && users.length == size) {
                return true;
            }
        }
        return false;
    }

    private String drawDestination() {
        return "/app/room/" + roomCode + "/draw";
    }

    private String presenceDestination() {
        return "/app/room/" + roomCode + "/presence";
    }

    private DrawEventDto presence(String type, String userId) {
        DrawEventDto event = new DrawEventDto();
        event.setType(type);
        event.setUserId(userId);
        event.setUserName("BlueFox12");
        event.setUserColor("#FF6B6B");
        return event;
    }

    private DrawEventDto drawEvent(String clientId, ShapeDto shape) {
        DrawEventDto event = new DrawEventDto();
        event.setType("draw");
        event.setUserId("u1");
        event.setClientId(clientId);
        event.setShape(shape);
        return event;
    }

    private ShapeDto shape(String id, int pointValues) {
        List<Double> points = new ArrayList<>(pointValues);
        for (int i = 0; i < pointValues; i++) {
            points.add(1234.5 + i);
        }
        ShapeDto shape = new ShapeDto();
        shape.setId(id);
        shape.setTool("pen");
        shape.setPoints(points);
        shape.setColor("#FF6B6B");
        shape.setStrokeWidth(4.0);
        return shape;
    }

    private StompSession connect() throws Exception {
        // The client's own receive buffer also defaults to 8 KB; raise it so the
        // test measures the server's limits rather than the test client's.
        WebSocketContainer container = ContainerProvider.getWebSocketContainer();
        container.setDefaultMaxTextMessageBufferSize(CLIENT_BUFFER_BYTES);
        WebSocketStompClient client = new WebSocketStompClient(
                new SockJsClient(List.of(new WebSocketTransport(new StandardWebSocketClient(container)))));
        client.setMessageConverter(new MappingJackson2MessageConverter());
        client.setInboundMessageSizeLimit(CLIENT_BUFFER_BYTES);
        clients.add(client);
        return client
                .connectAsync("http://localhost:" + port + "/ws", new StompSessionHandlerAdapter() {})
                .get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    private BlockingQueue<DrawEventDto> subscribeToBoard(StompSession session) throws InterruptedException {
        BlockingQueue<DrawEventDto> inbox = new LinkedBlockingQueue<>();
        session.subscribe("/topic/room/" + roomCode, new QueueingHandler<>(DrawEventDto.class, inbox));
        Thread.sleep(300); // let the SUBSCRIBE frame land before anyone publishes
        return inbox;
    }

    private BlockingQueue<UserPresenceDto[]> subscribeToPresence(StompSession session) throws InterruptedException {
        BlockingQueue<UserPresenceDto[]> inbox = new LinkedBlockingQueue<>();
        session.subscribe("/topic/room/" + roomCode + "/presence",
                new QueueingHandler<>(UserPresenceDto[].class, inbox));
        Thread.sleep(300);
        return inbox;
    }

    private record QueueingHandler<T>(Class<T> type, BlockingQueue<T> inbox) implements StompFrameHandler {
        @Override
        public Type getPayloadType(StompHeaders headers) {
            return type;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            inbox.add(type.cast(payload));
        }
    }
}
