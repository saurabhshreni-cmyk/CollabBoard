import { useEffect, useRef, useState } from 'react';

const STATUS_META = {
  connected: { color: 'bg-emerald-500', label: 'Connected' },
  connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Connecting' },
  reconnecting: { color: 'bg-yellow-500 animate-pulse', label: 'Reconnecting' },
  disconnected: { color: 'bg-red-500', label: 'Disconnected' },
};

export default function TopBar({
  roomCode, boardName, onRenameBoard, onShare,
  connectedUsers = [], currentUserId,
  zoomPercent, onZoomIn, onZoomOut, onResetZoom,
  onUndo, onRedo, canUndo, canRedo,
  gridVisible, onToggleGrid,
  onExport, onOpenSettings, onOpenShortcuts, status,
}) {
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(boardName || '');
  const [usersOpen, setUsersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const usersRef = useRef(null);
  const exportRef = useRef(null);

  useEffect(() => setNameDraft(boardName || ''), [boardName]);

  useEffect(() => {
    const onClick = (e) => {
      if (usersRef.current && !usersRef.current.contains(e.target)) setUsersOpen(false);
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = window.location.href;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const commitName = () => {
    setEditingName(false);
    const trimmed = nameDraft.trim() || 'Untitled Board';
    if (trimmed !== boardName) onRenameBoard(trimmed);
  };

  const visible = connectedUsers.slice(0, 5);
  const extra = connectedUsers.length - visible.length;
  const st = STATUS_META[status] || STATUS_META.connecting;

  return (
    <div className="h-14 w-full bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-3 flex-shrink-0 z-40">
      <div className="flex items-center gap-2">
        <span className="font-extrabold text-lg text-indigo-400 select-none">
          Collab<span className="text-white">Board</span>
        </span>
        <span className="flex items-center gap-1" title={st.label}>
          <span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        <span className="bg-gray-800 text-white rounded px-2 py-1 font-mono text-sm tracking-widest">{roomCode}</span>
        <button
          type="button"
          onClick={onShare || handleCopy}
          title="Invite someone to this board"
          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded px-2.5 py-1"
        >
          {onShare ? 'Share' : (copied ? 'Copied!' : 'Copy Link')}
        </button>
        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            maxLength={100}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') { setNameDraft(boardName || ''); setEditingName(false); }
            }}
            className="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
          />
        ) : (
          <button type="button" onClick={() => setEditingName(true)} title="Rename board" className="text-sm text-gray-200 hover:text-white truncate max-w-[200px]">
            {boardName || 'Untitled Board'} ✎
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={usersRef}>
          <button type="button" onClick={() => setUsersOpen((o) => !o)} className="flex items-center -space-x-2">
            {visible.map((u) => (
              <span key={u.userId} title={u.displayName} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-gray-900" style={{ backgroundColor: u.userColor }}>
                {u.displayName ? u.displayName.charAt(0).toUpperCase() : '?'}
              </span>
            ))}
            {extra > 0 && <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gray-700 border-2 border-gray-900">+{extra}</span>}
            {connectedUsers.length === 0 && <span className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900" />}
          </button>
          {usersOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-2 z-50">
              <p className="px-3 pb-1 text-xs text-gray-400">{connectedUsers.length} online</p>
              {connectedUsers.map((u) => (
                <div key={u.userId} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: u.userColor }}>
                    {u.displayName ? u.displayName.charAt(0).toUpperCase() : '?'}
                  </span>
                  <span className="text-sm text-gray-200">{u.displayName}</span>
                  {u.userId === currentUserId && <span className="text-xs text-indigo-400 ml-auto">You</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-700" />

        <div className="flex items-center gap-1">
          <IconBtn title="Zoom out (-)" onClick={onZoomOut}>−</IconBtn>
          <button type="button" onClick={onResetZoom} title="Reset zoom (0)" className="text-xs text-gray-200 hover:bg-gray-700 rounded px-2 py-1 w-12">{zoomPercent}%</button>
          <IconBtn title="Zoom in (+)" onClick={onZoomIn}>+</IconBtn>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        <IconBtn title="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>↶</IconBtn>
        <IconBtn title="Redo (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}>↷</IconBtn>
        <IconBtn title="Toggle grid" onClick={onToggleGrid} active={gridVisible}>▦</IconBtn>

        <div className="relative" ref={exportRef}>
          <IconBtn title="Export" onClick={() => setExportOpen((o) => !o)}>⬇</IconBtn>
          {exportOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50">
              <MenuItem onClick={() => { onExport('image/png'); setExportOpen(false); }}>Export PNG</MenuItem>
              <MenuItem onClick={() => { onExport('image/jpeg'); setExportOpen(false); }}>Export JPEG</MenuItem>
              <MenuItem onClick={() => { onExport('clipboard'); setExportOpen(false); }}>Copy to clipboard</MenuItem>
            </div>
          )}
        </div>

        <IconBtn title="Keyboard shortcuts (?)" onClick={onOpenShortcuts}>⌨</IconBtn>
        <IconBtn title="Settings" onClick={onOpenSettings}>⚙</IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, active }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors ${
        disabled ? 'text-gray-600 cursor-not-allowed' : active ? 'bg-indigo-600 text-white' : 'text-gray-200 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function MenuItem({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700">
      {children}
    </button>
  );
}
