import { describe, it, expect } from 'vitest';
import {
  applyBoardEvent, applyBoardEvents, isBoardEvent,
  addEntry, updateEntry, deleteEntry, clearEntry,
} from './boardOps.js';

const shape = (id, extra = {}) => ({ id, tool: 'pen', x: 0, y: 0, ...extra });

describe('applyBoardEvent', () => {
  it('draw appends a new shape without mutating the input', () => {
    const before = [shape('a')];
    const after = applyBoardEvent(before, { type: 'draw', shape: shape('b') });

    expect(after.map((s) => s.id)).toEqual(['a', 'b']);
    expect(before).toHaveLength(1);
  });

  it('draw is idempotent: the same shape twice is still one shape', () => {
    const event = { type: 'draw', shape: shape('a') };
    const once = applyBoardEvent([], event);
    const twice = applyBoardEvent(once, event);

    expect(twice).toHaveLength(1);
  });

  it('update replaces the matching shape in place, keeping z-order', () => {
    const before = [shape('a'), shape('b'), shape('c')];
    const after = applyBoardEvent(before, { type: 'update', shape: shape('b', { x: 99 }) });

    expect(after.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(after[1].x).toBe(99);
  });

  it('update of a shape that no longer exists does not bring it back', () => {
    const before = [shape('a')];
    const after = applyBoardEvent(before, { type: 'update', shape: shape('deleted') });
    expect(after).toBe(before);
  });

  it('delete removes by shapeIds or by a single shapeId', () => {
    const before = [shape('a'), shape('b'), shape('c')];

    expect(applyBoardEvent(before, { type: 'delete', shapeIds: ['a', 'c'] }).map((s) => s.id)).toEqual(['b']);
    expect(applyBoardEvent(before, { type: 'delete', shapeId: 'b' }).map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('returns the very same array when an event changes nothing', () => {
    const before = [shape('a')];

    expect(applyBoardEvent(before, { type: 'delete', shapeIds: ['nope'] })).toBe(before);
    expect(applyBoardEvent(before, { type: 'cursor' })).toBe(before);
    expect(applyBoardEvent(before, { type: 'draw' })).toBe(before);
    expect(applyBoardEvent(before, null)).toBe(before);
  });

  it('replace swaps the whole board and clear empties it', () => {
    const before = [shape('a')];

    expect(applyBoardEvent(before, { type: 'replace', shapes: [shape('x'), shape('y')] })).toHaveLength(2);
    expect(applyBoardEvent(before, { type: 'replace', shapes: 'junk' })).toBe(before);
    expect(applyBoardEvent(before, { type: 'clear' })).toEqual([]);
  });

  it('applyBoardEvents applies events in order', () => {
    const after = applyBoardEvents([], [
      { type: 'draw', shape: shape('a') },
      { type: 'update', shape: shape('a', { x: 5 }) },
      { type: 'draw', shape: shape('b') },
      { type: 'delete', shapeIds: ['b'] },
    ]);

    expect(after).toEqual([shape('a', { x: 5 })]);
  });
});

describe('isBoardEvent', () => {
  it('is true only for events that change the saved board', () => {
    expect(isBoardEvent('draw')).toBe(true);
    expect(isBoardEvent('clear')).toBe(true);
    expect(isBoardEvent('cursor')).toBe(false);
    expect(isBoardEvent('rename')).toBe(false);
    expect(isBoardEvent(undefined)).toBe(false);
  });
});

describe('history entries', () => {
  // The property that matters: redo then undo leaves the board as it was,
  // and never touches shapes the action did not involve.
  const roundTrip = (board, entry) => applyBoardEvents(applyBoardEvents(board, entry.redo), entry.undo);

  it('undoing an add removes only that shape', () => {
    const board = [shape('theirs')];
    const entry = addEntry(shape('mine'));

    expect(applyBoardEvents(board, entry.redo)).toHaveLength(2);
    expect(roundTrip(board, entry)).toEqual(board);
  });

  it('undoing an update restores the previous version', () => {
    const board = [shape('a', { x: 1 }), shape('b')];
    const entry = updateEntry([shape('a', { x: 1 })], [shape('a', { x: 50 })]);

    expect(applyBoardEvents(board, entry.redo)[0].x).toBe(50);
    expect(roundTrip(board, entry)).toEqual(board);
  });

  it('undoing a delete brings the shapes back', () => {
    const board = [shape('a'), shape('b')];
    const entry = deleteEntry([shape('b')]);

    expect(applyBoardEvents(board, entry.redo)).toEqual([shape('a')]);
    expect(roundTrip(board, entry)).toEqual(board);
  });

  it('undoing a clear restores everything that was cleared', () => {
    const board = [shape('a'), shape('b')];
    const entry = clearEntry(board);

    expect(applyBoardEvents(board, entry.redo)).toEqual([]);
    expect(roundTrip(board, entry)).toEqual(board);
  });

  it('undo leaves a collaborator\'s later work alone', () => {
    const entry = addEntry(shape('mine'));
    const withMine = applyBoardEvents([], entry.redo);
    const withTheirs = applyBoardEvent(withMine, { type: 'draw', shape: shape('theirs') });

    expect(applyBoardEvents(withTheirs, entry.undo)).toEqual([shape('theirs')]);
  });
});
