import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import ShareDialog from './ShareDialog.jsx';

vi.mock('../api/roomApi.js', () => ({
  getNetworkAddresses: vi.fn(async () => ['192.168.1.42']),
}));

const { getNetworkAddresses } = await import('../api/roomApi.js');

function setLocation(href) {
  delete window.location;
  window.location = new URL(href);
}

/** Render and let the pending network lookup settle, to keep React quiet. */
async function renderOpen(props = {}) {
  let utils;
  await act(async () => {
    utils = render(<ShareDialog open onClose={() => {}} roomCode="ABC123" {...props} />);
  });
  return utils;
}

const originalLocation = window.location;

describe('ShareDialog', () => {
  beforeEach(() => {
    getNetworkAddresses.mockClear();
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('renders nothing when closed', () => {
    setLocation('http://localhost:5173/room/ABC123');
    const { container } = render(<ShareDialog open={false} onClose={() => {}} roomCode="ABC123" />);
    expect(container.innerHTML).toBe('');
    expect(getNetworkAddresses).not.toHaveBeenCalled();
  });

  it('shows the room code and current link', async () => {
    setLocation('http://localhost:5173/room/ABC123');
    await renderOpen();

    expect(screen.getByText('ABC123')).toBeDefined();
    expect(screen.getByDisplayValue('http://localhost:5173/room/ABC123')).toBeDefined();
  });

  it('warns that a localhost link is not shareable', async () => {
    setLocation('http://localhost:5173/room/ABC123');
    await renderOpen();

    expect(screen.getByText(/only works on this computer/i)).toBeDefined();
  });

  it('offers the real LAN address once the backend reports it', async () => {
    setLocation('http://localhost:5173/room/ABC123');
    await renderOpen();

    await waitFor(() => {
      expect(screen.getByText('http://192.168.1.42:5173/room/ABC123')).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /copy network link/i })).toBeDefined();
  });

  it('does not warn when already on a shareable address', async () => {
    setLocation('https://collabboard.vercel.app/room/ABC123');
    await renderOpen();

    expect(screen.queryByText(/only works on this computer/i)).toBeNull();
    expect(screen.getByText(/this link is shareable/i)).toBeDefined();
  });
});
