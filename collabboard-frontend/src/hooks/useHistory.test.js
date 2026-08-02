import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHistory from './useHistory.js';

const shape = (id) => ({ id, tool: 'pen', x: 0, y: 0 });

describe('useHistory', () => {
  it('starts empty with nothing to undo or redo', () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('enables undo after a push', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.push([shape('a')]));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo returns the previous snapshot and redo returns to the newer one', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.push([shape('a')]));
    act(() => result.current.push([shape('a'), shape('b')]));

    let undone;
    act(() => { undone = result.current.undo(); });
    expect(undone).toHaveLength(1);
    expect(result.current.canRedo).toBe(true);

    let redone;
    act(() => { redone = result.current.redo(); });
    expect(redone).toHaveLength(2);
    expect(result.current.canRedo).toBe(false);
  });

  it('returns null when there is nothing left to undo or redo', () => {
    const { result } = renderHook(() => useHistory());
    let out;
    act(() => { out = result.current.undo(); });
    expect(out).toBeNull();
    act(() => { out = result.current.redo(); });
    expect(out).toBeNull();
  });

  it('drops the redo branch once new work is pushed', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.push([shape('a')]));
    act(() => result.current.push([shape('a'), shape('b')]));
    act(() => { result.current.undo(); });
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.push([shape('a'), shape('c')]));
    expect(result.current.canRedo).toBe(false);
  });

  it('reset clears the stack to a single entry', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.push([shape('a')]));
    act(() => result.current.push([shape('a'), shape('b')]));

    act(() => result.current.reset([shape('z')]));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('caps history at 50 entries', () => {
    const { result } = renderHook(() => useHistory());
    act(() => {
      for (let i = 0; i < 80; i++) result.current.push([shape(`s${i}`)]);
    });
    let steps = 0;
    act(() => {
      while (result.current.undo() !== null && steps < 200) steps += 1;
    });
    expect(steps).toBe(49);
  });

  it('snapshots are cloned so later mutations do not corrupt history', () => {
    const { result } = renderHook(() => useHistory());
    const live = [shape('a')];
    act(() => result.current.push(live));
    act(() => result.current.push([...live, shape('b')]));

    live[0].x = 9999;

    let undone;
    act(() => { undone = result.current.undo(); });
    expect(undone[0].x).toBe(0);
  });

  it('treats non-array input as an empty snapshot', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.push([shape('a')]));
    act(() => result.current.push(null));
    let undone;
    act(() => { undone = result.current.undo(); });
    expect(undone).toEqual([{ id: 'a', tool: 'pen', x: 0, y: 0 }]);
  });
});
