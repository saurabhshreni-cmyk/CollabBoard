import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from './TopBar.jsx';

function setup(props = {}) {
  const onRenameBoard = vi.fn();
  const utils = render(
    <TopBar
      roomCode="ABC123"
      boardName="Untitled Board"
      onRenameBoard={onRenameBoard}
      connectedUsers={[]}
      currentUserId="u1"
      zoomPercent={100}
      onZoomIn={() => {}}
      onZoomOut={() => {}}
      onResetZoom={() => {}}
      onUndo={() => {}}
      onRedo={() => {}}
      canUndo={false}
      canRedo={false}
      gridVisible
      onToggleGrid={() => {}}
      onExport={() => {}}
      onOpenSettings={() => {}}
      onOpenShortcuts={() => {}}
      status="connected"
      {...props}
    />
  );
  return { onRenameBoard, ...utils };
}

function startEditing() {
  fireEvent.click(screen.getByTitle('Rename board'));
  return screen.getByDisplayValue('Untitled Board');
}

describe('TopBar', () => {
  it('renders the room code and current board name', () => {
    setup({ boardName: 'Sprint Retro' });
    expect(screen.getByText('ABC123')).toBeDefined();
    expect(screen.getByTitle('Rename board').textContent).toContain('Sprint Retro');
  });

  it('commits a rename on Enter', () => {
    const { onRenameBoard } = setup();
    const input = startEditing();

    fireEvent.change(input, { target: { value: 'Sprint Retro' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameBoard).toHaveBeenCalledWith('Sprint Retro');
  });

  it('commits a rename on blur', () => {
    const { onRenameBoard } = setup();
    const input = startEditing();

    fireEvent.change(input, { target: { value: 'Design Jam' } });
    fireEvent.blur(input);

    expect(onRenameBoard).toHaveBeenCalledWith('Design Jam');
  });

  it('falls back to the default name when the draft is blank', () => {
    const { onRenameBoard } = setup({ boardName: 'Sprint Retro' });
    fireEvent.click(screen.getByTitle('Rename board'));
    const input = screen.getByDisplayValue('Sprint Retro');

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameBoard).toHaveBeenCalledWith('Untitled Board');
  });

  it('does not fire a rename when the name is unchanged', () => {
    const { onRenameBoard } = setup();
    const input = startEditing();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameBoard).not.toHaveBeenCalled();
  });

  it('discards the draft on Escape', () => {
    const { onRenameBoard } = setup();
    const input = startEditing();

    fireEvent.change(input, { target: { value: 'Throwaway' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRenameBoard).not.toHaveBeenCalled();
    expect(screen.getByTitle('Rename board').textContent).toContain('Untitled Board');
  });

  it('picks up a board name pushed in from a collaborator', () => {
    const { rerender } = setup();
    expect(screen.getByTitle('Rename board').textContent).toContain('Untitled Board');

    rerender(
      <TopBar
        roomCode="ABC123"
        boardName="Renamed By Peer"
        onRenameBoard={() => {}}
        connectedUsers={[]}
        currentUserId="u1"
        zoomPercent={100}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        canUndo={false}
        canRedo={false}
        gridVisible
        onToggleGrid={() => {}}
        onExport={() => {}}
        onOpenSettings={() => {}}
        onOpenShortcuts={() => {}}
        status="connected"
      />
    );

    expect(screen.getByTitle('Rename board').textContent).toContain('Renamed By Peer');
  });

  it('shows the connection status indicator', () => {
    setup({ status: 'reconnecting' });
    expect(screen.getByTitle('Reconnecting')).toBeDefined();
  });
});
