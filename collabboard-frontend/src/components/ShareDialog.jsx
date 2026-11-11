import { useEffect, useState } from 'react';
import { isLocalOnly } from '../config.js';
import { getNetworkAddresses } from '../api/roomApi.js';

/**
 * Explains how to actually get another person onto this board.
 *
 * The common trap: the address bar says localhost, which resolves to the
 * *visitor's* machine, so a copied link always fails for everyone else. This
 * dialog surfaces that and offers the LAN address instead.
 */
export default function ShareDialog({ open, onClose, roomCode }) {
  const [copied, setCopied] = useState('');
  const [lanUrl, setLanUrl] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setCopied('');
    let active = true;
    // The browser cannot read the host machine's LAN IP, so ask the backend.
    getNetworkAddresses().then((addresses) => {
      if (!active || addresses.length === 0) return;
      const url = new URL(window.location.href);
      url.hostname = addresses[0];
      setLanUrl(url.toString());
    });
    return () => { active = false; };
  }, [open]);

  if (!open) return null;

  const currentUrl = window.location.href;
  const localOnly = isLocalOnly();

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const lanGuess = lanUrl || currentUrl.replace(/\/\/(localhost|127\.0\.0\.1)/, '//<your-ip>');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Invite people to this board" className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white text-lg font-semibold">Invite people to this board</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              Room code <span className="font-mono text-indigo-300">{roomCode}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            className="text-gray-400 hover:text-white text-2xl leading-none -mt-1"
          >
            ×
          </button>
        </div>

        <label htmlFor="cb-share-link" className="block text-xs text-gray-400 mb-2">This board&rsquo;s link</label>
        <div className="flex gap-2 mb-5">
          <input
            id="cb-share-link"
            readOnly
            value={currentUrl}
            onFocus={(e) => e.target.select()}
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 font-mono truncate"
          />
          <button
            type="button"
            onClick={() => copy(currentUrl, 'link')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg px-4 whitespace-nowrap"
          >
            {copied === 'link' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {localOnly && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm">
            <p className="text-amber-300 font-medium mb-2">
              This link only works on this computer
            </p>
            <p className="text-gray-300 leading-relaxed mb-3">
              <span className="font-mono text-amber-200">localhost</span> means
              &ldquo;this machine&rdquo;, so anyone else who opens it lands on their own
              computer and sees nothing. To share it:
            </p>
            <ul className="text-gray-300 space-y-2 leading-relaxed list-disc pl-5">
              <li>
                <span className="text-white font-medium">Same WiFi</span> — use this
                address instead:
                <code className="block mt-1 bg-gray-800 rounded px-2 py-1 text-xs font-mono text-indigo-300 break-all">
                  {lanGuess}
                </code>
                {lanUrl ? (
                  <button
                    type="button"
                    onClick={() => copy(lanUrl, 'lan')}
                    className="mt-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded px-3 py-1.5"
                  >
                    {copied === 'lan' ? 'Copied!' : 'Copy network link'}
                  </button>
                ) : (
                  <span className="text-gray-400 text-xs">Looking up your address…</span>
                )}
              </li>
              <li>
                <span className="text-white font-medium">Anyone, anywhere</span> — deploy
                it. See <span className="font-mono text-indigo-300">DEPLOY.md</span> in the
                project for a step-by-step free setup.
              </li>
            </ul>
          </div>
        )}

        {!localOnly && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm text-gray-300">
            <span className="text-emerald-300 font-medium">This link is shareable.</span>{' '}
            Anyone who can reach this address will join the same board live.
          </div>
        )}
      </div>
    </div>
  );
}
