package com.collabboard.service;

import com.collabboard.dto.DrawEventDto;
import com.collabboard.dto.ShapeDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BoardEventSanitizerTest {

    private final BoardEventSanitizer sanitizer = new BoardEventSanitizer();

    @Test
    void validShapePassesThroughUnchanged() {
        ShapeDto shape = shape("s1", "rectangle");
        shape.setX(10.0);
        shape.setWidth(120.0);
        shape.setColor("#FF6B6B");
        shape.setFillColor("transparent");
        shape.setText("hello");

        ShapeDto clean = sanitizer.sanitizeShape(shape).orElseThrow();

        assertThat(clean).isEqualTo(shape).isNotSameAs(shape);
    }

    @ParameterizedTest
    @ValueSource(strings = {"eraser", "laser", "<script>", ""})
    void shapeWithUnknownToolIsRejected(String tool) {
        assertThat(sanitizer.sanitizeShape(shape("s1", tool))).isEmpty();
    }

    @Test
    void shapeWithoutAnIdIsRejected() {
        assertThat(sanitizer.sanitizeShape(shape(null, "pen"))).isEmpty();
        assertThat(sanitizer.sanitizeShape(shape(" ", "pen"))).isEmpty();
        assertThat(sanitizer.sanitizeShape(shape("x".repeat(65), "pen"))).isEmpty();
    }

    @Test
    void shapeWithTooManyPointsIsRejected() {
        ShapeDto shape = shape("s1", "pen");
        shape.setPoints(Collections.nCopies(BoardEventSanitizer.MAX_POINT_VALUES + 2, 1.0));

        assertThat(sanitizer.sanitizeShape(shape)).isEmpty();
    }

    @Test
    void shapeWithNonFiniteOrDanglingPointsIsRejected() {
        ShapeDto nan = shape("s1", "pen");
        nan.setPoints(List.of(1.0, Double.NaN));
        ShapeDto odd = shape("s2", "pen");
        odd.setPoints(List.of(1.0, 2.0, 3.0));
        ShapeDto withNull = shape("s3", "pen");
        withNull.setPoints(new ArrayList<>(Arrays.asList(1.0, null)));

        assertThat(sanitizer.sanitizeShape(nan)).isEmpty();
        assertThat(sanitizer.sanitizeShape(odd)).isEmpty();
        assertThat(sanitizer.sanitizeShape(withNull)).isEmpty();
    }

    @Test
    void oversizedTextIsTruncatedAndUnsafeStylesDropped() {
        ShapeDto shape = shape("s1", "text");
        shape.setText("x".repeat(BoardEventSanitizer.MAX_TEXT_LENGTH + 50));
        shape.setColor("red;background:url(javascript:alert(1))");
        shape.setX(Double.POSITIVE_INFINITY);

        ShapeDto clean = sanitizer.sanitizeShape(shape).orElseThrow();

        assertThat(clean.getText()).hasSize(BoardEventSanitizer.MAX_TEXT_LENGTH);
        assertThat(clean.getColor()).isNull();
        assertThat(clean.getX()).isNull();
    }

    @Test
    void absurdSizesAreClampedSoOneShapeCannotFreezeEveryBrowser() {
        ShapeDto shape = shape("s1", "text");
        shape.setFontSize(1e9);
        shape.setScaleX(1e300);
        shape.setScaleY(-1e300);
        shape.setStrokeWidth(-5.0);
        shape.setOpacity(7.0);

        ShapeDto clean = sanitizer.sanitizeShape(shape).orElseThrow();

        assertThat(clean.getFontSize()).isEqualTo(2_000.0);
        assertThat(clean.getScaleX()).isEqualTo(100.0);
        assertThat(clean.getScaleY()).isEqualTo(-100.0);
        assertThat(clean.getStrokeWidth()).isEqualTo(0.0);
        assertThat(clean.getOpacity()).isEqualTo(1.0);
    }

    @Test
    void drawEventKeepsOnlyTheFieldsThatMatter() {
        DrawEventDto event = event("draw");
        event.setShape(shape("s1", "pen"));
        event.setShapes(List.of(shape("junk", "pen")));
        event.setBoardName("junk");

        DrawEventDto clean = sanitizer.sanitize(event).orElseThrow();

        assertThat(clean.getShape().getId()).isEqualTo("s1");
        assertThat(clean.getShapeId()).isEqualTo("s1");
        assertThat(clean.getClientId()).isEqualTo("tab-1");
        assertThat(clean.getShapes()).isNull();
        assertThat(clean.getBoardName()).isNull();
    }

    @Test
    void previewIsSanitisedLikeAnUpdate() {
        DrawEventDto event = event("preview");
        ShapeDto note = shape("s1", "stickyNote");
        note.setText("typing…");
        event.setShape(note);

        DrawEventDto clean = sanitizer.sanitize(event).orElseThrow();

        assertThat(clean.getType()).isEqualTo("preview");
        assertThat(clean.getShape().getText()).isEqualTo("typing…");
        assertThat(sanitizer.sanitize(event("preview"))).isEmpty();
    }

    @Test
    void deleteAcceptsEitherASingleIdOrAList() {
        DrawEventDto single = event("delete");
        single.setShapeId("s1");
        DrawEventDto many = event("delete");
        many.setShapeIds(List.of("s1", "s2"));

        assertThat(sanitizer.sanitize(single).orElseThrow().getShapeIds()).containsExactly("s1");
        assertThat(sanitizer.sanitize(many).orElseThrow().getShapeIds()).containsExactly("s1", "s2");
        assertThat(sanitizer.sanitize(event("delete"))).isEmpty();
    }

    @Test
    void replaceDropsInvalidShapesButKeepsTheRest() {
        DrawEventDto event = event("replace");
        event.setShapes(List.of(shape("ok", "circle"), shape("bad", "nope")));

        DrawEventDto clean = sanitizer.sanitize(event).orElseThrow();

        assertThat(clean.getShapes()).extracting(ShapeDto::getId).containsExactly("ok");
    }

    @Test
    void replaceWithTooManyShapesIsRejected() {
        DrawEventDto event = event("replace");
        event.setShapes(Collections.nCopies(BoardEventSanitizer.MAX_SHAPES_PER_BOARD + 1, shape("s", "pen")));

        assertThat(sanitizer.sanitize(event)).isEmpty();
    }

    @Test
    void cursorNeedsAPositionAndGetsACleanName() {
        DrawEventDto cursor = event("cursor");
        cursor.setCursorX(5.0);
        cursor.setCursorY(6.0);
        cursor.setUserName(" ");

        assertThat(sanitizer.sanitize(cursor).orElseThrow().getUserName()).isEqualTo("Guest");
        assertThat(sanitizer.sanitize(event("cursor"))).isEmpty();
    }

    @Test
    void unknownAndMissingTypesAreDropped() {
        assertThat(sanitizer.sanitize(null)).isEmpty();
        assertThat(sanitizer.sanitize(new DrawEventDto())).isEmpty();
        assertThat(sanitizer.sanitize(event("rejected"))).isEmpty();
        assertThat(sanitizer.sanitize(event("join"))).isEmpty();
    }

    @Test
    void onlyPersistedTypesCountAsBoardAltering() {
        assertThat(sanitizer.isBoardAltering("draw")).isTrue();
        assertThat(sanitizer.isBoardAltering("rename")).isTrue();
        assertThat(sanitizer.isBoardAltering("cursor")).isFalse();
        assertThat(sanitizer.isBoardAltering("sync")).isFalse();
        assertThat(sanitizer.isBoardAltering("preview")).isFalse();
        assertThat(sanitizer.isBoardAltering(null)).isFalse();
    }

    private DrawEventDto event(String type) {
        DrawEventDto event = new DrawEventDto();
        event.setType(type);
        event.setUserId("u1");
        event.setClientId("tab-1");
        return event;
    }

    private ShapeDto shape(String id, String tool) {
        ShapeDto shape = new ShapeDto();
        shape.setId(id);
        shape.setTool(tool);
        return shape;
    }
}
