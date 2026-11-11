import { describe, it, expect } from 'vitest';
import {
  PENDING_TTL_MS, trackSent, acknowledge, pendingEvents, prunePending, reconcileIncoming,
} from './pendingOps.js';
import { applyBoardEvent } from './boardOps.js';

const shape = (id, extra = {}) => ({ id, tool: 'pen', ...extra });
const update = (id, extra) => ({ type: 'update', shape: shape(id, extra) });
const draw = (id) => ({ type: 'draw', shape: shape(id) });
const del = (...ids) => ({ type: 'delete', shapeIds: ids });
const NOW = 1_000_000;

describe('tracking unconfirmed edits', () => {
  it('records sent events and removes them when the echo arrives', () => {
    const sent = trackSent([], [update('a'), update('b')], NOW);
    expect(pendingEvents(sent, NOW)).toHaveLength(2);

    const afterEcho = acknowledge(sent, update('a', { fromServer: true }));
    expect(pendingEvents(afterEcho, NOW)).toEqual([update('b')]);
  });

  it('confirms one event per echo, oldest first', () => {
    const sent = trackSent([], [update('a', { x: 1 }), update('a', { x: 2 })], NOW);

    const afterFirstEcho = acknowledge(sent, update('a'));

    expect(pendingEvents(afterFirstEcho, NOW)).toEqual([update('a', { x: 2 })]);
  });

  it('ignores an echo that matches nothing and never mutates its input', () => {
    const sent = trackSent([], [update('a')], NOW);

    expect(acknowledge(sent, del('zzz'))).toBe(sent);
    expect(sent).toHaveLength(1);
  });

  it('forgets edits that were never confirmed, so a lost message cannot block a shape forever', () => {
    const sent = trackSent([], [update('a')], NOW);

    expect(prunePending(sent, NOW + PENDING_TTL_MS - 1)).toHaveLength(1);
    expect(prunePending(sent, NOW + PENDING_TTL_MS)).toHaveLength(0);
    expect(reconcileIncoming(sent, update('a'), NOW + PENDING_TTL_MS)).toEqual([update('a')]);
  });
});

describe('reconcileIncoming', () => {
  it('passes everything through when nothing is unconfirmed', () => {
    const event = update('a');
    expect(reconcileIncoming([], event, NOW)).toEqual([event]);
  });

  it('drops an incoming edit to a shape we have an unconfirmed edit for', () => {
    const pending = trackSent([], [update('a', { text: 'mine' })], NOW);

    expect(reconcileIncoming(pending, update('a', { text: 'theirs' }), NOW)).toEqual([]);
    expect(reconcileIncoming(pending, { type: 'preview', shape: shape('a') }, NOW)).toEqual([]);
    expect(reconcileIncoming(pending, update('other'), NOW)).toEqual([update('other')]);
  });

  it('lets a delete through even while we are editing that shape', () => {
    const pending = trackSent([], [update('a')], NOW);

    expect(reconcileIncoming(pending, del('a'), NOW)).toEqual([del('a')]);
  });

  it('keeps a shape we are re-adding out of an incoming delete', () => {
    const pending = trackSent([], [draw('a')], NOW);

    expect(reconcileIncoming(pending, del('a'), NOW)).toEqual([]);
    expect(reconcileIncoming(pending, del('a', 'b'), NOW)[0].shapeIds).toEqual(['b']);
  });

  it('after someone clears the board, a stroke I just drew survives, as it will on the server', () => {
    const pending = trackSent([], [draw('mine'), update('old')], NOW);
    const board = [shape('old'), shape('mine')];

    const events = reconcileIncoming(pending, { type: 'clear' }, NOW);
    const after = events.reduce(applyBoardEvent, board);

    // The stroke is re-added; the update to a cleared shape does not revive it.
    expect(after).toEqual([shape('mine')]);
  });
});

describe('two people editing one shape at the same moment', () => {
  // Simulates the real flow: each client applies its own edit at once, the
  // server applies both in arrival order and broadcasts them to everyone.
  function simulate(serverOrder) {
    const start = [shape('note', { text: '' })];
    const edits = { alice: update('note', { text: 'from alice' }), bob: update('note', { text: 'from bob' }) };

    const clients = {};
    for (const name of ['alice', 'bob']) {
      clients[name] = {
        shapes: applyBoardEvent(start, edits[name]),
        pending: trackSent([], [edits[name]], NOW),
      };
    }
    let server = start;

    for (const sender of serverOrder) {
      server = applyBoardEvent(server, edits[sender]);
      for (const [name, client] of Object.entries(clients)) {
        if (name === sender) {
          client.pending = acknowledge(client.pending, edits[sender]);
        } else {
          client.shapes = reconcileIncoming(client.pending, edits[sender], NOW)
            .reduce(applyBoardEvent, client.shapes);
        }
      }
    }
    return { server, alice: clients.alice.shapes, bob: clients.bob.shapes };
  }

  it.each([[['alice', 'bob']], [['bob', 'alice']]])('everyone ends up with what the server saved (%j)', (order) => {
    const { server, alice, bob } = simulate(order);

    expect(alice).toEqual(server);
    expect(bob).toEqual(server);
    expect(server[0].text).toBe(`from ${order[1]}`);
  });
});
