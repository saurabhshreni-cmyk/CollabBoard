package com.collabboard.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One message on the board channel.
 * <p>
 * Board-altering types ({@code draw}, {@code update}, {@code delete},
 * {@code replace}, {@code clear}, {@code rename}) are persisted and relayed.
 * Ephemeral types ({@code cursor}, {@code laser}, {@code sync},
 * {@code preview}) are relayed only. {@code rejected} is sent by the server when it refuses an event.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DrawEventDto {

    private String type;

    private String userId;
    // Unique per browser tab. Lets a client recognise its own echo even when
    // the same user (same userId) has the board open in several tabs.
    private String clientId;
    private String userName;
    private String userColor;
    private String tool;

    // Single shape (draw / update)
    private ShapeDto shape;

    // Full board state (replace)
    private List<ShapeDto> shapes;

    // Deletion target(s)
    private String shapeId;
    private List<String> shapeIds;

    // Cursor position
    private Double cursorX;
    private Double cursorY;

    // Laser stroke points (ephemeral)
    private List<Double> points;

    // Board name change broadcast
    private String boardName;

    // Why the server refused an event (type = rejected)
    private String reason;
}
