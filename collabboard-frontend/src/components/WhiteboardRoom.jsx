import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router';
import useUserIdentity from '../hooks/useUserIdentity.js';
import useWebSocket from '../hooks/useWebSocket.js';
import useBoard, { DEFAULT_BOARD_NAME } from '../hooks/useBoard.js';
import usePersistentState from '../hooks/usePersistentState.js';
import useSlowHint from '../hooks/useSlowHint.js';
import { updateBoardName, ROOM_NOT_FOUND } from '../api/roomApi.js';
import { useToast } from '../context/ToastContext.jsx';
import TopBar from './TopBar.jsx';
import Toolbar from './Toolbar.jsx';
import Canvas from './Canvas.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import ShortcutsModal from './ShortcutsModal.jsx';
import ShareDialog from './ShareDialog.jsx';

const CURSOR_THROTTLE_MS = 30;
const REMOTE_POINTER_TTL_MS = 3000;
const TOOL_KEYS = {
  v: 'select', p: 'pen', h: 'highlighter', l: 'laser', r: 'rectangle',
  o: 'circle', d: 'diamond', g: 'triangle', a: 'arrow', t: 'text',
  s: 'stickyNote', e: 'eraser',
};

function isTyping(target) {
  return Boolean(target) && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

export default function WhiteboardRoom() {
  const { roomCode: rawCode = '' } = useParams();
  const roomCode = rawCode.toUpperCase();
  const navigate = useNavigate();
  const identity = useUserIdentity();
  const { showToast } = useToast();

  // The socket and the board depend on each other, so the board reaches the
  // socket through a ref that is filled in once the socket hook has run.
  const sendRef = useRef(() => false);
  const send = useCallback((event) => sendRef.current(event), []);
  const reportError = useCallback((message) => showToast(message, 'error'), [showToast]);
  const board = useBoard({ roomCode, send, onError: reportError });
  const { applyRemote, confirmOwn, resync, setBoardName, undo, redo, clear } = board;
  const boardReady = !board.loading && !board.error;

  const [tool, setTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#FF6B6B');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fontSize, setFontSize] = useState(24);
  const [fontStyle, setFontStyle] = useState('normal');
  const [stickyColor, setStickyColor] = useState('#FFEAA7');
  const [selectedEmoji, setSelectedEmoji] = useState('👍');

  const [cursors, setCursors] = useState({});
  const [remoteLasers, setRemoteLasers] = useState({});
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [status, setStatus] = useState('connecting');

  const [backgroundColor, setBackgroundColor] = usePersistentState('cb_background', '#1a1a2e');
  const [gridVisible, setGridVisible] = usePersistentState('cb_grid', true);
  const [snapEnabled, setSnapEnabled] = usePersistentState('cb_snap', false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  const canvasRef = useRef(null);
  const lastCursorSent = useRef(0);
  const cursorTimers = useRef({});
  const laserTimers = useRef({});
  const knownUserIds = useRef(null);
  const prevStatus = useRef('connecting');
  const slowLoad = useSlowHint(board.loading);

  /** Shows a collaborator's cursor or laser, and removes it once it goes quiet. */
  const trackPointer = useCallback((setter, timers, key, value) => {
    setter((prev) => ({ ...prev, [key]: value }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      delete timers.current[key];
      setter((prev) => {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      });
    }, REMOTE_POINTER_TTL_MS);
  }, []);

  const handleDrawEvent = useCallback((event) => {
    if (!event) return;
    const mine = event.clientId === identity.clientId;

    switch (event.type) {
      case 'rename':
        // Applied even for our own echo so every client converges on the
        // server-normalised (trimmed / truncated) name.
        setBoardName(event.boardName || DEFAULT_BOARD_NAME);
        return;
      case 'rejected':
        // The server refused one of our changes; show why and reload the
        // saved board so this tab matches everyone else's again.
        if (mine) {
          showToast(event.reason || 'A change could not be saved.', 'error');
          resync({ discardPending: true });
        }
        return;
      case 'cursor':
        if (mine) return;
        // Keyed by tab, so two tabs of one person each get their own cursor.
        trackPointer(setCursors, cursorTimers, event.clientId || event.userId, {
          x: event.cursorX, y: event.cursorY, displayName: event.userName,
          userColor: event.userColor, tool: event.tool, lastMove: Date.now(),
        });
        return;
      case 'laser':
        if (mine) return;
        trackPointer(setRemoteLasers, laserTimers, event.clientId || event.userId, {
          points: event.points, color: event.userColor || '#ff3b3b',
        });
        return;
      default:
        // Our own events are already on screen; the echo just confirms the
        // server has applied them.
        if (mine) confirmOwn(event);
        else applyRemote(event);
    }
  }, [identity, applyRemote, confirmOwn, resync, setBoardName, showToast, trackPointer]);

  const handlePresence = useCallback((users) => {
    if (!Array.isArray(users)) return;
    setConnectedUsers(users);
    const known = knownUserIds.current;
    // The first roster is who was already here; only later arrivals are news.
    if (known) {
      users
        .filter((u) => u.userId !== identity.userId && !known.has(u.userId))
        .forEach((u) => showToast(`${u.displayName} joined`, 'info'));
    }
    knownUserIds.current = new Set(users.map((u) => u.userId));
  }, [identity, showToast]);

  const handleStatus = useCallback((next) => {
    setStatus(next);
    if (next === 'reconnecting' && prevStatus.current === 'connected') {
      showToast('Connection lost — your changes will be sent when it returns.', 'error');
    } else if (next === 'connected' && prevStatus.current === 'reconnecting') {
      showToast('Reconnected!', 'success');
    }
    prevStatus.current = next;
  }, [showToast]);

  const { sendDrawEvent } = useWebSocket({
    // Connect only once the room is known to exist. Every (re)connect then
    // ends with a resync, which also picks up anything drawn between the
    // first load and the subscription going live.
    roomCode: boardReady ? roomCode : null,
    identity,
    onDrawEvent: handleDrawEvent,
    onPresence: handlePresence,
    onStatusChange: handleStatus,
    onSynced: () => resync(),
  });
  useEffect(() => { sendRef.current = sendDrawEvent; }, [sendDrawEvent]);

  const handleCursorMove = useCallback((x, y) => {
    const now = Date.now();
    if (now - lastCursorSent.current < CURSOR_THROTTLE_MS) return;
    lastCursorSent.current = now;
    sendDrawEvent({
      type: 'cursor', userName: identity.displayName, userColor: identity.userColor,
      tool, cursorX: Math.round(x), cursorY: Math.round(y),
    });
  }, [sendDrawEvent, identity, tool]);

  const handleLaser = useCallback((points) => {
    sendDrawEvent({ type: 'laser', userColor: identity.userColor, points });
  }, [sendDrawEvent, identity]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Clear the entire board for everyone?')) return;
    clear();
    setSettingsOpen(false);
    showToast('Board cleared — Ctrl+Z brings it back', 'info');
  }, [clear, showToast]);

  const handleRename = useCallback((name) => {
    setBoardName(name);
    // The WebSocket route both persists the name and broadcasts it to peers.
    // If the socket is down, fall back to the REST endpoint so the rename is
    // not lost — peers will pick it up on their next load.
    const sent = sendDrawEvent({ type: 'rename', boardName: name });
    if (!sent) {
      updateBoardName(roomCode, name).catch(() => showToast('Failed to save name', 'error'));
    }
  }, [roomCode, showToast, sendDrawEvent, setBoardName]);

  const handleExport = useCallback(async (kind) => {
    if (!canvasRef.current) return;
    if (kind === 'clipboard') {
      const ok = await canvasRef.current.copyImage();
      showToast(ok ? 'Copied to clipboard!' : 'Clipboard not supported', ok ? 'success' : 'error');
    } else {
      canvasRef.current.exportImage(kind);
      showToast('Board exported!', 'success');
    }
  }, [showToast]);

  useEffect(() => {
    document.title = boardReady ? `${board.boardName} · CollabBoard` : 'CollabBoard';
    return () => { document.title = 'CollabBoard'; };
  }, [board.boardName, boardReady]);

  useEffect(() => {
    if (!boardReady) return undefined;
    const onKey = (e) => {
      if (isTyping(e.target)) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (ctrl && key === 'a') { e.preventDefault(); setTool('select'); canvasRef.current?.selectAll(); return; }
      if (ctrl || e.altKey) return; // leave browser shortcuts (Ctrl+R, Ctrl+S…) alone
      if (key === 'delete' || key === 'backspace') { e.preventDefault(); canvasRef.current?.deleteSelection(); return; }
      if (key === 'escape') { canvasRef.current?.deselect(); setSettingsOpen(false); setShortcutsOpen(false); setShareOpen(false); return; }
      if (key === '?') { setShortcutsOpen((o) => !o); return; }
      if (key === '+' || key === '=') { e.preventDefault(); canvasRef.current?.zoomIn(); return; }
      if (key === '-' || key === '_') { e.preventDefault(); canvasRef.current?.zoomOut(); return; }
      if (key === '0') { canvasRef.current?.resetZoom(); return; }
      if (TOOL_KEYS[key]) setTool(TOOL_KEYS[key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [boardReady, undo, redo]);

  useEffect(() => {
    const ct = cursorTimers.current;
    const lt = laserTimers.current;
    return () => {
      Object.values(ct).forEach(clearTimeout);
      Object.values(lt).forEach(clearTimeout);
    };
  }, []);

  // Codes are case-insensitive; keep one canonical URL so shared links match.
  if (rawCode !== roomCode) {
    return <Navigate to={`/room/${roomCode}`} replace />;
  }

  if (board.loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4" role="status">
        <div className="flex flex-col items-center gap-4 text-gray-300 text-center">
          <span className="inline-block w-10 h-10 border-indigo-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3, borderStyle: 'solid' }} />
          <span className="text-lg">Opening board…</span>
          {slowLoad && (
            <span className="text-sm text-gray-500 max-w-xs">
              The server is waking up. On a free hosting plan this can take up to a minute.
            </span>
          )}
        </div>
      </div>
    );
  }

  if (board.error) {
    const notFound = board.error === ROOM_NOT_FOUND;
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">
            {notFound ? 'Room not found' : 'Something went wrong'}
          </h1>
          <p className="text-gray-400 mb-6">
            {notFound ? `We couldn't find a room with code "${roomCode}".` : board.error}
          </p>
          <div className="flex gap-3 justify-center">
            {!notFound && (
              <button type="button" onClick={() => window.location.reload()} className="bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg px-5 py-2.5">
                Try again
              </button>
            )}
            <button type="button" onClick={() => navigate('/')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      <TopBar
        roomCode={roomCode}
        boardName={board.boardName}
        onRenameBoard={handleRename}
        onShare={() => setShareOpen(true)}
        connectedUsers={connectedUsers}
        currentUserId={identity.userId}
        zoomPercent={zoomPercent}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onResetZoom={() => canvasRef.current?.resetZoom()}
        onUndo={undo}
        onRedo={redo}
        canUndo={board.canUndo}
        canRedo={board.canRedo}
        gridVisible={gridVisible}
        onToggleGrid={() => setGridVisible((g) => !g)}
        onExport={handleExport}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        status={status}
      />

      <main className="flex-1 relative overflow-hidden">
        <Canvas
          ref={canvasRef}
          shapes={board.shapes}
          tool={tool}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={strokeWidth}
          fontSize={fontSize}
          fontStyle={fontStyle}
          stickyColor={stickyColor}
          selectedEmoji={selectedEmoji}
          identity={identity}
          gridVisible={gridVisible}
          snapEnabled={snapEnabled}
          backgroundColor={backgroundColor}
          cursors={cursors}
          remoteLasers={remoteLasers}
          addShape={board.addShape}
          updateShapes={board.updateShapes}
          previewShapes={board.previewShapes}
          onToolChange={setTool}
          deleteShapes={board.deleteShapes}
          onCursorMove={handleCursorMove}
          onLaser={handleLaser}
          onZoomChange={(scale) => setZoomPercent(Math.round(scale * 100))}
        />

        <Toolbar
          tool={tool}
          setTool={setTool}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          fillColor={fillColor}
          setFillColor={setFillColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          fontSize={fontSize}
          setFontSize={setFontSize}
          fontStyle={fontStyle}
          setFontStyle={setFontStyle}
          stickyColor={stickyColor}
          setStickyColor={setStickyColor}
          selectedEmoji={selectedEmoji}
          setSelectedEmoji={setSelectedEmoji}
        />
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        boardName={board.boardName}
        onRenameBoard={handleRename}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        gridVisible={gridVisible}
        setGridVisible={setGridVisible}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        onClear={handleClear}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} roomCode={roomCode} />
    </div>
  );
}
