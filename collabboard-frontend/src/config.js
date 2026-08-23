// Where the backend lives.
//
// Hard-coding "localhost" breaks the moment anyone else opens the board: their
// browser resolves localhost to *their* machine, not the host running the API.
// So unless an explicit URL is configured at build time, derive the backend
// from whatever address the page itself was opened on.
//
// Resolution order:
//   1. VITE_API_BASE_URL           — set this for a real deployment
//   2. same-origin (production)    — frontend served by a reverse proxy / nginx
//   3. <current host>:8080 (dev)   — works for localhost *and* LAN peers

const EXPLICIT = import.meta.env.VITE_API_BASE_URL;
const DEV_BACKEND_PORT = 8080;

function resolveApiBase() {
  if (EXPLICIT) return EXPLICIT.replace(/\/$/, '');
  if (typeof window === 'undefined') return `http://localhost:${DEV_BACKEND_PORT}`;

  const { protocol, hostname, port } = window.location;

  // Served from the Vite dev server: the API is a sibling on :8080.
  if (port === '5173' || port === '3000') {
    return `${protocol}//${hostname}:${DEV_BACKEND_PORT}`;
  }

  // Otherwise assume the frontend and API share an origin (nginx / Docker).
  return window.location.origin;
}

export const API_BASE_URL = resolveApiBase();

export const WS_URL =
  import.meta.env.VITE_WS_URL || `${API_BASE_URL}/ws`;

/** The URL to hand to someone else so they land on this same board. */
export function shareableUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.href;
}

/** True when the current page is only reachable from this machine. */
export function isLocalOnly() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}
