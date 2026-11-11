import { useCallback, useState } from 'react';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback; // storage blocked or value unreadable
  }
}

/**
 * `useState` that remembers its value in localStorage, for personal view
 * preferences (grid, background). Falls back to plain state when storage is
 * unavailable.
 *
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {[T, (value: T | ((previous: T) => T)) => void]}
 */
export default function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => read(key, fallback));

  const update = useCallback((next) => {
    setValue((previous) => {
      const resolved = typeof next === 'function' ? next(previous) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Preference just won't survive a reload.
      }
      return resolved;
    });
  }, [key]);

  return [value, update];
}
