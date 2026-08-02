import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, getRoom } from '../api/roomApi.js';
import { useToast } from '../context/ToastContext.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleCreate = async () => {
    setCreating(true);
    try {
      const room = await createRoom();
      navigate(`/room/${room.roomCode}`);
    } catch (err) {
      showToast(err.message || 'Failed to create room', 'error');
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Enter a room code');
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      await getRoom(code);
      navigate(`/room/${code}`);
    } catch (err) {
      setJoinError(err.message === 'Room not found' ? 'Room not found' : err.message);
      setJoining(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gray-950 overflow-hidden flex flex-col items-center justify-center px-4 py-12">
      <div className="cb-grid-bg" />
      <div className="cb-glow" />

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        <div className="text-center mb-10">
          <h1 className="text-6xl font-extrabold text-white tracking-tight">
            Collab<span className="text-indigo-500">Board</span>
          </h1>
          <p className="mt-4 text-lg text-gray-400">Real-time collaborative whiteboard — infinite canvas, no login.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
          <div className="flex-1 bg-gray-800/80 backdrop-blur rounded-xl p-8 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-2">Create a Room</h2>
            <p className="text-gray-400 text-sm mb-6">Start a fresh board and share the link.</p>
            <button type="button" onClick={handleCreate} disabled={creating} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-3 transition-colors flex items-center justify-center gap-2">
              {creating ? (<><Spinner /> Creating…</>) : 'Create New Room'}
            </button>
          </div>

          <div className="flex-1 bg-gray-800/80 backdrop-blur rounded-xl p-8 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-2">Join a Room</h2>
            <p className="text-gray-400 text-sm mb-6">Enter a 6-character room code.</p>
            <form onSubmit={handleJoin}>
              <input type="text" value={joinCode} maxLength={10} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 mb-4 font-mono tracking-widest uppercase placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" disabled={joining} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-3 transition-colors flex items-center justify-center gap-2">
                {joining ? (<><Spinner /> Checking…</>) : 'Join Room'}
              </button>
            </form>
            {joinError && <p className="mt-3 text-sm text-red-400">{joinError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 w-full max-w-3xl">
          <Feature icon="⚡" title="Real-time sync" desc="See every stroke and cursor live." />
          <Feature icon="🌐" title="Infinite canvas" desc="Pan, zoom, and never run out of space." />
          <Feature icon="🔓" title="No login needed" desc="Create a room and start instantly." />
        </div>

        <footer className="mt-12 text-xs text-gray-600">Built with Java + Spring Boot + React</footer>
      </div>

      <style>{`
        .cb-grid-bg {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(99,102,241,0.18) 1px, transparent 1px);
          background-size: 28px 28px;
          animation: cb-pan 20s linear infinite;
        }
        @keyframes cb-pan { from { background-position: 0 0; } to { background-position: 28px 28px; } }
        .cb-glow {
          position: absolute; top: -10%; left: 50%; transform: translateX(-50%);
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%);
          filter: blur(40px); animation: cb-pulse 6s ease-in-out infinite;
        }
        @keyframes cb-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div className="bg-gray-800/60 backdrop-blur border border-gray-700 rounded-xl p-5 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      <p className="text-gray-400 text-xs mt-1">{desc}</p>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}
