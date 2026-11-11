import { getStroke } from 'perfect-freehand';

export const GRID_SIZE = 20;

// A stroke is sent as one WebSocket message, and the server caps how large a
// message (and a shape) may be. Keeping strokes well under that means a long
// scribble can never be rejected or drop the connection.
export const MAX_STROKE_POINTS = 5000;

/**
 * A random unique id.
 *
 * `crypto.randomUUID` only exists in secure contexts (https or localhost), so
 * it is missing when the board is opened over plain http on a LAN address —
 * exactly the "share on the same WiFi" case. `getRandomValues` works there.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function snap(value, enabled, size = GRID_SIZE) {
  if (!enabled) return value;
  return Math.round(value / size) * size;
}

export function snapPoint(point, enabled) {
  return { x: snap(point.x, enabled), y: snap(point.y, enabled) };
}

/** Two decimals is far below a pixel and roughly halves the JSON size. */
export function roundCoord(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Adds a point to a flat [x1, y1, x2, y2, …] stroke.
 *
 * Returns the same array when the point is closer than `minDistance` to the
 * previous one (mouse events fire far more often than the stroke needs) or
 * when the stroke is already at its maximum length.
 * @param {number[]} points
 * @param {number} x
 * @param {number} y
 * @param {number} [minDistance]
 * @returns {number[]}
 */
export function appendStrokePoint(points, x, y, minDistance = 0) {
  if (points.length >= MAX_STROKE_POINTS * 2) return points;
  if (points.length >= 2) {
    const dx = x - points[points.length - 2];
    const dy = y - points[points.length - 1];
    if (dx * dx + dy * dy < minDistance * minDistance) return points;
  }
  return [...points, roundCoord(x), roundCoord(y)];
}

export function strokeOptions(tool, strokeWidth) {
  const size = Math.max(1, strokeWidth);
  if (tool === 'highlighter') {
    return { size: size * 4, thinning: 0, smoothing: 0.6, streamline: 0.5, simulatePressure: false };
  }
  return { size: size * 1.8, thinning: 0.6, smoothing: 0.5, streamline: 0.5, simulatePressure: true };
}

export function getSvgPathFromStroke(stroke) {
  if (!stroke || stroke.length === 0) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

export function freehandPath(flatPoints, tool, strokeWidth) {
  if (!flatPoints || flatPoints.length < 2) return '';
  const pts = [];
  for (let i = 0; i < flatPoints.length; i += 2) {
    pts.push([flatPoints[i], flatPoints[i + 1]]);
  }
  const outline = getStroke(pts, strokeOptions(tool, strokeWidth));
  return getSvgPathFromStroke(outline);
}

/** Parses a stored board, tolerating anything malformed. */
export function parseSnapshot(snapshot) {
  if (!snapshot) return [];
  try {
    const parsed = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s === 'object' && typeof s.id === 'string');
  } catch {
    return [];
  }
}

export const STICKY_COLORS = ['#FFEAA7', '#FFB3BA', '#B3D9FF', '#B3FFB3', '#E8B3FF'];

export const EMOJI_STAMPS = ['👍', '❤️', '🔥', '✅', '❓', '⭐'];

export function shapesBounds(shapes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const include = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  shapes.forEach((s) => {
    if ((s.tool === 'pen' || s.tool === 'highlighter' || s.tool === 'arrow') && s.points) {
      const sx = s.scaleX ?? 1;
      const sy = s.scaleY ?? 1;
      for (let i = 0; i < s.points.length; i += 2) {
        include((s.points[i] || 0) * sx + (s.x || 0), (s.points[i + 1] || 0) * sy + (s.y || 0));
      }
    } else if (s.tool === 'stickyNote') {
      include(s.x, s.y);
      include(s.x + (s.width || 200), s.y + (s.height || 150));
    } else if (s.width != null && s.height != null) {
      include(s.x, s.y);
      include(s.x + s.width, s.y + s.height);
    } else if (s.x != null && s.y != null) {
      include(s.x, s.y);
      include(s.x + 100, s.y + 40);
    }
  });
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 1000, maxY: 700 };
  return { minX, minY, maxX, maxY };
}
