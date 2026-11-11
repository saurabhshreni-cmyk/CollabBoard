// Pure board state transitions.
//
// Every change to the board — made here, received from a collaborator, or
// replayed after a reconnect — goes through `applyBoardEvent`, so all clients
// and the server agree on what each event means. Every operation is
// idempotent: applying the same event twice gives the same board, which is
// what makes replaying events after a resync safe.

/**
 * @typedef {{ id: string, tool: string }} Shape
 * @typedef {{ type: string, shape?: Shape, shapes?: Shape[], shapeId?: string, shapeIds?: string[] }} BoardEvent
 */

export const BOARD_EVENT_TYPES = ['draw', 'update', 'delete', 'replace', 'clear'];

/** Mirrors the limits the server enforces (BoardEventSanitizer). */
export const BoardLimits = Object.freeze({ MAX_TEXT_LENGTH: 5000 });

/**
 * True for events that change the board the server saves.
 * @param {string} type
 */
export function isBoardEvent(type) {
  return BOARD_EVENT_TYPES.includes(type);
}

/**
 * True for events that change what is drawn on screen. That is every saved
 * event plus `preview`: an edit still in progress (text being typed), shown
 * to everyone live but only saved once it is finished.
 * @param {string} type
 */
export function changesBoardView(type) {
  return type === 'preview' || isBoardEvent(type);
}

/** Replaces the shape with the same id in place; appends it only if `add` is set. */
function put(shapes, shape, add) {
  if (!shape || !shape.id) return shapes;
  const exists = shapes.some((s) => s.id === shape.id);
  if (exists) return shapes.map((s) => (s.id === shape.id ? shape : s));
  return add ? [...shapes, shape] : shapes;
}

/**
 * @param {Shape[]} shapes current board (never mutated)
 * @param {BoardEvent} event
 * @returns {Shape[]} the next board; the same array when nothing changed
 */
export function applyBoardEvent(shapes, event) {
  if (!event) return shapes;
  switch (event.type) {
    case 'draw':
      return put(shapes, event.shape, true);
    case 'update':
    case 'preview':
      // Only `draw` creates a shape. An update for one that is gone (someone
      // deleted it while it was being edited) must not bring it back.
      return put(shapes, event.shape, false);
    case 'delete': {
      const ids = new Set(event.shapeIds || (event.shapeId ? [event.shapeId] : []));
      if (ids.size === 0) return shapes;
      const next = shapes.filter((s) => !ids.has(s.id));
      return next.length === shapes.length ? shapes : next;
    }
    case 'replace':
      return Array.isArray(event.shapes) ? event.shapes : shapes;
    case 'clear':
      return shapes.length === 0 ? shapes : [];
    default:
      return shapes;
  }
}

/** @param {Shape[]} shapes @param {BoardEvent[]} events */
export function applyBoardEvents(shapes, events) {
  return events.reduce(applyBoardEvent, shapes);
}

// ---------------------------------------------------------------------------
// History entries.
//
// Undo is per person and operation-based: each entry holds the events that
// redo an action and the events that reverse it. Undoing therefore only
// touches the shapes that action touched, instead of rolling the whole board
// back and wiping out whatever collaborators drew in the meantime.
// ---------------------------------------------------------------------------

/** @param {Shape} shape */
export function addEntry(shape) {
  return {
    redo: [{ type: 'draw', shape }],
    undo: [{ type: 'delete', shapeIds: [shape.id] }],
  };
}

/**
 * @param {Shape[]} before the shapes as they were
 * @param {Shape[]} after the same shapes, changed
 */
export function updateEntry(before, after) {
  return {
    redo: after.map((shape) => ({ type: 'update', shape })),
    undo: before.map((shape) => ({ type: 'update', shape })),
  };
}

/** @param {Shape[]} removed the shapes being deleted */
export function deleteEntry(removed) {
  return {
    redo: [{ type: 'delete', shapeIds: removed.map((s) => s.id) }],
    undo: removed.map((shape) => ({ type: 'draw', shape })),
  };
}

/** @param {Shape[]} removed everything that was on the board */
export function clearEntry(removed) {
  return {
    redo: [{ type: 'clear' }],
    undo: removed.map((shape) => ({ type: 'draw', shape })),
  };
}
