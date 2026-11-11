import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WS_URL } from '../config.js';
import { isBoardEvent } from '../utils/boardOps.js';

const RECONNECT_DELAY_MS = 3000;
const HEARTBEAT_MS = 10000;
// Changes made while offline wait here and are sent on reconnect. Bounded so a
// very long offline session cannot grow without limit; the oldest are dropped.
const MAX_QUEUED_EVENTS = 2000;
// If the server never echoes our sync marker, resync anyway after this long.
const SYNC_FALLBACK_MS = 5000;

/**
 * Owns the STOMP connection for one room.
 *
 * Connection status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
 *
 * Reliability model:
 *  - Board changes made while the socket is down are queued and flushed, in
 *    order, as soon as it is back.
 *  - After every (re)connect the hook sends a `sync` marker behind the queue.
 *    The server handles one client's messages in order, so when the marker
 *    comes back every queued change has been applied — `onSynced` then tells
 *    the caller it is safe to reload the authoritative board.
 */
export default function useWebSocket({
  roomCode,
  identity,
  onDrawEvent,
  onPresence,
  onStatusChange,
  onSynced,
}) {
  const stompClient = useRef(null);
  const outbox = useRef([]);
  const syncTimer = useRef(null);
  const [status, setStatus] = useState('connecting');
  const hadConnected = useRef(false);

  const handlers = useRef({ onDrawEvent, onPresence, onStatusChange, onSynced });
  useEffect(() => {
    handlers.current = { onDrawEvent, onPresence, onStatusChange, onSynced };
  }, [onDrawEvent, onPresence, onStatusChange, onSynced]);

  const updateStatus = useCallback((next) => {
    setStatus(next);
    handlers.current.onStatusChange?.(next);
  }, []);

  useEffect(() => {
    if (!roomCode || !identity) {
      return undefined;
    }

    const drawDestination = `/app/room/${roomCode}/draw`;
    const presenceDestination = `/app/room/${roomCode}/presence`;
    const stamp = (event) => ({ ...event, userId: identity.userId, clientId: identity.clientId });

    const finishSync = () => {
      if (syncTimer.current === null) return;
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
      handlers.current.onSynced?.();
    };

    // Set when this effect is torn down, so closing the socket on purpose is
    // not reported as a lost connection.
    let closing = false;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: RECONNECT_DELAY_MS,
      heartbeatIncoming: HEARTBEAT_MS,
      heartbeatOutgoing: HEARTBEAT_MS,
      onConnect: () => {
        client.subscribe(`/topic/room/${roomCode}`, (message) => {
          let data;
          try {
            data = JSON.parse(message.body);
          } catch {
            return; // not ours to interpret; ignore the frame
          }
          if (data?.type === 'sync') {
            if (data.clientId === identity.clientId) finishSync();
            return;
          }
          handlers.current.onDrawEvent?.(data);
        });

        client.subscribe(`/topic/room/${roomCode}/presence`, (message) => {
          try {
            handlers.current.onPresence?.(JSON.parse(message.body));
          } catch {
            // ignore a malformed roster frame; the next one replaces it
          }
        });

        client.publish({
          destination: presenceDestination,
          body: JSON.stringify({
            type: 'join',
            userId: identity.userId,
            userName: identity.displayName,
            userColor: identity.userColor,
          }),
        });

        const queued = outbox.current;
        outbox.current = [];
        queued.forEach((event) => {
          client.publish({ destination: drawDestination, body: JSON.stringify(event) });
        });

        clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(finishSync, SYNC_FALLBACK_MS);
        client.publish({ destination: drawDestination, body: JSON.stringify(stamp({ type: 'sync' })) });

        hadConnected.current = true;
        updateStatus('connected');
      },
      onWebSocketClose: () => {
        if (closing) return;
        updateStatus(hadConnected.current ? 'reconnecting' : 'connecting');
      },
    });

    const sendLeave = () => {
      if (!client.connected) return;
      try {
        client.publish({ destination: presenceDestination, body: JSON.stringify({ type: 'leave' }) });
      } catch {
        // Best effort: the server also removes us when the socket closes.
      }
    };

    window.addEventListener('pagehide', sendLeave);
    client.activate();
    stompClient.current = { client, drawDestination, stamp };

    return () => {
      window.removeEventListener('pagehide', sendLeave);
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
      sendLeave();
      closing = true;
      client.deactivate();
      stompClient.current = null;
      outbox.current = [];
      updateStatus('disconnected');
    };
  }, [roomCode, identity, updateStatus]);

  /**
   * Sends an event to the room, stamped with this tab's identity.
   *
   * @returns {boolean} true if it went out now. Board changes that could not
   *   be sent are queued for the next reconnect; anything else (cursors,
   *   lasers, renames) is dropped, so callers can fall back if they need to.
   */
  const sendDrawEvent = useCallback((event) => {
    const connection = stompClient.current;
    if (!connection) return false;
    const stamped = connection.stamp(event);
    if (connection.client.connected) {
      connection.client.publish({ destination: connection.drawDestination, body: JSON.stringify(stamped) });
      return true;
    }
    if (isBoardEvent(event.type)) {
      outbox.current = [...outbox.current, stamped].slice(-MAX_QUEUED_EVENTS);
    }
    return false;
  }, []);

  return { sendDrawEvent, status };
}
