import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoom, getRoom, updateBoardName, getNetworkAddresses, ROOM_NOT_FOUND } from './roomApi.js';

function respond(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
  });
}

describe('roomApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createRoom posts and returns the new room', async () => {
    fetch.mockReturnValueOnce(respond(201, { roomCode: 'ABC123' }));

    const room = await createRoom();

    expect(room.roomCode).toBe('ABC123');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/rooms$/);
    expect(options.method).toBe('POST');
  });

  it('getRoom maps a 404 to the room-not-found message', async () => {
    fetch.mockReturnValueOnce(respond(404, { status: 404, detail: 'Room not found: ZZZZZZ' }));

    await expect(getRoom('ZZZZZZ')).rejects.toThrow(ROOM_NOT_FOUND);
  });

  it('surfaces the server\'s problem detail for other errors', async () => {
    fetch.mockReturnValueOnce(respond(429, { status: 429, detail: 'Too many rooms created.' }));

    await expect(createRoom()).rejects.toMatchObject({ message: 'Too many rooms created.', status: 429 });
  });

  it('falls back to a friendly message when the error has no body', async () => {
    fetch.mockReturnValueOnce(respond(500, undefined));

    await expect(createRoom()).rejects.toThrow('Failed to create a room. Please try again.');
  });

  it('explains an unreachable server instead of leaking a fetch error', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(getRoom('ABC123')).rejects.toMatchObject({
      message: expect.stringContaining('Could not reach the server'),
      status: 0,
    });
  });

  it('escapes the room code in the URL', async () => {
    fetch.mockReturnValueOnce(respond(200, {}));

    await getRoom('a/b?c');

    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/rooms\/a%2Fb%3Fc$/);
  });

  it('updateBoardName sends the name as JSON', async () => {
    fetch.mockReturnValueOnce(respond(200, { boardName: 'Retro' }));

    await updateBoardName('ABC123', 'Retro');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/rooms\/ABC123\/name$/);
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ boardName: 'Retro' });
  });

  it('getNetworkAddresses returns [] when the endpoint is absent', async () => {
    fetch.mockReturnValueOnce(respond(404, { status: 404 }));
    expect(await getNetworkAddresses()).toEqual([]);

    fetch.mockReturnValueOnce(respond(200, { addresses: ['192.168.1.5'] }));
    expect(await getNetworkAddresses()).toEqual(['192.168.1.5']);
  });
});
