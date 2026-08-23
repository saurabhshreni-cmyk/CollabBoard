import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useUserIdentity from '../hooks/useUserIdentity.js';
import useWebSocket from '../hooks/useWebSocket.js';
import useHistory from '../hooks/useHistory.js';
import { getRoom, updateBoardName } from '../api/roomApi.js';
import { parseSnapshot } from '../utils/drawingUtils.js';
import { useToast } from '../context/ToastContext.jsx';
import TopBar from './TopBar.jsx';
import Toolbar from './Toolbar.jsx';
import Canvas from './Canvas.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import ShortcutsModal from './ShortcutsModal.jsx';
import ShareDialog from './ShareDialog.jsx';

const CURSOR_THROTTLE_MS = 30;
const TOOL_KEYS = {
  v: 'select', p: 'pen', h: 'highlighter', l: 'laser', r: 'rectangle',
  o: 'circle', d: 'diamond', g: 'triangle', a: 'arrow', t: 'text',
  s: 'stickyNote', e: 'eraser',
};

export default function WhiteboardRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const identity = useUserIdentity();
  const { showToast } = useToast();
  const history = useHistory();

  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [shapes, setShapes] = useState([]);
  const shapesRef = useRef([]);

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

  const [backgroundColor, setBackgroundColor] = useState('#1a1a2e');
  const [gridVisible, setGridVisible] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [boardName, setBoardName] = useState('Untitled Board');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  const canvasRef = useRef(null);
  const lastCursorSent = useRef(0);
  const cursorTimers = useRef({});
  const laserTimers = useRef({});
  const prevUserIds = useRef(new Set());
  const prevStatus = useRef('connecting');
  const sendRef = useRef(() => {});

  useEffect(() => {
    let active = true;
    setLoading(true);
    getRoom(roomCode)
      .then((data) => {
        if (!active) return;
        setRoomData(data);
        setBoardName(data.boardName || 'Untitled Board');
        const initial = parseSnapshot(data.boardSnapshot);
        shapesRef.current = initial;
        setShapes(initial);
        history.reset(initial);
        setError('');
      })
      .catch((err) => active && setError(err.message || 'Failed to load room'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const commit = useCallback((next, event) => {
    shapesRef.current = next;
    setShapes(next);
    history.push(next);
    if (event) sendRef.current(event);
  }, [history]);

  const addShape = useCallback((shape) => {
    commit([...shapesRef.current, shape], {
      type: 'draw', userId: identity.userId, userName: identity.displayName,
      userColor: identity.userColor, shape, shapeId: shape.id,
    });
  }, [commit, identity]);

  const updateShape = useCallback((shape) => {
    commit(shapesRef.current.map((s) => (s.id === shape.id ? shape : s)), {
      type: 'update', userId: identity.userId, shape, shapeId: shape.id,
    });
  }, [commit, identity]);

  const deleteShapes = useCallback((ids) => {
    const idSet = new Set(ids);
    commit(shapesRef.current.filter((s) => !idSet.has(s.id)), {
      type: 'delete', userId: identity.userId, shapeIds: ids,
    });
  }, [commit, identity]);

  const setRemote = useCallback((next) => {
    shapesRef.current = next;
    setShapes(next);
    history.push(next);
  }, [history]);

  const applyRemote = useCallback((event) => {
    const cur = shapesRef.current;
    switch (event.type) {
      case 'draw':
      case 'erase':
        if (event.shape && !cur.some((s) => s.id === event.shape.id)) setRemote([...cur, event.shape]);
        break;
      case 'update':
        if (event.shape) {
          const exists = cur.some((s) => s.id === event.shape.id);
          setRemote(exists ? cur.map((s) => (s.id === event.shape.id ? event.shape : s)) : [...cur, event.shape]);
        }
        break;
      case 'delete': {
        const ids = new Set(event.shapeIds || (event.shapeId ? [event.shapeId] : []));
        setRemote(cur.filter((s) => !ids.has(s.id)));
        break;
      }
      case 'replace':
      case 'undo':
      case 'redo':
        setRemote(Array.isArray(event.shapes) ? event.shapes : []);
        break;
      case 'clear':
        setRemote([]);
        break;
      default:
        break;
    }
  }, [setRemote]);

  const handleDrawEvent = useCallback((event) => {
    if (!event) return;

    if (event.type === 'rename') {
      // Applied even for our own echo so every client converges on the
      // server-normalised (trimmed / truncated) name.
      setBoardName(event.boardName || 'Untitled Board');
      return;
    }

    if (event.userId === identity.userId && event.type !== 'cursor' && event.type !== 'laser') return;

    if (event.type === 'cursor') {
      if (event.userId === identity.userId) return;
      setCursors((prev) => ({
        ...prev,
        [event.userId]: {
          x: event.cursorX, y: event.cursorY, displayName: event.userName,
          userColor: event.userColor, tool: event.tool, lastMove: Date.now(),
        },
      }));
      clearTimeout(cursorTimers.current[event.userId]);
      cursorTimers.current[event.userId] = setTimeout(() => {
        setCursors((prev) => { const n = { ...prev }; delete n[event.userId]; return n; });
      }, 3000);
      return;
    }

    if (event.type === 'laser') {
      if (event.userId === identity.userId) return;
      setRemoteLasers((prev) => ({
        ...prev,
        [event.userId]: { points: event.points, color: event.userColor || '#ff3b3b' },
      }));
      clearTimeout(laserTimers.current[event.userId]);
      laserTimers.current[event.userId] = setTimeout(() => {
        setRemoteLasers((prev) => { const n = { ...prev }; delete n[event.userId]; return n; });
      }, 3000);
      return;
    }

    applyRemote(event);
  }, [identity, applyRemote]);

  const handlePresence = useCallback((users) => {
    if (!Array.isArray(users)) return;
    setConnectedUsers(users);
    const currentIds = new Set(users.map((u) => u.userId));
    users.forEach((u) => {
      if (u.userId !== identity.userId && !prevUserIds.current.has(u.userId)) {
        showToast(`User joined: ${u.displayName}`, 'info');
      }
    });
    prevUserIds.current = currentIds;
  }, [identity, showToast]);

  const handleStatus = useCallback((next) => {
    setStatus(next);
    if (next === 'reconnecting' && prevStatus.current === 'connected') {
      showToast('Connection lost, reconnecting…', 'error');
    } else if (next === 'connected' && prevStatus.current === 'reconnecting') {
      showToast('Reconnected!', 'success');
    }
    prevStatus.current = next;
  }, [showToast]);

  const { sendDrawEvent } = useWebSocket({
    roomCode, identity,
    onDrawEvent: handleDrawEvent,
    onPresence: handlePresence,
    onStatusChange: handleStatus,
  });
  useEffect(() => { sendRef.current = sendDrawEvent; }, [sendDrawEvent]);

  const handleCursorMove = useCallback((x, y) => {
    const now = Date.now();
    if (now - lastCursorSent.current < CURSOR_THROTTLE_MS) return;
    lastCursorSent.current = now;
    sendDrawEvent({
      type: 'cursor', userId: identity.userId, userName: identity.displayName,
      userColor: identity.userColor, tool, cursorX: x, cursorY: y,
    });
  }, [sendDrawEvent, identity, tool]);

  const handleLaser = useCallback((points) => {
    sendDrawEvent({
      type: 'laser', userId: identity.userId, userName: identity.displayName,
      userColor: identity.userColor, points,
    });
  }, [sendDrawEvent, identity]);

  const handleUndo = useCallback(() => {
    const next = history.undo();
    if (next == null) return;
    shapesRef.current = next;
    setShapes(next);
    sendDrawEvent({ type: 'replace', userId: identity.userId, shapes: next });
  }, [history, sendDrawEvent, identity]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next == null) return;
    shapesRef.current = next;
    setShapes(next);
    sendDrawEvent({ type: 'replace', userId: identity.userId, shapes: next });
  }, [history, sendDrawEvent, identity]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Clear the entire board for everyone?')) return;
    commit([], { type: 'clear', userId: identity.userId });
    setSettingsOpen(false);
    showToast('Board cleared', 'info');
  }, [commit, identity, showToast]);

  const handleRename = useCallback((name) => {
    setBoardName(name);
    // The WebSocket route both persists the name and broadcasts it to peers.
    // If the socket is down, fall back to the REST endpoint so the rename is
    // not lost — peers will pick it up on their next load.
    const sent = sendDrawEvent({ type: 'rename', userId: identity.userId, boardName: name });
    if (!sent) {
      updateBoardName(roomCode, name).catch(() => showToast('Failed to save name', 'error'));
    }
  }, [roomCode, showToast, sendDrawEvent, identity]);

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
    const onKey = (e) => {
      const target = e.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
      if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return; }
      if (ctrl && key === 'a') { e.preventDefault(); setTool('select'); canvasRef.current?.selectAll(); return; }
      if (key === 'delete' || key === 'backspace') { e.preventDefault(); canvasRef.current?.deleteSelection(); return; }
      if (key === 'escape') { canvasRef.current?.deselect(); setSettingsOpen(false); setShortcutsOpen(false); return; }
      if (key === '?' || (e.shiftKey && key === '/')) { setShortcutsOpen((o) => !o); return; }
      if (key === '+' || key === '=') { e.preventDefault(); canvasRef.current?.zoomIn(); return; }
      if (key === '-' || key === '_') { e.preventDefault(); canvasRef.current?.zoomOut(); return; }
      if (key === '0') { canvasRef.current?.resetZoom(); return; }
      if (!ctrl && TOOL_KEYS[key]) { setTool(TOOL_KEYS[key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    const ct = cursorTimers.current;
    const lt = laserTimers.current;
    return () => {
      Object.values(ct).forEach(clearTimeout);
      Object.values(lt).forEach(clearTimeout);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-300">
          <span className="inline-block w-10 h-10 border-indigo-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3, borderStyle: 'solid' }} />
          <span className="text-lg">Connecting to room…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-2">
            {error === 'Room not found' ? 'Room not found' : 'Something went wrong'}
          </h2>
          <p className="text-gray-400 mb-6">
            {error === 'Room not found' ? `We couldn't find a room with code "${roomCode}".` : error}
          </p>
          <button type="button" onClick={() => navigate('/')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      <TopBar
        roomCode={roomCode}
        boardName={boardName}
        onRenameBoard={handleRename}
        onShare={() => setShareOpen(true)}
        connectedUsers={connectedUsers}
        currentUserId={identity.userId}
        zoomPercent={zoomPercent}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onResetZoom={() => canvasRef.current?.resetZoom()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        gridVisible={gridVisible}
        onToggleGrid={() => setGridVisible((g) => !g)}
        onExport={handleExport}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        status={status}
      />

      <div className="flex-1 relative overflow-hidden">
        <Canvas
          ref={canvasRef}
          shapes={shapes}
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
          addShape={addShape}
          updateShape={updateShape}
          deleteShapes={deleteShapes}
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
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        boardName={boardName}
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
