import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import VideoCall from './components/VideoCall';
import Workspace from './components/Workspace';
import Visualizer from './components/Visualizer';
import Gallery from './components/Gallery';

// Usamos un .env si existe, si no asumimos que está en el mismo dominio host pero puerto 3001
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

const INITIAL_SPECS = {
  width: 1.5, height: 2.0,
  profile: 'Natural', glass: 'Templado',
  glassThickness: '6', glassColor: 'Incoloro',
  leafCount: '2', mirror: 'Ninguno', notes: ''
};

function App() {
  const [socket,     setSocket]     = useState(null);
  const [roomId,     setRoomId]     = useState('');
  const [inputRoom,  setInputRoom]  = useState('');
  const [joined,     setJoined]     = useState(false);
  const [specs,      setSpecs]      = useState(INITIAL_SPECS);
  const [copied,     setCopied]     = useState(false);

  // ── Init socket ──
  useEffect(() => {
    const s = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    setSocket(s);

    // Sync specs from the remote peer
    s.on('state-updated', ({ key, value }) => {
      setSpecs(prev => ({ ...prev, [key]: value }));
    });

    return () => s.close();
  }, []);

  // ── Auto-join from URL (owner clicks WhatsApp link) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl && socket && !joined) {
      const id = roomFromUrl.toUpperCase();
      setRoomId(id);
      socket.emit('join-room', id);
      setJoined(true);
    }
  }, [socket, joined]);

  // ── Create room (client) ──
  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    if (socket) socket.emit('join-room', id);
    setJoined(true);
  };

  // ── Join existing room ──
  const joinRoom = (e) => {
    e.preventDefault();
    const id = inputRoom.trim().toUpperCase();
    if (!id) return;
    setRoomId(id);
    if (socket) socket.emit('join-room', id);
    setJoined(true);
  };

  // ── Shared spec change ──
  const handleSpecChange = (key, value) => {
    setSpecs(prev => ({ ...prev, [key]: value }));
    if (socket && roomId) socket.emit('update-state', { roomId, key, value });
  };

  const copyLink = () => {
    const url = `${window.location.protocol}//${window.location.hostname}:5173?room=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Landing screen ──
  if (!joined) {
    return (
      <div className="min-h-screen bg-bg-deep flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center relative">
          {/* Back button */}
          <a href={`${window.location.protocol}//${window.location.hostname}:3000/videocall.html`}
            className="absolute top-5 left-5 bg-white/8 hover:bg-white/15 text-text-muted hover:text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors border border-white/10"
            title="Volver">
            <i className="fas fa-arrow-left text-sm"></i>
          </a>

          <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(56,189,248,0.2)]">
            <i className="fas fa-video text-accent text-2xl"></i>
          </div>

          <h1 className="text-3xl font-bold font-['Outfit'] mb-2 text-white">Consultoría Visual</h1>
          <p className="text-text-muted mb-8 text-sm">Plataforma colaborativa en tiempo real · Spesfidem</p>

          <button onClick={createRoom}
            className="w-full bg-accent hover:bg-sky-400 text-slate-900 font-bold py-3.5 px-4 rounded-xl transition-all shadow-[0_0_25px_rgba(56,189,248,0.3)] hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] mb-6 flex items-center justify-center gap-3 text-base">
            <i className="fas fa-plus-circle"></i> Crear Nueva Sesión
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="h-px bg-white/10 flex-1"></div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-widest">o unirte</span>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>

          <form onSubmit={joinRoom} className="flex gap-2">
            <input type="text" placeholder="Código de sala (ej: AB34XZ)"
              value={inputRoom} onChange={e => setInputRoom(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 focus:border-accent rounded-xl px-4 py-3 text-white outline-none transition-colors text-sm" />
            <button type="submit" disabled={!inputRoom.trim()}
              className="bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl transition-all text-sm">
              Unirse
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main Consultation UI ──
  return (
    <div className="flex flex-col h-screen bg-bg-deep text-text-main p-3 gap-3 overflow-hidden">

      {/* Header */}
      <header className="glass-card flex items-center justify-between px-5 py-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
            <i className="fas fa-video text-accent text-sm"></i>
          </div>
          <div>
            <h1 className="font-['Outfit'] font-bold text-base leading-tight">Consultoría Spesfidem</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
              </span>
              <span className="text-[11px] text-text-muted">En sesión</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-mono tracking-widest flex items-center gap-2">
            <span className="text-text-muted">SALA</span>
            <span className="text-accent font-bold">{roomId}</span>
          </div>
          <button onClick={copyLink}
            className={`p-2 rounded-full transition-all border ${copied ? 'bg-success/20 border-success/40 text-success' : 'bg-accent/10 border-accent/20 text-accent hover:bg-accent/20'}`}
            title="Copiar enlace">
            <i className={`fas ${copied ? 'fa-check' : 'fa-link'} text-sm`}></i>
          </button>
          <a href={`${window.location.protocol}//${window.location.hostname}:3000/videocall.html`}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-full transition-colors border border-red-500/20"
            title="Salir">
            <i className="fas fa-sign-out-alt text-sm"></i>
          </a>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-12 gap-3 h-full min-h-0">

        {/* Left: Video + Visualizer */}
        <div className="col-span-4 flex flex-col gap-3 h-full min-h-0">
          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden">
            <VideoCall socket={socket} roomId={roomId} />
          </div>
          <div className="h-[38%] shrink-0">
            <Visualizer specs={specs} />
          </div>
        </div>

        {/* Center: Workspace */}
        <div className="col-span-4 h-full min-h-0">
          <Workspace specs={specs} onChange={handleSpecChange} />
        </div>

        {/* Right: Gallery */}
        <div className="col-span-4 h-full min-h-0">
          <Gallery socket={socket} roomId={roomId} />
        </div>

      </main>
    </div>
  );
}

export default App;
