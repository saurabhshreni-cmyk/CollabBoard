// Tracking of this tab's own edits that the server has not confirmed yet.
//
// Edits are applied locally the moment they are made (so drawing feels
// instant) and confirmed when the server broadcasts them back. Until then the
// server may still be processing somebody else's edit to the same shape — and
// since the server applies events in the order it receives them, an
// unconfirmed edit of ours will land *after* anything that reaches us first.
//
// That gives a simple rule for staying identical to the server: while one of
// our edits to a shape is unconfirmed, an incoming edit to that shape is
// already out of date and must not overwrite ours. Without it, two people
// changing one shape at the same moment each end up showing the other's
// version, and never agree again.
//
// All functions are pure: they return a new list and never modify their input.

/** An edit that is never confirmed (dropped connection) stops counting after this long. */
export const PENDING_TTL_MS = 10_000;

/**
 * @typedef {{ type: string, shape?: { id: string }, shapeIds?: string[], shapeId?: string }} BoardEvent
 * @typedef {{ event: BoardEvent, at: number }} Pending
 */

/** Identifies an event well enough to match it with its echo from the server. */
function eventKey(event) {
  const ids = event.shape?.id ?? (event.shapeIds || (event.shapeId ? [event.shapeId] : [])).join(',');
  return `${event.type}:${ids}`;
}

function shapeIdsOf(event) {
  if (event.shape?.id) return [event.shape.id];
  return event.shapeIds || (event.shapeId ? [event.shapeId] : []);
}

/** @param {Pending[]} pending @param {number} now */
export function prunePending(pending, now) {
  const fresh = pending.filter((p) => now - p.at < PENDING_TTL_MS);
  return fresh.length === pending.length ? pending : fresh;
}

/** Records events this tab has just sent. */
export function trackSent(pending, events, now) {
  return [...prunePending(pending, now), ...events.map((event) => ({ event, at: now }))];
}

/** Removes the oldest pending entry that an echo from the server confirms. */
export function acknowledge(pending, echo) {
  const key = eventKey(echo);
  const index = pending.findIndex((p) => eventKey(p.event) === key);
  return index === -1 ? pending : [...pending.slice(0, index), ...pending.slice(index + 1)];
}

/** The unconfirmed events themselves, oldest first. */
export function pendingEvents(pending, now) {
  return prunePending(pending, now).map((p) => p.event);
}

/**
 * Trims an incoming event from someone else down to the part that is still
 * current, given this tab's unconfirmed edits.
 *
 * - draw / update of a shape we have an unconfirmed edit for: dropped — ours
 *   reaches the server later and wins.
 * - delete: always applies, except for a shape we are re-adding (an
 *   unconfirmed draw, e.g. undoing our own delete), which will exist again
 *   once ours lands.
 * - clear / replace: applied, followed by our unconfirmed edits again, since
 *   the server will apply those on top of the cleared board too.
 *
 * @param {Pending[]} pending
 * @param {BoardEvent} event
 * @param {number} now
 * @returns {BoardEvent[]} the events to apply, in order; empty for nothing
 */
export function reconcileIncoming(pending, event, now) {
  const active = prunePending(pending, now);
  if (active.length === 0) return [event];

  if (event.type === 'clear' || event.type === 'replace') {
    return [event, ...active.map((p) => p.event)];
  }

  if (event.type === 'draw' || event.type === 'update' || event.type === 'preview') {
    const id = event.shape?.id;
    const superseded = active.some((p) => shapeIdsOf(p.event).includes(id));
    return superseded ? [] : [event];
  }

  if (event.type === 'delete') {
    const readding = new Set(
      active.filter((p) => p.event.type === 'draw').flatMap((p) => shapeIdsOf(p.event))
    );
    const ids = shapeIdsOf(event).filter((id) => !readding.has(id));
    if (ids.length === 0) return [];
    return [ids.length === shapeIdsOf(event).length ? event : { ...event, shapeId: undefined, shapeIds: ids }];
  }

  return [event];
}
