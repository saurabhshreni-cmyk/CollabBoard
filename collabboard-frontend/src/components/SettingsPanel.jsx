import { useEffect, useState } from 'react';

const BG_OPTIONS = [
  { label: 'Navy', value: '#1a1a2e' },
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#0a0a0a' },
  { label: 'Gray', value: '#2b2b3a' },
  { label: 'Blue', value: '#10213f' },
];

export default function SettingsPanel({
  open,
  onClose,
  boardName,
  onRenameBoard,
  backgroundColor,
  setBackgroundColor,
  gridVisible,
  setGridVisible,
  snapEnabled,
  setSnapEnabled,
  onClear,
}) {
  // Controlled draft so a rename broadcast by a collaborator is reflected here
  // too, instead of the field staying stuck on its initial value.
  const [nameDraft, setNameDraft] = useState(boardName || '');
  useEffect(() => setNameDraft(boardName || ''), [boardName]);

  const commitName = () => {
    const trimmed = nameDraft.trim() || 'Untitled Board';
    setNameDraft(trimmed);
    if (trimmed !== boardName) onRenameBoard(trimmed);
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />}
      <div
        role="dialog"
        aria-label="Board settings"
        aria-hidden={!open}
        inert={open ? undefined : ''}
        className={`fixed top-0 right-0 h-full w-80 max-w-full bg-gray-900 border-l border-gray-700 z-50 shadow-2xl transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-700">
          <h2 className="text-white font-semibold">Board Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-xs text-gray-400 mb-2">Board name</label>
            <input
              value={nameDraft}
              maxLength={100}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setNameDraft(boardName || '');
              }}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">Background</label>
            <div className="flex flex-wrap gap-2">
              {BG_OPTIONS.map((bg) => (
                <button
                  key={bg.value}
                  type="button"
                  title={bg.label}
                  aria-label={`${bg.label} background`}
                  aria-pressed={backgroundColor === bg.value}
                  onClick={() => setBackgroundColor(bg.value)}
                  className={`w-9 h-9 rounded-lg border ${backgroundColor === bg.value ? 'ring-2 ring-indigo-400 border-transparent' : 'border-gray-600'}`}
                  style={{ backgroundColor: bg.value }}
                />
              ))}
            </div>
          </div>

          <Toggle label="Show grid" checked={gridVisible} onChange={setGridVisible} />
          <Toggle label="Snap to grid" checked={snapEnabled} onChange={setSnapEnabled} />

          <div className="pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClear}
              className="w-full bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              Clear board
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-indigo-600' : 'bg-gray-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
