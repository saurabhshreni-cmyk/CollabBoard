import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useBoard from './useBoard.js';
import { getRoom } from '../api/roomApi.js';

vi.mock('../api/roomApi.js', () => ({ getRoom: vi.fn() }));

const shape = (id, extra = {}) => ({ id, tool: 'pen', x: 0, y: 0, ...extra });
const room = (shapes, boardName = 'Sprint') => ({ boardName, boardSnapshot: JSON.stringify(shapes) });

/** A promise the test resolves by hand, to control when a load finishes. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function setup(initialShapes = []) {
  getRoom.mockResolvedValueOnce(room(initialShapes));
  const send = vi.fn(() => true);
  const onError = vi.fn();
  const hook = renderHook(() => useBoard({ roomCode: 'ABC123', send, onError }));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...hook, send, onError };
}

const ids = (result) => result.current.shapes.map((s) => s.id);

describe('useBoard', () => {
  beforeEach(() => {
    getRoom.mockReset();
  });

  it('loads the saved board and its name', async () => {
    const { result } = await setup([shape('a'), shape('b')]);

    expect(ids(result)).toEqual(['a', 'b']);
    expect(result.current.boardName).toBe('Sprint');
    expect(result.current.error).toBe('');
  });

  it('reports a load failure instead of showing an empty board as if it were real', async () => {
    getRoom.mockRejectedValueOnce(new Error('Room not found'));
    const { result } = renderHook(() => useBoard({ roomCode: 'NOPE00', send: vi.fn(), onError: vi.fn() }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Room not found');
  });

  it('adding a shape applies it locally, sends it, and can be undone', async () => {
    const { result, send } = await setup();

    act(() => result.current.addShape(shape('a')));
    expect(ids(result)).toEqual(['a']);
    expect(send).toHaveBeenLastCalledWith({ type: 'draw', shape: shape('a') });
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(ids(result)).toEqual([]);
    expect(send).toHaveBeenLastCalledWith({ type: 'delete', shapeIds: ['a'] });

    act(() => result.current.redo());
    expect(ids(result)).toEqual(['a']);
  });

  it('updating several shapes is one undoable step', async () => {
    const { result } = await setup([shape('a'), shape('b')]);

    act(() => result.current.updateShapes([shape('a', { color: 'red' }), shape('b', { color: 'red' })]));
    expect(result.current.shapes.every((s) => s.color === 'red')).toBe(true);

    act(() => result.current.undo());
    expect(result.current.shapes.some((s) => s.color === 'red')).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it('ignores updates and deletes for shapes that no longer exist', async () => {
    const { result, send } = await setup([shape('a')]);

    act(() => result.current.updateShapes([shape('gone', { x: 5 })]));
    act(() => result.current.deleteShapes(['gone']));

    expect(send).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
  });

  it('undo only reverses my own action, not what a collaborator drew since', async () => {
    const { result } = await setup();

    act(() => result.current.addShape(shape('mine')));
    act(() => result.current.applyRemote({ type: 'draw', shape: shape('theirs') }));
    act(() => result.current.undo());

    expect(ids(result)).toEqual(['theirs']);
  });

  it('remote changes are applied but are not added to my undo history', async () => {
    const { result, send } = await setup();

    act(() => result.current.applyRemote({ type: 'draw', shape: shape('theirs') }));

    expect(ids(result)).toEqual(['theirs']);
    expect(result.current.canUndo).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('typing in a note is shared live without creating undo steps', async () => {
    const { result, send } = await setup([shape('note', { text: '' })]);

    act(() => result.current.previewShapes([shape('note', { text: 'H' })]));
    act(() => result.current.previewShapes([shape('note', { text: 'Hi' })]));

    expect(result.current.shapes[0].text).toBe('Hi');
    expect(send).toHaveBeenCalledTimes(2);
    // `preview` is relayed to everyone but not saved by the server.
    expect(send).toHaveBeenLastCalledWith({ type: 'preview', shape: shape('note', { text: 'Hi' }) });
    expect(result.current.canUndo).toBe(false);
  });

  it('undo after a live-previewed edit restores the text from before editing began', async () => {
    const original = shape('note', { text: 'old' });
    const { result } = await setup([original]);

    act(() => result.current.previewShapes([shape('note', { text: 'new te' })]));
    act(() => result.current.updateShapes([shape('note', { text: 'new text' })], [original]));
    expect(result.current.shapes[0].text).toBe('new text');

    act(() => result.current.undo());

    expect(result.current.shapes[0].text).toBe('old');
    expect(result.current.canUndo).toBe(false);
  });

  it('an edit that ends where it started is sent but adds no undo step', async () => {
    const original = shape('note', { text: 'same' });
    const { result, send } = await setup([original]);

    act(() => result.current.previewShapes([shape('note', { text: 'same!' })]));
    act(() => result.current.updateShapes([original], [original]));

    expect(send).toHaveBeenLastCalledWith({ type: 'update', shape: original });
    expect(result.current.canUndo).toBe(false);
  });

  it('previews for a shape someone else deleted are dropped', async () => {
    const { result, send } = await setup();

    act(() => result.current.previewShapes([shape('gone', { text: 'x' })]));

    expect(send).not.toHaveBeenCalled();
    expect(result.current.shapes).toEqual([]);
  });

  it('an incoming edit does not overwrite my unconfirmed edit to the same shape', async () => {
    const { result } = await setup([shape('note', { text: '' })]);

    act(() => result.current.updateShapes([shape('note', { text: 'mine' })]));
    // Reached us before our own echo, so the server applied it first.
    act(() => result.current.applyRemote({ type: 'update', shape: shape('note', { text: 'theirs' }) }));
    expect(result.current.shapes[0].text).toBe('mine');

    // Once ours is confirmed, later edits from others apply normally.
    act(() => result.current.confirmOwn({ type: 'update', shape: shape('note', { text: 'mine' }) }));
    act(() => result.current.applyRemote({ type: 'update', shape: shape('note', { text: 'theirs again' }) }));
    expect(result.current.shapes[0].text).toBe('theirs again');
  });

  it('shows text another person is typing', async () => {
    const { result } = await setup([shape('note', { text: '' })]);

    act(() => result.current.applyRemote({ type: 'preview', shape: shape('note', { text: 'their draft' }) }));

    expect(result.current.shapes[0].text).toBe('their draft');
    expect(result.current.canUndo).toBe(false);
  });

  it('a shape deleted by someone else stays deleted while I am still typing in it', async () => {
    const { result } = await setup([shape('note', { text: '' })]);

    act(() => result.current.previewShapes([shape('note', { text: 'typ' })]));
    act(() => result.current.applyRemote({ type: 'delete', shapeIds: ['note'] }));
    act(() => result.current.previewShapes([shape('note', { text: 'typing' })]));

    expect(result.current.shapes).toEqual([]);
  });

  it('resync keeps my edit that the server had not saved yet when it answered', async () => {
    const { result } = await setup([shape('a')]);
    act(() => result.current.addShape(shape('just-drawn')));
    // The snapshot was read before the server processed that stroke.
    getRoom.mockResolvedValueOnce(room([shape('a')]));

    act(() => result.current.resync());

    await waitFor(() => expect(getRoom).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(ids(result)).toEqual(['a', 'just-drawn']);
  });

  it('resync after a rejection does not replay the rejected edit', async () => {
    const { result } = await setup([shape('a')]);
    act(() => result.current.addShape(shape('rejected')));
    getRoom.mockResolvedValueOnce(room([shape('a')]));

    act(() => result.current.resync({ discardPending: true }));

    await waitFor(() => expect(ids(result)).toEqual(['a']));
  });

  it('undoing the deletion of an emptied label restores its original text', async () => {
    const original = shape('label', { tool: 'text', text: 'Hello' });
    const { result } = await setup([original]);

    act(() => result.current.previewShapes([{ ...original, text: '' }]));
    act(() => result.current.deleteShapes(['label'], [original]));
    expect(result.current.shapes).toEqual([]);

    act(() => result.current.undo());

    expect(result.current.shapes).toEqual([original]);
  });

  it('clearing the board can be undone', async () => {
    const { result, send } = await setup([shape('a'), shape('b')]);

    act(() => result.current.clear());
    expect(ids(result)).toEqual([]);
    expect(send).toHaveBeenLastCalledWith({ type: 'clear' });

    act(() => result.current.undo());
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('resync replaces the board with what the server saved', async () => {
    const { result } = await setup([shape('stale')]);
    getRoom.mockResolvedValueOnce(room([shape('fresh')], 'Renamed'));

    act(() => result.current.resync());

    await waitFor(() => expect(ids(result)).toEqual(['fresh']));
    expect(result.current.boardName).toBe('Renamed');
  });

  it('resync keeps changes that arrived while the reload was in flight', async () => {
    const { result } = await setup([shape('a')]);
    const pending = deferred();
    getRoom.mockReturnValueOnce(pending.promise);

    act(() => result.current.resync());
    // Both of these happen after the server took its snapshot.
    act(() => result.current.applyRemote({ type: 'draw', shape: shape('theirs') }));
    act(() => result.current.addShape(shape('mine')));

    await act(async () => { pending.resolve(room([shape('a'), shape('b')])); });

    expect(ids(result)).toEqual(['a', 'b', 'theirs', 'mine']);
  });

  it('a failed resync keeps the current board and reports the problem', async () => {
    const { result, onError } = await setup([shape('a')]);
    getRoom.mockRejectedValueOnce(new Error('offline'));

    act(() => result.current.resync());

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(ids(result)).toEqual(['a']);
  });

  it('when two reloads overlap only the newest result is used', async () => {
    const { result } = await setup();
    const first = deferred();
    const second = deferred();
    getRoom.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    act(() => result.current.resync());
    act(() => result.current.resync());
    await act(async () => { second.resolve(room([shape('new')])); });
    await act(async () => { first.resolve(room([shape('old')])); });

    expect(ids(result)).toEqual(['new']);
  });
});
