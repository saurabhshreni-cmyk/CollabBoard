import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHistory from './useHistory.js';

const entry = (name) => ({
  redo: [{ type: 'draw', shape: { id: name } }],
  undo: [{ type: 'delete', shapeIds: [name] }],
});

describe('useHistory', () => {
  it('starts empty with nothing to undo or redo', () => {
    const { result } = renderHook(() => useHistory());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undo()).toBeNull();
    expect(result.current.redo()).toBeNull();
  });

  it('enables undo after an action is recorded', () => {
    const { result } = renderHook(() => useHistory());

    act(() => result.current.record(entry('a')));

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo returns the reversing events and redo the original ones', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.record(entry('a')));

    let undone;
    act(() => { undone = result.current.undo(); });
    expect(undone).toEqual([{ type: 'delete', shapeIds: ['a'] }]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    let redone;
    act(() => { redone = result.current.redo(); });
    expect(redone).toEqual([{ type: 'draw', shape: { id: 'a' } }]);
    expect(result.current.canRedo).toBe(false);
  });

  it('walks back through several actions newest first', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.record(entry('a')));
    act(() => result.current.record(entry('b')));

    let first;
    let second;
    act(() => { first = result.current.undo(); });
    act(() => { second = result.current.undo(); });

    expect(first[0].shapeIds).toEqual(['b']);
    expect(second[0].shapeIds).toEqual(['a']);
  });

  it('a new action discards anything that had been undone', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.record(entry('a')));
    act(() => result.current.record(entry('b')));
    act(() => { result.current.undo(); });

    act(() => result.current.record(entry('c')));

    expect(result.current.canRedo).toBe(false);
    let undone;
    act(() => { undone = result.current.undo(); });
    expect(undone[0].shapeIds).toEqual(['c']);
  });

  it('ignores empty entries', () => {
    const { result } = renderHook(() => useHistory());

    act(() => result.current.record({ undo: [], redo: [] }));
    act(() => result.current.record(null));

    expect(result.current.canUndo).toBe(false);
  });

  it('keeps only the most recent 100 actions', () => {
    const { result } = renderHook(() => useHistory());
    act(() => {
      for (let i = 0; i < 130; i += 1) result.current.record(entry(`s${i}`));
    });

    let undos = 0;
    act(() => {
      while (result.current.undo()) undos += 1;
    });

    expect(undos).toBe(100);
  });

  it('reset forgets everything', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.record(entry('a')));

    act(() => result.current.reset());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
