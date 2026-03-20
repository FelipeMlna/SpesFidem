import useWebRTC from '../hooks/useWebRTC';
import { Camera, CameraOff, Mic, MicOff, PhoneOff, RefreshCw } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

export default function VideoCall({ socket, roomId, role = 'client' }) {
  const { localStream, remoteStream, toggleCamera, toggleMic, cameraActive, micActive, switchCamera } = useWebRTC(socket, roomId);
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
    window.location.href = '/index.html';
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
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {!localStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <i className="fas fa-camera-slash text-text-muted text-lg"></i>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 bg-slate-900/80 px-5 py-2.5 rounded-full backdrop-blur-md border border-white/10">
          <button onClick={toggleMic}
            className={`p-2.5 rounded-full transition-all ${micActive ? 'bg-white/10 hover:bg-white/20' : 'bg-orange-500/90 hover:bg-orange-500 text-white'}`}
            title={micActive ? 'Silenciar' : 'Activar micrófono'}>
            {micActive ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button onClick={toggleCamera}
            className={`p-2.5 rounded-full transition-all ${cameraActive ? 'bg-white/10 hover:bg-white/20' : 'bg-orange-500/90 hover:bg-orange-500 text-white'}`}
            title={cameraActive ? 'Apagar cámara' : 'Activar cámara'}>
            {cameraActive ? <Camera size={18} /> : <CameraOff size={18} />}
          </button>
          
          <button onClick={switchCamera}
            className="p-2.5 rounded-full transition-all bg-white/10 hover:bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]"
            title="Voltear Cámara (Frontal/Trasera)">
            <RefreshCw size={18} />
          </button>
          {/* Botón de Colgar */}
          <button onClick={endCall}
            className="p-2.5 rounded-full transition-all bg-red-600/90 hover:bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)] flex items-center justify-center text-white ml-2"
            title="Finalizar Videollamada">
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
