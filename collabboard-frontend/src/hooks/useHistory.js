import { useCallback, useRef, useState } from 'react';

const MAX_DEPTH = 50;

/**
 * Snapshot-based history. Each entry is a full shapes array (deep-cloned on
 * push so later mutations don't corrupt earlier snapshots).
 */
export default function useHistory() {
  const stack = useRef([[]]);
  const index = useRef(0);
  const [version, setVersion] = useState(0); // forces re-render for button state

  const bump = () => setVersion((v) => v + 1);

  const reset = useCallback((shapes) => {
    stack.current = [clone(shapes)];
    index.current = 0;
    bump();
  }, []);

  const push = useCallback((shapes) => {
    // Drop any "redo" entries beyond the current pointer.
    const truncated = stack.current.slice(0, index.current + 1);
    truncated.push(clone(shapes));
    // Cap depth.
    while (truncated.length > MAX_DEPTH) {
      truncated.shift();
    }
    stack.current = truncated;
    index.current = truncated.length - 1;
    bump();
  }, []);

  const undo = useCallback(() => {
    if (index.current <= 0) return null;
    index.current -= 1;
    bump();
    return clone(stack.current[index.current]);
  }, []);

  const redo = useCallback(() => {
    if (index.current >= stack.current.length - 1) return null;
    index.current += 1;
    bump();
    return clone(stack.current[index.current]);
  }, []);

  const canUndo = index.current > 0;
  const canRedo = index.current < stack.current.length - 1;

  return { reset, push, undo, redo, canUndo, canRedo, version };
}

function clone(shapes) {
  return Array.isArray(shapes) ? shapes.map((s) => ({ ...s })) : [];
}
