import { describe, it, expect } from 'vitest';
import {
  BOARD_FONT,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING,
  TEXT_WRAP_WIDTH,
  STICKY_WIDTH,
  STICKY_HEIGHT,
  STICKY_PADDING,
  textMetrics,
} from './textConfig.js';

// These constants exist to keep the HTML editing overlay and the Konva text
// node in lockstep. If they drift, typed text visibly jumps on commit — the
// exact bug these tests guard against.
describe('textConfig', () => {
  it('names a single concrete font family that Konva can measure', () => {
    expect(typeof BOARD_FONT).toBe('string');
    expect(BOARD_FONT).not.toContain(',');
    expect(BOARD_FONT.trim()).toBe(BOARD_FONT);
    expect(BOARD_FONT.length).toBeGreaterThan(0);
  });

  it('uses one line height everywhere', () => {
    expect(TEXT_LINE_HEIGHT).toBeGreaterThan(1);
    expect(TEXT_LINE_HEIGHT).toBeLessThan(2);
  });

  describe('textMetrics', () => {
    it('reserves padding inside a plain text box', () => {
      const m = textMetrics(false);
      expect(m.width).toBe(TEXT_WRAP_WIDTH);
      expect(m.padding).toBe(TEXT_PADDING);
      expect(m.wrapWidth).toBe(TEXT_WRAP_WIDTH - TEXT_PADDING * 2);
    });

    it('reserves padding inside a sticky note', () => {
      const m = textMetrics(true);
      expect(m.width).toBe(STICKY_WIDTH);
      expect(m.padding).toBe(STICKY_PADDING);
      expect(m.wrapWidth).toBe(STICKY_WIDTH - STICKY_PADDING * 2);
    });

    it('always leaves a positive wrap width', () => {
      for (const sticky of [true, false]) {
        expect(textMetrics(sticky).wrapWidth).toBeGreaterThan(0);
      }
    });

    it('never lets text wrap wider than its own box', () => {
      for (const sticky of [true, false]) {
        const m = textMetrics(sticky);
        expect(m.wrapWidth).toBeLessThan(m.width);
      }
    });
  });

  it('keeps sticky notes a sensible size', () => {
    expect(STICKY_WIDTH).toBeGreaterThan(STICKY_PADDING * 2);
    expect(STICKY_HEIGHT).toBeGreaterThan(STICKY_PADDING * 2);
  });
});
