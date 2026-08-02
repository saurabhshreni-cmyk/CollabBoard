import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectionToolbar from './SelectionToolbar.jsx';
import { PALETTE } from '../utils/colorUtils.js';

const noop = () => {};

describe('SelectionToolbar', () => {
  it('offers the first six palette colours', () => {
    const { container } = render(
      <SelectionToolbar x={100} y={100} onColor={noop} onStroke={noop} onDelete={noop} />
    );
    const swatches = container.querySelectorAll('button[title^="Color"]');
    expect(swatches).toHaveLength(6);
  });

  it('reports the chosen colour', () => {
    const onColor = vi.fn();
    render(<SelectionToolbar x={0} y={0} onColor={onColor} onStroke={noop} onDelete={noop} />);
    screen.getByTitle(`Color ${PALETTE[1]}`).click();
    expect(onColor).toHaveBeenCalledWith(PALETTE[1]);
  });

  it('reports the chosen stroke width as a number', () => {
    const onStroke = vi.fn();
    render(<SelectionToolbar x={0} y={0} onColor={noop} onStroke={onStroke} onDelete={noop} />);
    fireEvent.change(screen.getByTitle('Stroke width'), { target: { value: '10' } });
    expect(onStroke).toHaveBeenCalledWith(10);
  });

  it('reports deletion', () => {
    const onDelete = vi.fn();
    render(<SelectionToolbar x={0} y={0} onColor={noop} onStroke={noop} onDelete={onDelete} />);
    screen.getByTitle('Delete (Del)').click();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('is positioned above the selection and clamped to the viewport top', () => {
    const { container, rerender } = render(
      <SelectionToolbar x={300} y={200} onColor={noop} onStroke={noop} onDelete={noop} />
    );
    expect(container.firstChild.style.left).toBe('300px');
    expect(container.firstChild.style.top).toBe('148px');

    rerender(<SelectionToolbar x={300} y={10} onColor={noop} onStroke={noop} onDelete={noop} />);
    expect(container.firstChild.style.top).toBe('8px');
  });
});
