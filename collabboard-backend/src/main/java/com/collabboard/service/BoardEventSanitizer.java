package com.collabboard.service;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.ShapeDto;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Validates and trims everything a client sends on the board channel before
 * it is stored or relayed to other people. Clients are untrusted: anyone with
 * a room code can open a socket and send arbitrary JSON.
 * <p>
 * Each method returns a new object and leaves its input untouched. An empty
 * result means "drop this message".
 */
@Component
public class BoardEventSanitizer {

    public static final int MAX_POINT_VALUES = 12_000;
    public static final int MAX_TEXT_LENGTH = 5_000;
    public static final int MAX_SHAPES_PER_BOARD = 5_000;

    static final int MAX_ID_LENGTH = 64;
    static final int MAX_NAME_LENGTH = 40;
    static final int MAX_BOARD_NAME_INPUT = 500;
    static final int MAX_LASER_POINT_VALUES = 4_000;
    private static final int MAX_STYLE_LENGTH = 32;
    private static final double MAX_COORDINATE = 1_000_000;
    // Bounds for values a renderer multiplies sizes by. Unbounded, one
    // malicious shape (font size 1e9, scale 1e300) could freeze every
    // browser that opens the board, on every load.
    private static final double MAX_STROKE_WIDTH = 200;
    private static final double MAX_FONT_SIZE = 2_000;
    private static final double MAX_SCALE = 100;
    private static final double MAX_ROTATION = 36_000;
    private static final String STYLE_PUNCTUATION = "#(),.% -";

    private static final Set<String> SHAPE_TOOLS = Set.of(
            "pen", "highlighter", "rectangle", "circle", "diamond", "triangle",
            "arrow", "text", "stickyNote", "emoji");

    private static final Set<String> BOARD_TYPES = Set.of(
            "draw", "update", "delete", "replace", "clear", "rename");

    // "preview" carries an edit that is still in progress (text being typed).
    // It is shown to everyone but never written to the database: only the
    // finished edit, sent as "update", is saved.
    private static final Set<String> RELAY_TYPES = Set.of("cursor", "laser", "sync", "preview");

    public boolean isBoardAltering(String type) {
        return type != null && BOARD_TYPES.contains(type);
    }

    /** @return a cleaned copy of {@code event}, or empty if it must be dropped. */
    public Optional<DrawEventDto> sanitize(DrawEventDto event) {
        if (event == null || event.getType() == null) {
            return Optional.empty();
        }
        String type = event.getType();
        if (!BOARD_TYPES.contains(type) && !RELAY_TYPES.contains(type)) {
            return Optional.empty();
        }

        DrawEventDto.DrawEventDtoBuilder clean = DrawEventDto.builder()
                .type(type)
                .userId(id(event.getUserId()))
                .clientId(id(event.getClientId()));

        return switch (type) {
            case "draw", "update", "preview" -> sanitizeShape(event.getShape())
                    .map(shape -> clean.shape(shape).shapeId(shape.getId()).build());
            case "delete" -> deleteIds(event)
                    .map(ids -> clean.shapeIds(ids).build());
            case "replace" -> sanitizeShapes(event.getShapes())
                    .map(shapes -> clean.shapes(shapes).build());
            case "rename" -> Optional.of(
                    clean.boardName(truncate(event.getBoardName(), MAX_BOARD_NAME_INPUT)).build());
            case "cursor" -> cursor(event, clean);
            case "laser" -> points(event.getPoints(), MAX_LASER_POINT_VALUES)
                    .map(pts -> clean.points(pts).userColor(style(event.getUserColor())).build());
            default -> Optional.of(clean.build()); // clear, sync
        };
    }

    /** @return a cleaned copy of {@code shape}, or empty if it is unusable. */
    public Optional<ShapeDto> sanitizeShape(ShapeDto shape) {
        if (shape == null || id(shape.getId()) == null || !SHAPE_TOOLS.contains(String.valueOf(shape.getTool()))) {
            return Optional.empty();
        }
        List<Double> points = null;
        if (shape.getPoints() != null) {
            Optional<List<Double>> cleaned = points(shape.getPoints(), MAX_POINT_VALUES);
            if (cleaned.isEmpty()) {
                return Optional.empty();
            }
            points = cleaned.get();
        }
        return Optional.of(ShapeDto.builder()
                .id(shape.getId())
                .tool(shape.getTool())
                .points(points)
                .x(coordinate(shape.getX()))
                .y(coordinate(shape.getY()))
                .width(coordinate(shape.getWidth()))
                .height(coordinate(shape.getHeight()))
                .rotation(clamp(shape.getRotation(), -MAX_ROTATION, MAX_ROTATION))
                .scaleX(clamp(shape.getScaleX(), -MAX_SCALE, MAX_SCALE))
                .scaleY(clamp(shape.getScaleY(), -MAX_SCALE, MAX_SCALE))
                .color(style(shape.getColor()))
                .strokeWidth(clamp(shape.getStrokeWidth(), 0, MAX_STROKE_WIDTH))
                .fillColor(style(shape.getFillColor()))
                .opacity(clamp(shape.getOpacity(), 0, 1))
                .text(truncate(shape.getText(), MAX_TEXT_LENGTH))
                .fontSize(clamp(shape.getFontSize(), 1, MAX_FONT_SIZE))
                .fontStyle(style(shape.getFontStyle()))
                .userId(id(shape.getUserId()))
                .build());
    }

    /** Display name shown to other people in the room. */
    public String displayName(String name) {
        if (name == null || name.isBlank()) {
            return "Guest";
        }
        return truncate(name.strip(), MAX_NAME_LENGTH);
    }

    /** A CSS colour or other short style token; anything suspicious becomes null. */
    public String style(String value) {
        if (value == null || value.length() > MAX_STYLE_LENGTH) {
            return null;
        }
        boolean safe = value.chars()
                .allMatch(c -> Character.isLetterOrDigit(c) || STYLE_PUNCTUATION.indexOf(c) >= 0);
        return safe ? value : null;
    }

    /** An opaque identifier; blank or oversized values become null. */
    public String id(String value) {
        if (value == null || value.isBlank() || value.length() > MAX_ID_LENGTH) {
            return null;
        }
        return value;
    }

    private Optional<List<ShapeDto>> sanitizeShapes(List<ShapeDto> shapes) {
        if (shapes == null || shapes.size() > MAX_SHAPES_PER_BOARD) {
            return Optional.empty();
        }
        return Optional.of(shapes.stream()
                .map(this::sanitizeShape)
                .flatMap(Optional::stream)
                .toList());
    }

    private Optional<List<String>> deleteIds(DrawEventDto event) {
        List<String> ids = event.getShapeIds();
        if (ids == null) {
            ids = event.getShapeId() != null ? List.of(event.getShapeId()) : List.of();
        }
        if (ids.size() > MAX_SHAPES_PER_BOARD) {
            return Optional.empty();
        }
        List<String> cleaned = ids.stream().map(this::id).filter(Objects::nonNull).toList();
        return cleaned.isEmpty() ? Optional.empty() : Optional.of(cleaned);
    }

    private Optional<DrawEventDto> cursor(DrawEventDto event, DrawEventDto.DrawEventDtoBuilder clean) {
        Double x = coordinate(event.getCursorX());
        Double y = coordinate(event.getCursorY());
        if (x == null || y == null) {
            return Optional.empty();
        }
        return Optional.of(clean
                .cursorX(x)
                .cursorY(y)
                .userName(displayName(event.getUserName()))
                .userColor(style(event.getUserColor()))
                .tool(truncate(event.getTool(), MAX_STYLE_LENGTH))
                .build());
    }

    private Optional<List<Double>> points(List<Double> points, int maxValues) {
        if (points == null || points.size() > maxValues || points.size() % 2 != 0) {
            return Optional.empty();
        }
        boolean allValid = points.stream().allMatch(p -> coordinate(p) != null);
        return allValid ? Optional.of(List.copyOf(points)) : Optional.empty();
    }

    private Double coordinate(Double value) {
        Double finite = finite(value);
        return finite != null && Math.abs(finite) <= MAX_COORDINATE ? finite : null;
    }

    /** Null and non-finite values stay null; anything else is pulled into range. */
    private Double clamp(Double value, double min, double max) {
        Double finite = finite(value);
        return finite == null ? null : Math.max(min, Math.min(max, finite));
    }

    private Double finite(Double value) {
        return value != null && Double.isFinite(value) ? value : null;
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() > max ? value.substring(0, max) : value;
    }
}
