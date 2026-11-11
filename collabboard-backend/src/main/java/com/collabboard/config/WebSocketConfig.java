package com.collabboard.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

import java.util.Arrays;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * Largest STOMP message accepted from a client. Must stay in step with the
     * servlet container's WebSocket frame buffer, which is raised to the same
     * size in application.properties — the container default is only 8 KB,
     * small enough that one long pen stroke used to drop the connection.
     */
    static final int MAX_MESSAGE_BYTES = 256 * 1024;
    private static final int SEND_BUFFER_BYTES = 1024 * 1024;
    private static final int SEND_TIME_LIMIT_MS = 20_000;
    private static final long HEARTBEAT_MS = 10_000;

    private final String[] allowedOrigins;
    private final TaskScheduler heartbeatScheduler;

    public WebSocketConfig(
            @Value("${app.cors.allowed-origins:*}") String allowedOrigins,
            // Lazy: the scheduler bean is created by the very configuration this
            // class customises, so resolving it eagerly would be a cycle.
            @Lazy @Qualifier("messageBrokerTaskScheduler") TaskScheduler heartbeatScheduler) {
        String[] parsed = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        this.allowedOrigins = parsed.length > 0 ? parsed : new String[] {"*"};
        this.heartbeatScheduler = heartbeatScheduler;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Server-side heartbeats keep idle connections alive through proxies
        // (Render, nginx) and let both ends notice a dead socket quickly.
        registry.enableSimpleBroker("/topic")
                .setHeartbeatValue(new long[] {HEARTBEAT_MS, HEARTBEAT_MS})
                .setTaskScheduler(heartbeatScheduler);
        registry.setApplicationDestinationPrefixes("/app");
        // Deliver each subscriber's messages in the order they were published.
        registry.setPreservePublishOrder(true);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Handle each client's messages in the order it sent them. Without
        // this a "draw" and the "delete" that follows it can be processed out
        // of order on the thread pool, resurrecting the deleted shape.
        registry.setPreserveReceiveOrder(true);
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS();
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(MAX_MESSAGE_BYTES);
        registration.setSendBufferSizeLimit(SEND_BUFFER_BYTES);
        registration.setSendTimeLimit(SEND_TIME_LIMIT_MS);
    }
}
