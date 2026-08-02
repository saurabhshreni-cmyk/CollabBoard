import { PALETTE } from '../utils/colorUtils.js';

// Floating toolbar shown above the current selection.
export default function SelectionToolbar({ x, y, onColor, onStroke, onDelete }) {
  return (
    <div
      className="absolute z-30 flex items-center gap-2 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg px-2 py-1.5 shadow-xl"
      style={{
        left: x,
        top: Math.max(8, y - 52),
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex items-center gap-1">
        {PALETTE.slice(0, 6).map((c) => (
          <button
            key={c}
            type="button"
            title={`Color ${c}`}
            onClick={() => onColor(c)}
            className="w-5 h-5 rounded-full border border-gray-600 hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="w-px h-5 bg-gray-700" />
      <select
        onChange={(e) => onStroke(Number(e.target.value))}
        defaultValue=""
        className="bg-gray-800 text-gray-200 text-xs rounded px-1 py-0.5 border border-gray-700 outline-none"
        title="Stroke width"
      >
        <option value="" disabled>
          W
        </option>
        {[1, 2, 4, 6, 10, 16].map((w) => (
          <option key={w} value={w}>
            {w}px
          </option>
        ))}
      </select>
      <div className="w-px h-5 bg-gray-700" />
      <button
        type="button"
        title="Delete (Del)"
        onClick={onDelete}
        className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
      >
        🗑
      </button>
    </div>
  );
}
