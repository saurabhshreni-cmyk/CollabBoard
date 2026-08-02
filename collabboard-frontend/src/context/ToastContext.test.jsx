import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext.jsx';

function Trigger({ message, type }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(message, type)}>
      fire
    </button>
  );
}

function renderWithProvider(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('ToastContext', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('renders nothing until a toast is fired', () => {
    renderWithProvider(<Trigger message="hi" type="info" />);
    expect(screen.queryByText('hi')).toBeNull();
  });

  it('shows a toast when showToast is called', () => {
    renderWithProvider(<Trigger message="Board exported!" type="success" />);
    act(() => screen.getByText('fire').click());
    expect(screen.getByText('Board exported!')).toBeTruthy();
  });

  it('stacks multiple toasts', () => {
    function Multi() {
      const { showToast } = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            showToast('first', 'info');
            showToast('second', 'error');
          }}
        >
          fire
        </button>
      );
    }
    renderWithProvider(<Multi />);
    act(() => screen.getByText('fire').click());
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('second')).toBeTruthy();
  });

  it('auto-dismisses after the default duration', () => {
    renderWithProvider(<Trigger message="bye" type="info" />);
    act(() => screen.getByText('fire').click());
    expect(screen.getByText('bye')).toBeTruthy();

    act(() => vi.advanceTimersByTime(3000 + 300));
    expect(screen.queryByText('bye')).toBeNull();
  });

  it('dismisses when the toast is clicked', () => {
    renderWithProvider(<Trigger message="click me" type="info" />);
    act(() => screen.getByText('fire').click());

    act(() => screen.getByText('click me').parentElement.click());
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByText('click me')).toBeNull();
  });

  it('falls back to the info style for unknown types', () => {
    renderWithProvider(<Trigger message="odd" type="not-a-type" />);
    act(() => screen.getByText('fire').click());
    expect(screen.getByText('odd')).toBeTruthy();
  });

  it('useToast outside a provider is a safe no-op', () => {
    function Bare() {
      const { showToast } = useToast();
      return (
        <button type="button" onClick={() => showToast('nothing')}>
          fire
        </button>
      );
    }
    render(<Bare />);
    expect(() => act(() => screen.getByText('fire').click())).not.toThrow();
  });
});
