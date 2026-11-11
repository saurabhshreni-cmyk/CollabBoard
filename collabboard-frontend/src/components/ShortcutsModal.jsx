const SHORTCUTS = [
  ['V', 'Select tool'],
  ['P', 'Pen'],
  ['H', 'Highlighter'],
  ['L', 'Laser pointer'],
  ['R', 'Rectangle'],
  ['O', 'Circle'],
  ['D', 'Diamond'],
  ['G', 'Triangle'],
  ['A', 'Arrow'],
  ['T', 'Text'],
  ['S', 'Sticky note'],
  ['E', 'Eraser'],
  ['Del / Backspace', 'Delete selected'],
  ['Ctrl + Z', 'Undo'],
  ['Ctrl + Y / Ctrl + Shift + Z', 'Redo'],
  ['Ctrl + A', 'Select all'],
  ['Escape', 'Deselect / cancel'],
  ['Space + drag', 'Pan canvas'],
  ['Drag empty canvas (Select)', 'Pan canvas'],
  ['Mouse wheel', 'Zoom'],
  ['+ / -', 'Zoom in / out'],
  ['0', 'Reset zoom'],
  ['?', 'This help'],
];

export default function ShortcutsModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-700">
          <h2 className="text-white font-semibold">Keyboard Shortcuts</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={`${key}:${desc}`} className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm text-gray-300">{desc}</span>
              <kbd className="text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-0.5 font-mono whitespace-nowrap">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
