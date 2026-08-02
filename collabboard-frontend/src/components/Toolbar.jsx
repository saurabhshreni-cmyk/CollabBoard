import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { PALETTE } from '../utils/colorUtils.js';
import { STICKY_COLORS, EMOJI_STAMPS } from '../utils/drawingUtils.js';

const TOOLS = [
  { id: 'select', icon: '↖', name: 'Select', key: 'V' },
  { id: 'pen', icon: '✏️', name: 'Pen', key: 'P' },
  { id: 'highlighter', icon: '🖍', name: 'Highlighter', key: 'H' },
  { id: 'laser', icon: '🔴', name: 'Laser', key: 'L' },
  { id: 'rectangle', icon: '▭', name: 'Rectangle', key: 'R' },
  { id: 'circle', icon: '◯', name: 'Circle', key: 'O' },
  { id: 'diamond', icon: '◇', name: 'Diamond', key: 'D' },
  { id: 'triangle', icon: '△', name: 'Triangle', key: 'G' },
  { id: 'arrow', icon: '↗', name: 'Arrow', key: 'A' },
  { id: 'text', icon: 'T', name: 'Text', key: 'T' },
  { id: 'stickyNote', icon: '🗒', name: 'Sticky Note', key: 'S' },
  { id: 'emoji', icon: '😀', name: 'Reaction', key: '' },
  { id: 'eraser', icon: '◻', name: 'Eraser', key: 'E' },
];

function ColorButton({ color, onChange, title }) {
  const [open, setOpen] = useState(false);
  const isTransparent = color === 'transparent';
  return (
    <div className="relative">
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className="w-7 h-7 rounded-md border border-gray-600"
        style={{
          backgroundColor: isTransparent ? 'transparent' : color,
          backgroundImage: isTransparent
            ? 'linear-gradient(45deg,#555 25%,transparent 25%,transparent 75%,#555 75%),linear-gradient(45deg,#555 25%,transparent 25%,transparent 75%,#555 75%)'
            : 'none',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0,4px 4px',
        }}
      />
      {open && (
        <div className="absolute bottom-10 left-0 z-50 bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-xl">
          <HexColorPicker color={isTransparent ? '#ffffff' : color} onChange={onChange} />
          <div className="flex flex-wrap gap-1 mt-2 w-[200px]">
            {PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => onChange(c)} className="w-6 h-6 rounded" style={{ backgroundColor: c }} />
            ))}
            {title.includes('Fill') && (
              <button type="button" onClick={() => onChange('transparent')} className="w-6 h-6 rounded border border-gray-600 text-[10px] text-gray-300">None</button>
            )}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full text-xs text-gray-400 hover:text-white">Close</button>
        </div>
      )}
    </div>
  );
}

export default function Toolbar({
  tool, setTool,
  strokeColor, setStrokeColor,
  fillColor, setFillColor,
  strokeWidth, setStrokeWidth,
  fontSize, setFontSize,
  fontStyle, setFontStyle,
  stickyColor, setStickyColor,
  selectedEmoji, setSelectedEmoji,
}) {
  const isPen = tool === 'pen' || tool === 'highlighter' || tool === 'laser';
  const isShape = ['rectangle', 'circle', 'diamond', 'triangle', 'arrow'].includes(tool);
  const isText = tool === 'text';
  const isSticky = tool === 'stickyNote';
  const isEmoji = tool === 'emoji';
  const hasOptions = isPen || isShape || isText || isSticky || isEmoji;

  const toggleStyle = (token) => {
    const has = fontStyle.includes(token);
    let tokens = fontStyle.split(' ').filter((t) => t && t !== 'normal');
    if (has) tokens = tokens.filter((t) => t !== token);
    else tokens.push(token);
    setFontStyle(tokens.length ? tokens.join(' ') : 'normal');
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
      {hasOptions && (
        <div className="flex items-center gap-3 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2 shadow-xl">
          {(isPen || isShape) && (
            <>
              <span className="text-[11px] text-gray-400">Stroke</span>
              <ColorButton color={strokeColor} onChange={setStrokeColor} title="Stroke color" />
              <input type="range" min={1} max={20} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-24 accent-indigo-500" />
              <span className="text-xs text-gray-300 w-6">{strokeWidth}</span>
            </>
          )}
          {isShape && (
            <>
              <span className="text-[11px] text-gray-400 ml-1">Fill</span>
              <ColorButton color={fillColor} onChange={setFillColor} title="Fill color" />
            </>
          )}
          {isText && (
            <>
              <span className="text-[11px] text-gray-400">Size</span>
              <input type="range" min={12} max={72} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-28 accent-indigo-500" />
              <span className="text-xs text-gray-300 w-8">{fontSize}px</span>
              <button type="button" onClick={() => toggleStyle('bold')} className={`w-7 h-7 rounded font-bold ${fontStyle.includes('bold') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>B</button>
              <button type="button" onClick={() => toggleStyle('italic')} className={`w-7 h-7 rounded italic ${fontStyle.includes('italic') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>i</button>
              <ColorButton color={strokeColor} onChange={setStrokeColor} title="Text color" />
            </>
          )}
          {isSticky && (
            <>
              <span className="text-[11px] text-gray-400">Color</span>
              {STICKY_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setStickyColor(c)} className={`w-6 h-6 rounded ${stickyColor === c ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </>
          )}
          {isEmoji && (
            <>
              <span className="text-[11px] text-gray-400">Stamp</span>
              {EMOJI_STAMPS.map((em) => (
                <button key={em} type="button" onClick={() => setSelectedEmoji(em)} className={`w-8 h-8 rounded text-lg ${selectedEmoji === em ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>{em}</button>
              ))}
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-full px-2 py-1.5 shadow-xl">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={`${t.name}${t.key ? ` (${t.key})` : ''}`}
            onClick={() => setTool(t.id)}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors ${
              tool === t.id ? 'bg-indigo-600 ring-2 ring-indigo-400 text-white' : 'text-gray-200 hover:bg-gray-700'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
