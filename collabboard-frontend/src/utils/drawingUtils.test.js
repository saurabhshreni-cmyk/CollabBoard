import { describe, it, expect } from 'vitest';
import {
  GRID_SIZE,
  generateId,
  snap,
  snapPoint,
  strokeOptions,
  getSvgPathFromStroke,
  freehandPath,
  parseSnapshot,
  shapesBounds,
  STICKY_COLORS,
  EMOJI_STAMPS,
} from './drawingUtils.js';

describe('generateId', () => {
  it('returns a non-empty unique string each call', () => {
    const a = generateId();
    const b = generateId();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe('snap', () => {
  it('is a no-op when snapping is disabled', () => {
    expect(snap(37, false)).toBe(37);
    expect(snap(-4.2, false)).toBe(-4.2);
  });

  it('rounds to the nearest grid step when enabled', () => {
    expect(snap(37, true)).toBe(40);
    expect(snap(29, true)).toBe(20);
    expect(snap(0, true)).toBe(0);
    expect(snap(-13, true)).toBe(-20);
  });

  it('honours a custom grid size', () => {
    expect(snap(37, true, 50)).toBe(50);
  });

  it('uses a 20px default grid', () => {
    expect(GRID_SIZE).toBe(20);
  });
});

describe('snapPoint', () => {
  it('snaps both axes', () => {
    expect(snapPoint({ x: 31, y: 48 }, true)).toEqual({ x: 40, y: 40 });
    expect(snapPoint({ x: 31, y: 48 }, false)).toEqual({ x: 31, y: 48 });
  });
});

describe('strokeOptions', () => {
  it('makes highlighter strokes thick and unthinned', () => {
    const opts = strokeOptions('highlighter', 4);
    expect(opts.size).toBe(16);
    expect(opts.thinning).toBe(0);
    expect(opts.simulatePressure).toBe(false);
  });

  it('gives the pen pressure simulation', () => {
    const opts = strokeOptions('pen', 4);
    expect(opts.size).toBeCloseTo(7.2);
    expect(opts.simulatePressure).toBe(true);
  });

  it('clamps stroke width to at least 1', () => {
    expect(strokeOptions('pen', 0).size).toBeCloseTo(1.8);
    expect(strokeOptions('pen', -5).size).toBeCloseTo(1.8);
  });
});

describe('getSvgPathFromStroke', () => {
  it('returns an empty string for empty input', () => {
    expect(getSvgPathFromStroke([])).toBe('');
    expect(getSvgPathFromStroke(null)).toBe('');
  });

  it('builds a closed quadratic path', () => {
    const path = getSvgPathFromStroke([[0, 0], [10, 0], [10, 10]]);
    expect(path.startsWith('M 0 0 Q')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });
});

describe('freehandPath', () => {
  it('returns an empty string when there are too few points', () => {
    expect(freehandPath([], 'pen', 4)).toBe('');
    expect(freehandPath([5], 'pen', 4)).toBe('');
    expect(freehandPath(null, 'pen', 4)).toBe('');
  });

  it('produces an SVG path for a real stroke', () => {
    const path = freehandPath([0, 0, 10, 10, 20, 5], 'pen', 4);
    expect(path.startsWith('M')).toBe(true);
    expect(path.length).toBeGreaterThan(10);
  });
});

describe('parseSnapshot', () => {
  it('parses a JSON array of shapes', () => {
    expect(parseSnapshot('[{"id":"a"},{"id":"b"}]')).toHaveLength(2);
  });

  it('returns an empty array for null, empty, or malformed input', () => {
    expect(parseSnapshot(null)).toEqual([]);
    expect(parseSnapshot('')).toEqual([]);
    expect(parseSnapshot('not json')).toEqual([]);
  });

  it('returns an empty array when the JSON is not an array', () => {
    expect(parseSnapshot('{"id":"a"}')).toEqual([]);
  });
});

describe('shapesBounds', () => {
  it('falls back to a default viewport when there are no shapes', () => {
    expect(shapesBounds([])).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 700 });
  });

  it('covers rectangles by x/y plus width/height', () => {
    const bounds = shapesBounds([
      { tool: 'rectangle', x: 10, y: 20, width: 100, height: 50 },
    ]);
    expect(bounds).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 });
  });

  it('offsets freehand points by the shape origin', () => {
    const bounds = shapesBounds([
      { tool: 'pen', x: 100, y: 100, points: [0, 0, 50, 25] },
    ]);
    expect(bounds).toEqual({ minX: 100, minY: 100, maxX: 150, maxY: 125 });
  });

  it('uses the sticky-note default size', () => {
    const bounds = shapesBounds([{ tool: 'stickyNote', x: 0, y: 0 }]);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 200, maxY: 150 });
  });

  it('spans a mix of shape types', () => {
    const bounds = shapesBounds([
      { tool: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
      { tool: 'circle', x: 500, y: 400, width: 100, height: 100 },
    ]);
    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(600);
    expect(bounds.maxY).toBe(500);
  });
});

describe('palettes', () => {
  it('exposes five sticky colours and six emoji stamps', () => {
    expect(STICKY_COLORS).toHaveLength(5);
    expect(EMOJI_STAMPS).toHaveLength(6);
    STICKY_COLORS.forEach((c) => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
  });
});
