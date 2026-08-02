package com.collabboard.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponseDto {

    private Long id;
    private String roomCode;
    private String boardName;
    private String boardSnapshot;
    private LocalDateTime createdAt;
    private LocalDateTime lastUpdatedAt;
}
