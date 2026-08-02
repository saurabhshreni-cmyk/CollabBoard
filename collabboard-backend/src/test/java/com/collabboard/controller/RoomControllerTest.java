package com.collabboard.controller;

import com.collabboard.repository.RoomRepository;
import com.collabboard.service.RoomService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RoomControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void clean() {
        roomRepository.deleteAll();
    }

    @Test
    void createRoomReturns201WithCode() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/rooms"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomCode").isNotEmpty())
                .andExpect(jsonPath("$.boardName").value("Untitled Board"))
                .andExpect(jsonPath("$.boardSnapshot").value("[]"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("roomCode").asText()).hasSize(6);
    }

    @Test
    void getRoomReturnsExistingRoom() throws Exception {
        String code = roomService.createRoom().getRoomCode();

        mockMvc.perform(get("/api/rooms/{code}", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomCode").value(code));
    }

    @Test
    void getRoomReturns404ForUnknownCode() throws Exception {
        mockMvc.perform(get("/api/rooms/{code}", "ZZZZZZ"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateNameChangesBoardName() throws Exception {
        String code = roomService.createRoom().getRoomCode();

        mockMvc.perform(put("/api/rooms/{code}/name", code)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"boardName\":\"Design Review\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.boardName").value("Design Review"));
    }

    @Test
    void updateNameWithEmptyBodyFallsBackToDefault() throws Exception {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateBoardName(code, "Something");

        mockMvc.perform(put("/api/rooms/{code}/name", code)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.boardName").value("Untitled Board"));
    }

    @Test
    void clearRoomEmptiesTheSnapshot() throws Exception {
        String code = roomService.createRoom().getRoomCode();
        roomService.updateBoardName(code, "Board");

        mockMvc.perform(delete("/api/rooms/{code}/clear", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.boardSnapshot").value("[]"));
    }

    @Test
    void usersEndpointReturnsEmptyRosterForFreshRoom() throws Exception {
        String code = roomService.createRoom().getRoomCode();

        mockMvc.perform(get("/api/rooms/{code}/users", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void healthEndpointReportsStatusAndRoomCount() throws Exception {
        roomService.createRoom();

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.roomCount").value(1))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }
}
