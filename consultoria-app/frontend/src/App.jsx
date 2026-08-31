import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import VideoCall from './components/VideoCall';
import Workspace from './components/Workspace';
import Visualizer from './components/Visualizer';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://spesfidem-video-server.onrender.com';

const INITIAL_SPECS = {
  width: 1.5, height: 2.0,
  profile: 'Natural', glass: 'Templado',
  glassThickness: '6', glassColor: 'Incoloro',
  leafCount: '2', notes: ''
};

function App() {
  const [socket,     setSocket]     = useState(null);
  const [roomId,     setRoomId]     = useState('');
  const [inputRoom,  setInputRoom]  = useState('');
  const [role,       setRole]       = useState('client'); // 'client' or 'admin'
  const [joined,     setJoined]     = useState(false);
  const [specs,      setSpecs]      = useState(INITIAL_SPECS);
  const [copied,     setCopied]     = useState(false);

  // Use a ref to access latest specs inside socket listeners
  const specsRef = useRef(specs);
  useEffect(() => { specsRef.current = specs; }, [specs]);

  // ── Init socket ──
  useEffect(() => {
    const s = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => {
      // Re-join automatically if socket drops and reconnects natively
      const currentRoomId = new URLSearchParams(window.location.search).get('room');
      if (currentRoomId) {
        s.emit('join-room', currentRoomId.toUpperCase());
      }
    });

    s.on('state-updated', ({ key, value }) => {
      if (key === 'FULL_SYNC') {
        setSpecs(value);
      } else {
        setSpecs(prev => ({ ...prev, [key]: value }));
      }
    });

    s.on('user-joined', (userId) => {
      // Broadcast current state to the new user relying ONLY on the existing 'update-state'
      // which the older backend already supports and broadcasts to the room.
      const currentRoomId = new URLSearchParams(window.location.search).get('room') || '';
      s.emit('update-state', { 
        roomId: currentRoomId,
        key: 'FULL_SYNC', 
        value: specsRef.current 
      });
    });

    return () => s.close();
  }, []);

  // ── Auto-join from URL ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    const roleFromUrl = params.get('role');
    
    if (roomFromUrl) {
      setInputRoom(roomFromUrl.toUpperCase());
    }

    // Auto-join ONLY if room is provided
    if (roomFromUrl && socket && !joined) {
      const id = roomFromUrl.toUpperCase();
      const currentRole = roleFromUrl || 'client';
      setRole(currentRole);
      setRoomId(id);
      // join-room is now handled by VideoCall/useWebRTC hook
      setJoined(true);

      // Notificar al servidor sobre la nueva consulta (solo si es cliente)
      if (currentRole === 'client') {
        socket.emit('new-consultation', {
          roomId: id,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        });
      }

      // Persistir rol en URL si faltaba
      const urlObj = new URL(window.location);
      urlObj.searchParams.set('role', currentRole);
      urlObj.searchParams.delete('autoWa');
      window.history.replaceState({}, '', urlObj);
    }
  }, [socket, joined]);

  // ── Create room (client) ──
  const createRoom = () => {
    const id = inputRoom.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    if (socket) socket.emit('join-room', id);
    setJoined(true);
    setRole('client');

    // Guardar sala y rol en URL para persistencia total
    const url = new URL(window.location);
    url.searchParams.set('room', id);
    url.searchParams.set('role', 'client');
    window.history.replaceState({}, '', url);
  };

  // ── Join existing room ──
  const joinRoom = (selectedRole) => {
    const id = inputRoom.trim().toUpperCase();
    if (!id) return;
    setRole(selectedRole);
    setRoomId(id);
    if (socket) socket.emit('join-room', id);
    setJoined(true);

    // Guardar sala y rol en URL para reconexiones en caso de F5
    const url = new URL(window.location);
    url.searchParams.set('room', id);
    url.searchParams.set('role', selectedRole);
    window.history.replaceState({}, '', url);
  };

  // ── Shared spec change ──
  const handleSpecChange = (key, value) => {
    setSpecs(prev => ({ ...prev, [key]: value }));
    if (socket && roomId) socket.emit('update-state', { roomId, key, value });
  };

  const copyLink = () => {
    const url = `${window.location.protocol}//${window.location.host}/consultoria/?room=${roomId}`;
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
          <a href="/index.html"
            className="absolute top-5 left-5 bg-white/8 hover:bg-white/15 text-text-muted hover:text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors border border-white/10"
            title="Volver">
            <i className="fas fa-arrow-left text-sm"></i>
          </a>

          <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(56,189,248,0.2)]">
            <i className="fas fa-video text-accent text-2xl"></i>
          </div>

          <h1 className="text-3xl font-bold font-['Outfit'] mb-2 text-white">Consultoría Visual</h1>
          <p className="text-text-muted mb-6 text-sm">Spesfidem · Sesión de video en tiempo real</p>

          {/* Botón principal: Entrar a sala */}
          {!inputRoom.trim() ? (
            <button onClick={createRoom}
              className="w-full bg-accent hover:bg-sky-400 text-slate-900 font-bold py-4 px-4 rounded-xl transition-all shadow-[0_0_25px_rgba(56,189,248,0.3)] hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] mb-4 flex items-center justify-center gap-3 text-lg">
              <i className="fas fa-video"></i> Crear nueva sala
            </button>
          ) : (
            <div className="flex flex-col gap-3 mb-4">
              <p className="text-text-muted text-sm font-semibold">CÓDIGO: <span className="text-accent">{inputRoom}</span></p>
              <button onClick={() => joinRoom('client')}
                className="w-full bg-accent/90 hover:bg-accent text-slate-900 font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(56,189,248,0.2)] flex items-center justify-center gap-3 text-base">
                <i className="fas fa-user"></i> Entrar como Cliente
              </button>
              <button onClick={() => joinRoom('admin')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-3 text-base">
                <i className="fas fa-user-shield text-accent"></i> Entrar como Asesor
              </button>
            </div>
          )}

          {/* Unirse con código */}
          <div className="flex gap-2">
            <input type="text" placeholder="Tengo un código de sala…"
              value={inputRoom} onChange={e => setInputRoom(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 focus:border-accent rounded-xl px-4 py-3 text-white outline-none transition-colors text-center font-mono tracking-widest text-lg" />
          </div>
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
          
          {/* Notificar Asesor (Fallback Button for Clients) */}
          {role === 'client' && (
            <button 
              onClick={() => {
                const phone = "573046291152";
                const baseUrl = `${window.location.protocol}//${window.location.host}`;
                const message = encodeURIComponent(`🚀 *Consulta Spesfidem*\n\nHola, estoy en la sala virtual y necesito asesoría.\n\n*Sala:* ${roomId}\n\n*Enlace para ingresar (Asesor):*\n${baseUrl}/consultoria/?room=${roomId}&role=admin`);
                window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
              }}
              className="bg-success/15 hover:bg-success/25 text-success px-3 py-1.5 rounded-full text-[11px] font-bold border border-success/30 flex items-center gap-1.5 transition-all animate-pulse"
              title="Notificar al asesor por WhatsApp">
              <i className="fab fa-whatsapp text-sm"></i>
              Notificar Asesor
            </button>
          )}

          <button onClick={copyLink}
            className={`p-2 rounded-full transition-all border ${copied ? 'bg-success/20 border-success/40 text-success' : 'bg-accent/10 border-accent/20 text-accent hover:bg-accent/20'}`}
            title="Copiar enlace">
            <i className={`fas ${copied ? 'fa-check' : 'fa-link'} text-sm`}></i>
          </button>
          <a href="/index.html"
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-full transition-colors border border-red-500/20"
            title="Salir y Volver al Inicio">
            <i className="fas fa-sign-out-alt text-sm"></i>
          </a>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-3 h-full min-h-0 overflow-y-auto lg:overflow-hidden p-3 lg:p-0">

        {/* Left: Video full height (Col-span 8) */}
        <div className="lg:col-span-8 h-auto lg:h-full min-h-[500px] lg:min-h-0">
          <VideoCall socket={socket} roomId={roomId} role={role} />
        </div>

        {/* Right: Workspace + Visualizer (Col-span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-3 h-auto lg:h-full min-h-[500px] lg:min-h-0 pb-6 lg:pb-0">
          <div className="flex-1 min-h-0">
            <Workspace specs={specs} onChange={handleSpecChange} />
          </div>
          <div className="h-[200px] shrink-0">
            <Visualizer specs={specs} />
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
