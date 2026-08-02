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
public class ShapeDto {

    private String id;
    // Shape type: pen, highlighter, rectangle, circle, diamond, triangle,
    // arrow, text, stickyNote, emoji, eraser
    private String tool;

    // Freehand / arrow points (flat [x1,y1,x2,y2,...])
    private List<Double> points;

    // Position and geometry
    private Double x;
    private Double y;
    private Double width;
    private Double height;

    // Transform (from Konva Transformer)
    private Double rotation;
    private Double scaleX;
    private Double scaleY;

    // Styling
    private String color;        // stroke color
    private Double strokeWidth;
    private String fillColor;    // fill / sticky background
    private Double opacity;

    // Text
    private String text;
    private Double fontSize;
    private String fontStyle;    // "normal", "bold", "italic", "bold italic"

    // Misc
    private String userId;
}
