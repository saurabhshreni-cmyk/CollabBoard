import { API_BASE_URL } from '../config.js';

// A free-tier backend sleeps when idle and can take most of a minute to wake,
// so the timeout has to be generous or the first visit always fails.
const REQUEST_TIMEOUT_MS = 75_000;

export const ROOM_NOT_FOUND = 'Room not found';

export class ApiError extends Error {
  /** @param {string} message @param {number} status 0 when the server was unreachable */
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, fallbackMessage: string }} options
 */
async function request(path, { method = 'GET', body, fallbackMessage }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // The API reports errors as RFC 7807 problem details.
    throw new ApiError(data?.detail || data?.message || fallbackMessage, response.status);
  }
  return data;
}

export function createRoom() {
  return request('/api/rooms', {
    method: 'POST',
    fallbackMessage: 'Failed to create a room. Please try again.',
  });
}

export async function getRoom(roomCode) {
  try {
    return await request(`/api/rooms/${encodeURIComponent(roomCode)}`, {
      fallbackMessage: 'Failed to load the room. Please try again.',
    });
  } catch (error) {
    if (error.status === 404 || error.status === 400) throw new ApiError(ROOM_NOT_FOUND, 404);
    throw error;
  }
}

export function updateBoardName(roomCode, boardName) {
  return request(`/api/rooms/${encodeURIComponent(roomCode)}/name`, {
    method: 'PUT',
    body: { boardName },
    fallbackMessage: 'Failed to update board name.',
  });
}

/** LAN addresses the backend is reachable on — used by the share dialog. */
export async function getNetworkAddresses() {
  try {
    const data = await request('/api/network', { fallbackMessage: '' });
    return Array.isArray(data?.addresses) ? data.addresses : [];
  } catch {
    // Only exists in the dev profile; a deployed backend answers 404.
    return [];
  }
}
