import { useCallback, useMemo, useRef, useState } from 'react';

const MAX_DEPTH = 100;

/**
 * Undo/redo stack of this person's own actions.
 *
 * Each entry is `{ undo: BoardEvent[], redo: BoardEvent[] }` (see
 * utils/boardOps.js). The hook only stores entries and tracks the position;
 * the caller applies and broadcasts the events it gets back.
 */
export default function useHistory() {
  const entries = useRef([]);
  // Number of entries currently "done"; everything past it can be redone.
  const position = useRef(0);
  const [, setVersion] = useState(0); // re-render so canUndo/canRedo update

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const reset = useCallback(() => {
    entries.current = [];
    position.current = 0;
    bump();
  }, [bump]);

  const record = useCallback((entry) => {
    if (!entry || entry.undo.length + entry.redo.length === 0) return;
    // A new action discards anything that had been undone.
    const kept = entries.current.slice(0, position.current);
    const next = [...kept, entry].slice(-MAX_DEPTH);
    entries.current = next;
    position.current = next.length;
    bump();
  }, [bump]);

  /** @returns {object[] | null} events that reverse the last action */
  const undo = useCallback(() => {
    if (position.current <= 0) return null;
    position.current -= 1;
    bump();
    return entries.current[position.current].undo;
  }, [bump]);

  /** @returns {object[] | null} events that re-apply the last undone action */
  const redo = useCallback(() => {
    if (position.current >= entries.current.length) return null;
    const entry = entries.current[position.current];
    position.current += 1;
    bump();
    return entry.redo;
  }, [bump]);

  const canUndo = position.current > 0;
  const canRedo = position.current < entries.current.length;

  return useMemo(
    () => ({ reset, record, undo, redo, canUndo, canRedo }),
    [reset, record, undo, redo, canUndo, canRedo]
  );
}
