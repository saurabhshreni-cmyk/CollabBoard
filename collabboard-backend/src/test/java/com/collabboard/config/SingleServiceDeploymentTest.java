package com.collabboard.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Behaviour that matters when this server also serves the frontend. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SingleServiceDeploymentTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void boardLinksAreHandedToTheSinglePageApp() throws Exception {
        mockMvc.perform(get("/room/ABC123"))
                .andExpect(forwardedUrl("/index.html"));
    }

    @Test
    void pagesCarrySecurityHeadersAndAreNotCached() throws Exception {
        mockMvc.perform(get("/room/ABC123"))
                .andExpect(header().string("Content-Security-Policy", containsString("script-src 'self'")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Cache-Control", "no-cache"));
    }

    @Test
    void hashedAssetsAreCachedForever() throws Exception {
        mockMvc.perform(get("/assets/index-abc123.js"))
                .andExpect(header().string("Cache-Control", containsString("immutable")));
    }

    @Test
    void apiResponsesKeepTheirOwnCachingButStillGetSecurityHeaders() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().doesNotExist("Cache-Control"));
    }

    @Test
    void theWebSocketEndpointIsLeftAlone() throws Exception {
        // SockJS serves its own framed helper page; a strict policy breaks it.
        mockMvc.perform(get("/ws/info"))
                .andExpect(header().doesNotExist("Content-Security-Policy"));
    }
}
