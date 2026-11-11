import { useEffect, useState } from 'react';

const DEFAULT_DELAY_MS = 4000;

/**
 * Becomes true once `pending` has stayed true for a while.
 *
 * Used to explain a long wait: a free-tier backend sleeps when idle and takes
 * up to a minute to answer its first request, which otherwise looks broken.
 *
 * @param {boolean} pending
 * @param {number} [delayMs]
 * @returns {boolean}
 */
export default function useSlowHint(pending, delayMs = DEFAULT_DELAY_MS) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);

  return slow;
}
