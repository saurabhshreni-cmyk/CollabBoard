import { v4 as uuidv4 } from 'uuid';
import { getStroke } from 'perfect-freehand';

export const GRID_SIZE = 20;

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return uuidv4();
}

export function snap(value, enabled, size = GRID_SIZE) {
  if (!enabled) return value;
  return Math.round(value / size) * size;
}

export function snapPoint(point, enabled) {
  return { x: snap(point.x, enabled), y: snap(point.y, enabled) };
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

export function parseSnapshot(snapshot) {
  if (!snapshot) return [];
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed : [];
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
      for (let i = 0; i < s.points.length; i += 2) {
        include((s.points[i] || 0) + (s.x || 0), (s.points[i + 1] || 0) + (s.y || 0));
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
