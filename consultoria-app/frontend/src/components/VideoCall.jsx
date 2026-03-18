import useWebRTC from '../hooks/useWebRTC';
import { Camera, CameraOff, Mic, MicOff } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

export default function VideoCall({ socket, roomId }) {
  const { localStream, remoteStream, toggleCamera, toggleMic, cameraActive, micActive } = useWebRTC(socket, roomId);
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
            <p className="text-sm">Esperando al asesor...</p>
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
            className={`p-2.5 rounded-full transition-all ${micActive ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/90 hover:bg-red-500'}`}
            title={micActive ? 'Silenciar' : 'Activar micrófono'}>
            {micActive ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button onClick={toggleCamera}
            className={`p-2.5 rounded-full transition-all ${cameraActive ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/90 hover:bg-red-500'}`}
            title={cameraActive ? 'Apagar cámara' : 'Activar cámara'}>
            {cameraActive ? <Camera size={18} /> : <CameraOff size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
