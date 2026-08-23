// Single source of truth for text rendering.
//
// The HTML <textarea> overlay and the Konva <Text> node must agree on font,
// line height and padding — otherwise what you type visibly jumps the moment
// you click away. Both sides import from here.

// Konva measures fonts by name and cannot read a CSS stack, so this must be a
// single family that is present on every platform.
export const BOARD_FONT = 'Arial';

export const TEXT_LINE_HEIGHT = 1.25;

// Padding inside the editing box, in unscaled canvas pixels. The Konva Text is
// offset by the same amount so the glyphs land in identical positions.
export const TEXT_PADDING = 4;

// Wrap width for a plain text block, in canvas pixels.
export const TEXT_WRAP_WIDTH = 320;

export const STICKY_WIDTH = 200;
export const STICKY_HEIGHT = 150;
export const STICKY_PADDING = 12;
export const STICKY_FONT_SIZE = 18;
export const STICKY_TEXT_COLOR = '#1a1a2e';

/** Geometry for one text-ish shape, shared by the editor and the renderer. */
export function textMetrics(isSticky) {
  return isSticky
    ? {
        width: STICKY_WIDTH,
        padding: STICKY_PADDING,
        wrapWidth: STICKY_WIDTH - STICKY_PADDING * 2,
      }
    : {
        width: TEXT_WRAP_WIDTH,
        padding: TEXT_PADDING,
        wrapWidth: TEXT_WRAP_WIDTH - TEXT_PADDING * 2,
      };
}
