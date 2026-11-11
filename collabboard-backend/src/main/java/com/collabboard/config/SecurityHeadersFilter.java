package com.collabboard.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Security and caching headers for the web app when this server also serves
 * the frontend (the single-service deployment).
 * <p>
 * The SockJS endpoint and the dev-only H2 console are left alone: both serve
 * their own framed pages with inline scripts, which this policy would break.
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    /**
     * Scripts only from this origin. Inline styles are needed by the canvas UI.
     * {@code connect-src} names ws:/wss: explicitly because not every browser
     * lets 'self' cover the WebSocket scheme.
     */
    static final String CONTENT_SECURITY_POLICY = String.join("; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self' ws: wss:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'");

    private static final String ASSETS_PREFIX = "/assets/";
    private static final String API_PREFIX = "/api/";

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/ws") || path.startsWith("/h2-console");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();

        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);

        if (path.startsWith(ASSETS_PREFIX)) {
            // Build output is content-hashed, so it can be cached forever.
            response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (!path.startsWith(API_PREFIX)) {
            // index.html must be revalidated, or browsers keep pointing at
            // asset files from a previous deploy.
            response.setHeader("Cache-Control", "no-cache");
        }

        chain.doFilter(request, response);
    }
}
