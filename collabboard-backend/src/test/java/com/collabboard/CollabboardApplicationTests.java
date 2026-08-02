package com.collabboard;

import com.collabboard.config.WebSocketConfig;
import com.collabboard.controller.RoomController;
import com.collabboard.service.PresenceService;
import com.collabboard.service.RoomService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class CollabboardApplicationTests {

    @Autowired
    private RoomController roomController;

    @Autowired
    private RoomService roomService;

    @Autowired
    private PresenceService presenceService;

    @Autowired
    private WebSocketConfig webSocketConfig;

    @Test
    void contextLoadsWithAllCoreBeans() {
        assertThat(roomController).isNotNull();
        assertThat(roomService).isNotNull();
        assertThat(presenceService).isNotNull();
        assertThat(webSocketConfig).isNotNull();
    }
}
