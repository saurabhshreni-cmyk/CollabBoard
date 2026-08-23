import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WS_URL } from '../config.js';

// Connection status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
export default function useWebSocket({
  roomCode,
  identity,
  onDrawEvent,
  onPresence,
  onStatusChange,
}) {
  const stompClient = useRef(null);
  const [status, setStatus] = useState('connecting');
  const hadConnected = useRef(false);

  const onDrawEventRef = useRef(onDrawEvent);
  const onPresenceRef = useRef(onPresence);
  const onStatusRef = useRef(onStatusChange);

  useEffect(() => {
    onDrawEventRef.current = onDrawEvent;
    onPresenceRef.current = onPresence;
    onStatusRef.current = onStatusChange;
  }, [onDrawEvent, onPresence, onStatusChange]);

  const updateStatus = useCallback((next) => {
    setStatus(next);
    if (onStatusRef.current) onStatusRef.current(next);
  }, []);

  useEffect(() => {
    if (!roomCode || !identity) {
      return undefined;
    }

    const sendJoin = (client) => {
      client.publish({
        destination: `/app/room/${roomCode}/presence`,
        body: JSON.stringify({
          type: 'join',
          userId: identity.userId,
          userName: identity.displayName,
          userColor: identity.userColor,
        }),
      });
    };

    const sendLeave = (client) => {
      try {
        client.publish({
          destination: `/app/room/${roomCode}/presence`,
          body: JSON.stringify({ type: 'leave', userId: identity.userId }),
        });
      } catch {
        // best-effort
      }
    };

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        updateStatus('connected');

        client.subscribe(`/topic/room/${roomCode}`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (onDrawEventRef.current) onDrawEventRef.current(data);
          } catch (err) {
            console.error('Failed to parse draw event', err);
          }
        });

        client.subscribe(`/topic/room/${roomCode}/presence`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (onPresenceRef.current) onPresenceRef.current(data);
          } catch (err) {
            console.error('Failed to parse presence', err);
          }
        });

        sendJoin(client);
        hadConnected.current = true;
      },
      onWebSocketClose: () => {
        updateStatus(hadConnected.current ? 'reconnecting' : 'connecting');
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame.headers['message'], frame.body);
      },
    });

    const handleBeforeUnload = () => sendLeave(client);
    window.addEventListener('beforeunload', handleBeforeUnload);

    client.activate();
    stompClient.current = client;

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      sendLeave(client);
      client.deactivate();
      stompClient.current = null;
      updateStatus('disconnected');
    };
  }, [roomCode, identity, updateStatus]);

  // Returns true when the event was actually published, so callers can fall
  // back to the REST API while the socket is down.
  const sendDrawEvent = useCallback(
    (event) => {
      const client = stompClient.current;
      if (client && client.connected) {
        client.publish({
          destination: `/app/room/${roomCode}/draw`,
          body: JSON.stringify(event),
        });
        return true;
      }
      return false;
    },
    [roomCode]
  );

  return { sendDrawEvent, status };
}
