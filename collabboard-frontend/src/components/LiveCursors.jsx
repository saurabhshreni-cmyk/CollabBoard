import { useEffect, useState } from 'react';

const TOOL_ICONS = {
  select: '↖',
  pen: '✏️',
  highlighter: '🖍',
  rectangle: '▭',
  circle: '◯',
  diamond: '◇',
  triangle: '△',
  arrow: '↗',
  text: 'T',
  stickyNote: '🗒',
  eraser: '◻',
  emoji: '😀',
  laser: '🔴',
};

export default function LiveCursors({ cursors = {}, currentUserId, stageScale, stagePos }) {
  // The name label fades 2s after the last movement. Cursor props only change
  // while a peer is moving, so tick the clock to re-render during the idle
  // window and let the fade actually happen.
  const [, setTick] = useState(0);
  const hasCursors = Object.keys(cursors).length > 0;

  useEffect(() => {
    if (!hasCursors) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, [hasCursors]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {Object.entries(cursors).map(([userId, cursor]) => {
        if (userId === currentUserId || !cursor) return null;
        const screenX = cursor.x * stageScale + stagePos.x;
        const screenY = cursor.y * stageScale + stagePos.y;
        const fresh = cursor.lastMove == null || Date.now() - cursor.lastMove < 2000;
        return (
          <div
            key={userId}
            className="absolute"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
              transition: 'transform 0.05s linear',
              top: 0,
              left: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block' }}>
              <path d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z" fill={cursor.userColor} stroke="#ffffff" strokeWidth="1" />
            </svg>
            <div
              className="flex items-center gap-1 mt-0.5 ml-2 px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
              style={{ backgroundColor: cursor.userColor, opacity: fresh ? 1 : 0, transition: 'opacity 0.4s ease' }}
            >
              <span>{TOOL_ICONS[cursor.tool] || ''}</span>
              <span>{cursor.displayName}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
