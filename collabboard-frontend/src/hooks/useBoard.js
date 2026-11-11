import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useHistory from './useHistory.js';
import { getRoom } from '../api/roomApi.js';
import { parseSnapshot } from '../utils/drawingUtils.js';
import {
  applyBoardEvents, changesBoardView,
  addEntry, updateEntry, deleteEntry, clearEntry,
} from '../utils/boardOps.js';
import { trackSent, acknowledge, pendingEvents, reconcileIncoming } from '../utils/pendingOps.js';

export const DEFAULT_BOARD_NAME = 'Untitled Board';

/**
 * The board's shapes and name, and every way they can change.
 *
 * Local edits are applied immediately, recorded for undo, and handed to
 * `send`. Remote edits are applied as they arrive. `resync` reloads the saved
 * board from the server and then replays whatever happened while the request
 * was in flight, so nothing that arrived in that window is lost.
 *
 * @param {{ roomCode: string, send: (event: object) => boolean, onError: (message: string) => void }} options
 */
export default function useBoard({ roomCode, send, onError }) {
  const history = useHistory();
  const [shapes, setShapes] = useState([]);
  const [boardName, setBoardName] = useState(DEFAULT_BOARD_NAME);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const shapesRef = useRef([]);
  // While a load is in flight: every event applied since it started. null otherwise.
  const replayBuffer = useRef(null);
  const loadToken = useRef(0);
  // This tab's edits the server has not echoed back yet (see utils/pendingOps.js).
  const pending = useRef([]);

  const sendRef = useRef(send);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    sendRef.current = send;
    onErrorRef.current = onError;
  }, [send, onError]);

  const setBoard = useCallback((next) => {
    if (next === shapesRef.current) return;
    shapesRef.current = next;
    setShapes(next);
  }, []);

  const applyEvents = useCallback((events) => {
    if (replayBuffer.current) replayBuffer.current = [...replayBuffer.current, ...events];
    setBoard(applyBoardEvents(shapesRef.current, events));
  }, [setBoard]);

  /** Loads the saved board. Resolves to true on success. */
  const load = useCallback(async () => {
    loadToken.current += 1;
    const token = loadToken.current;
    // Keep an existing buffer: an earlier load may still be in flight.
    // Otherwise start from our own unconfirmed edits: they are on screen
    // already but may not have reached the server before it answers, and
    // without replaying them the reload would silently wipe them out.
    replayBuffer.current = replayBuffer.current || pendingEvents(pending.current, Date.now());
    try {
      const data = await getRoom(roomCode);
      if (token !== loadToken.current) return false; // superseded by a newer load
      setBoard(applyBoardEvents(parseSnapshot(data.boardSnapshot), replayBuffer.current));
      setBoardName(data.boardName || DEFAULT_BOARD_NAME);
      replayBuffer.current = null;
      return true;
    } catch (err) {
      if (token === loadToken.current) replayBuffer.current = null;
      throw err;
    }
  }, [roomCode, setBoard]);

  // Initial load.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    shapesRef.current = [];
    pending.current = [];
    setShapes([]);
    history.reset();
    load()
      .catch((err) => { if (active) setError(err.message || 'Failed to load room'); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      loadToken.current += 1; // abandon any in-flight load for the old room
      replayBuffer.current = null;
    };
    // `history.reset` and `load` are stable for a given room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  /**
   * Reloads the saved board. Pass `{ discardPending: true }` after the server
   * refused one of our edits, so the refused edit is not replayed on top.
   */
  const resync = useCallback((options) => {
    if (options?.discardPending) pending.current = [];
    load().catch(() => onErrorRef.current?.('Could not refresh the board. Some changes may be missing.'));
  }, [load]);

  const dispatch = useCallback((events) => {
    applyEvents(events);
    pending.current = trackSent(pending.current, events, Date.now());
    events.forEach((event) => sendRef.current(event));
  }, [applyEvents]);

  const perform = useCallback((entry) => {
    history.record(entry);
    dispatch(entry.redo);
  }, [history, dispatch]);

  const addShape = useCallback((shape) => perform(addEntry(shape)), [perform]);

  /**
   * Replaces existing shapes with changed versions, as one undoable step.
   *
   * `baseline` is what undo should restore. It defaults to the shapes as they
   * are now; pass the pre-edit versions when the edit was already shown live
   * through `previewShapes`, so undo goes back to before the edit began.
   */
  const updateShapes = useCallback((changed, baseline) => {
    const byId = new Map(shapesRef.current.map((s) => [s.id, s]));
    const after = changed.filter((s) => byId.has(s.id));
    if (after.length === 0) return;
    const baselineById = new Map((baseline || []).map((s) => [s.id, s]));
    const before = after.map((s) => baselineById.get(s.id) || byId.get(s.id));
    const entry = updateEntry(before, after);
    // Always send the final state, but an edit that ended where it started
    // is not worth an undo step.
    if (JSON.stringify(before) !== JSON.stringify(after)) history.record(entry);
    dispatch(entry.redo);
  }, [history, dispatch]);

  /**
   * Shows an edit that is still in progress (typing in a note) to everyone,
   * without adding an undo step for every keystroke. Sent as `preview`, which
   * the server relays but does not save: the finished edit goes through
   * `updateShapes`.
   */
  const previewShapes = useCallback((changed) => {
    const ids = new Set(shapesRef.current.map((s) => s.id));
    const events = changed.filter((s) => ids.has(s.id)).map((shape) => ({ type: 'preview', shape }));
    if (events.length > 0) dispatch(events);
  }, [dispatch]);

  /**
   * Deletes shapes as one undoable step. `baseline` plays the same role as in
   * `updateShapes`: the versions undo should bring back, when the current
   * ones are only a live preview of an unfinished edit.
   */
  const deleteShapes = useCallback((ids, baseline) => {
    const idSet = new Set(ids);
    const removed = shapesRef.current.filter((s) => idSet.has(s.id));
    if (removed.length === 0) return;
    const baselineById = new Map((baseline || []).map((s) => [s.id, s]));
    perform(deleteEntry(removed.map((s) => baselineById.get(s.id) || s)));
  }, [perform]);

  const clear = useCallback(() => {
    if (shapesRef.current.length === 0) return;
    perform(clearEntry(shapesRef.current));
  }, [perform]);

  const undo = useCallback(() => {
    const events = history.undo();
    if (events) dispatch(events);
  }, [history, dispatch]);

  const redo = useCallback(() => {
    const events = history.redo();
    if (events) dispatch(events);
  }, [history, dispatch]);

  /** Applies a board event received from another tab or person. */
  const applyRemote = useCallback((event) => {
    if (!event || !changesBoardView(event.type)) return;
    const current = reconcileIncoming(pending.current, event, Date.now());
    if (current.length > 0) applyEvents(current);
  }, [applyEvents]);

  /** Notes that the server has applied and broadcast one of this tab's own events. */
  const confirmOwn = useCallback((event) => {
    if (event && changesBoardView(event.type)) pending.current = acknowledge(pending.current, event);
  }, []);

  return useMemo(() => ({
    shapes, boardName, setBoardName, loading, error,
    addShape, updateShapes, previewShapes, deleteShapes, clear,
    undo, redo, canUndo: history.canUndo, canRedo: history.canRedo,
    applyRemote, confirmOwn, resync,
  }), [
    shapes, boardName, loading, error,
    addShape, updateShapes, previewShapes, deleteShapes, clear,
    undo, redo, history.canUndo, history.canRedo, applyRemote, confirmOwn, resync,
  ]);
}
