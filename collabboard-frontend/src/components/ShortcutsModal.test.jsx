import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ShortcutsModal from './ShortcutsModal.jsx';

describe('ShortcutsModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ShortcutsModal open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists the tool shortcuts when open', () => {
    render(<ShortcutsModal open onClose={() => {}} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    expect(screen.getByText('Pen')).toBeTruthy();
    expect(screen.getByText('Laser pointer')).toBeTruthy();
    expect(screen.getByText('Reset zoom')).toBeTruthy();
  });

  it('documents every drawing tool key', () => {
    render(<ShortcutsModal open onClose={() => {}} />);
    ['V', 'P', 'H', 'L', 'R', 'O', 'D', 'G', 'A', 'T', 'S', 'E'].forEach((key) => {
      expect(screen.getByText(key)).toBeTruthy();
    });
  });

  it('closes via the × button', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal open onClose={onClose} />);
    screen.getByText('×').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not the panel', () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutsModal open onClose={onClose} />);
    const backdrop = container.firstChild;

    screen.getByText('Keyboard Shortcuts').click();
    expect(onClose).not.toHaveBeenCalled();

    backdrop.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
