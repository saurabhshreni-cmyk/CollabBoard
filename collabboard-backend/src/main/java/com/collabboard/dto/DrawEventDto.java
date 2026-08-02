package com.collabboard.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DrawEventDto {

    // type: draw, erase, update, delete, replace, clear, undo, redo,
    //       cursor, laser, join, leave
    private String type;

    private String userId;
    private String userName;
    private String userColor;
    private String tool;

    // Single shape (draw / erase / update)
    private ShapeDto shape;

    // Full board state (replace / undo / redo)
    private List<ShapeDto> shapes;

    // Deletion target(s)
    private String shapeId;
    private List<String> shapeIds;

    // Cursor / laser position
    private Double cursorX;
    private Double cursorY;

    // Laser stroke points (ephemeral)
    private List<Double> points;

    // Board name change broadcast
    private String boardName;
}
