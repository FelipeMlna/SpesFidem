import useWebRTC from '../hooks/useWebRTC';
import { Camera, CameraOff, Mic, MicOff, PhoneOff, RefreshCw } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

export default function VideoCall({ socket, roomId, role = 'client' }) {
  const { localStream, remoteStream, toggleCamera, toggleMic, cameraActive, micActive, switchCamera, facingMode } = useWebRTC(socket, roomId);
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const endCall = () => {
    // Navigate back to root landing page, works on any domain
    window.location.href = window.location.origin + '/';
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Remote Video — full size */}
      <div className="relative glass-card flex-grow flex items-center justify-center overflow-hidden bg-black/60 min-h-0">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-text-muted">
            <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
              <i className="fas fa-user text-accent text-2xl"></i>
            </div>
            <p className="text-sm">
              {role === 'admin' ? 'Esperando al cliente...' : 'Esperando al asesor...'}
            </p>
            <p className="text-xs opacity-50">La llamada iniciará al conectarse</p>
          </div>
        )}

        {/* Local PiP */}
        <div className="absolute bottom-3 right-3 w-28 h-36 bg-slate-900 border-2 border-accent/40 rounded-xl overflow-hidden shadow-2xl">
          <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
          {!localStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <i className="fas fa-camera-slash text-text-muted text-lg"></i>
            </div>
          )}
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4 px-4 pointer-events-none">
          
          {/* Main Controls Row */}
          <div className="flex flex-wrap justify-center gap-2 bg-slate-900/95 p-2.5 rounded-2xl backdrop-blur-2xl border border-white/10 shadow-2xl pointer-events-auto max-w-[95%]">
            <button onClick={toggleMic}
              className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all ${micActive ? 'bg-white/10 text-white' : 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'}`}
              title={micActive ? 'Silenciar' : 'Activar micrófono'}>
              {micActive ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            
            <button onClick={toggleCamera}
              className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all ${cameraActive ? 'bg-white/10 text-white' : 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'}`}
              title={cameraActive ? 'Apagar cámara' : 'Activar cámara'}>
              {cameraActive ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>

            <button onClick={switchCamera}
              className="px-4 sm:px-6 h-11 sm:h-12 flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition-all active:scale-95"
              title="Girar Cámara">
              <RefreshCw size={18} className="animate-spin-slow" />
              <span className="text-xs sm:text-sm hidden xs:inline">Girar</span>
              <span className="text-sm hidden sm:inline">Cámara</span>
            </button>

            <button onClick={endCall}
              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:bg-red-500 transition-all active:scale-95"
              title="Finalizar Videollamada">
              <PhoneOff size={20} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
