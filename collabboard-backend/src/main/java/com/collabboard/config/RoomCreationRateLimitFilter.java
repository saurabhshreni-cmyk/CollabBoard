package com.collabboard.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caps how many rooms one address can create per minute.
 * <p>
 * Creating a room is the only unauthenticated request that writes a new row,
 * so without a limit a simple loop could fill the database. A fixed one-minute
 * window per client address is deliberately simple: it needs no extra
 * infrastructure and is plenty for a single-instance deployment.
 */
@Component
public class RoomCreationRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 60_000;
    private static final int MAX_TRACKED_CLIENTS = 10_000;
    private static final String LIMITED_PATH = "/api/rooms";

    private final int maxPerWindow;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Autowired
    public RoomCreationRateLimitFilter(
            @Value("${app.rate-limit.room-creations-per-minute:20}") int maxPerWindow) {
        this(maxPerWindow, Clock.systemUTC());
    }

    RoomCreationRateLimitFilter(int maxPerWindow, Clock clock) {
        this.maxPerWindow = maxPerWindow;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        boolean isRoomCreation = "POST".equalsIgnoreCase(request.getMethod())
                && LIMITED_PATH.equals(request.getRequestURI());
        return maxPerWindow <= 0 || !isRoomCreation;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        if (tryAcquire(request.getRemoteAddr())) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(WINDOW_MS / 1000));
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.getWriter().write(
                "{\"status\":429,\"title\":\"Too Many Requests\","
                        + "\"detail\":\"Too many rooms created. Please wait a minute and try again.\"}");
    }

    boolean tryAcquire(String client) {
        long now = clock.millis();
        if (windows.size() > MAX_TRACKED_CLIENTS) {
            windows.values().removeIf(w -> now - w.startedAt() >= WINDOW_MS);
        }
        Window updated = windows.compute(client, (key, current) ->
                current == null || now - current.startedAt() >= WINDOW_MS
                        ? new Window(now, 1)
                        : new Window(current.startedAt(), current.count() + 1));
        return updated.count() <= maxPerWindow;
    }

    private record Window(long startedAt, int count) {
    }
}
