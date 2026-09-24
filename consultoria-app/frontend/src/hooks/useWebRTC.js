import { useEffect, useRef, useState } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

export default function useWebRTC(socket, roomId) {
  const [localStream, setLocalStream]   = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive]       = useState(true);
  const [facingMode, setFacingMode]     = useState('user');

  // peerConnections keyed by remote socket ID
  const pcs = useRef({});
  const localStreamRef = useRef(null);
  
  // Guardamos un ref para gestionar ICE candidates en cola antes de setRemoteDescription
  const pendingCandidates = useRef({});

  // ── Helper: create a peer connection to a specific remote socket ──
  const createPC = (remoteId) => {
    if (pcs.current[remoteId]) return pcs.current[remoteId];

    console.log(`[WebRTC] Creando nueva conexión RTCPeerConnection para el peer: ${remoteId}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcs.current[remoteId] = pc;
    pendingCandidates.current[remoteId] = [];

    // Add local tracks (usando explícitamente addTrack en lugar de addStream)
    if (localStreamRef.current) {
      console.log(`[WebRTC] Añadiendo ${localStreamRef.current.getTracks().length} pistas (tracks) locales al peer = ${remoteId}`);
      localStreamRef.current.getTracks().forEach(t => {
        pc.addTrack(t, localStreamRef.current);
      });
    }

    // Recibir tracks remotos
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Track remoto recibido de ${remoteId}: tipo ${event.track.kind}`);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        // Fallback si el navegador no agrupa en streams (ej. algunas versiones antiguas o Safari)
        const inboundStream = new MediaStream([event.track]);
        setRemoteStream(inboundStream);
      }
    };

    // Recolectar candidatos ICE locales y enviarlos
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && roomId) {
        console.log(`[WebRTC] Candidato ICE local generado, enviando a ${remoteId}`);
        socket.emit('ice-candidate', { target: remoteId, candidate: event.candidate, roomId });
      }
    };

    // Monitoreo completo según el flujo
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] connectionStateChange ${remoteId}: ${pc.connectionState}`);
      if (['failed','closed', 'disconnected'].includes(pc.connectionState)) {
        console.warn(`[WebRTC] Conexión P2P terminada o falló con ${remoteId}`);
        if(pc.connectionState === 'failed' || pc.connectionState === 'closed'){
          setRemoteStream(null);
          pc.close();
          delete pcs.current[remoteId];
        }
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] signalingStateChange ${remoteId}: ${pc.signalingState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] iceConnectionStateChange ${remoteId}: ${pc.iceConnectionState}`);
    };

    return pc;
  };

  // Helper para procesar ICE candidates encolados luego de setRemoteDescription
  const processPendingCandidates = async (remoteId, pc) => {
    const queue = pendingCandidates.current[remoteId] || [];
    if (queue.length > 0) {
      console.log(`[WebRTC] Procesando ${queue.length} candidatos ICE encolados para ${remoteId}`);
      for (let candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`[WebRTC] Candidato ICE encolado procesado correctamente para ${remoteId}`);
        } catch (err) {
          console.error(`[WebRTC] Error procesando candidato ICE encolado:`, err);
        }
      }
      pendingCandidates.current[remoteId] = [];
    }
  };

  // ── Main effect: get media + register socket events ──
  useEffect(() => {
    if (!socket || !roomId) return;
    let isMounted = true;

    // Cuando un nuevo usuario detecta a los que YA ESTÁN en la sala (actuará como Caller de ellos)
    const onExistingPeers = (users) => {
      console.log(`[WebRTC] Evento 'existing-peers', conectando a ${users.length} usuarios existentes.`);
      users.forEach(async (userId) => {
        const pc = createPC(userId);
        try {
          const offer = await pc.createOffer();
          console.log(`[WebRTC] Offer local generada para ${userId}`);
          await pc.setLocalDescription(offer);
          console.log(`[WebRTC] Offer local asignada (setLocalDescription) para ${userId}`);
          
          socket.emit('offer', {
            target: userId,
            caller: socket.id,
            sdp: pc.localDescription,
            roomId
          });
        } catch (err) {
          console.error('[WebRTC] Error creando offer:', err);
        }
      });
    };

    // Cuando alguien entra (Late Joiner fallback)
    const onUserJoined = (userId) => {
      console.log(`[WebRTC] Nuevo usuario unió a la sala: ${userId}. Esperando su oferta...`);
      // Opcionalmente precrear PC:
      createPC(userId);
    };

    // Recibir Offer (Callee) y responder con Answer
    const onOffer = async (incoming) => {
      console.log(`[WebRTC] Recibiendo OFFER_SDP de ${incoming.caller}`);
      const pc = createPC(incoming.caller);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(incoming.sdp));
        console.log(`[WebRTC] setRemoteDescription exitoso (OFFER de ${incoming.caller})`);
        
        // El RemoteDescription ya existe, procesar ICEs si llegaron tempranamente
        await processPendingCandidates(incoming.caller, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`[WebRTC] Answer generada y asignada, emitiendo a ${incoming.caller}`);
        
        socket.emit('answer', {
          target: incoming.caller,
          caller: socket.id,
          sdp: pc.localDescription,
          roomId
        });
      } catch (err) {
        console.error('[WebRTC] Error procesando OFFER:', err);
      }
    };

    // Recibir Answer
    const onAnswer = async (incoming) => {
      const remoteId = incoming.caller || incoming.callee;
      console.log(`[WebRTC] Recibiendo ANSWER_SDP de ${remoteId}`);
      const pc = pcs.current[remoteId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(incoming.sdp));
          console.log(`[WebRTC] setRemoteDescription exitoso (ANSWER de ${remoteId})`);
          await processPendingCandidates(remoteId, pc);
        } catch (err) {
          console.error(`[WebRTC] Error en setRemoteDescription (ANSWER):`, err);
        }
      }
    };

    // Recibir ICE Candidates remotos
    const onIce = async (incoming) => {
      const remoteId = incoming.sender;
      const pc = pcs.current[remoteId];
      if (pc && incoming.candidate) {
        if (!pc.remoteDescription) {
          // Si llega antes que el Offer/Answer, guardarlo en la cola segura
          console.warn(`[WebRTC] Candidato ICE recibido pero remoteDescription no está listo. Encolando para ${remoteId}.`);
          if (!pendingCandidates.current[remoteId]) pendingCandidates.current[remoteId] = [];
          pendingCandidates.current[remoteId].push(incoming.candidate);
        } else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(incoming.candidate));
            console.log(`[WebRTC] Candidato ICE inyectado instantáneamente exitoso desde ${remoteId}`);
          } catch(err) {
            console.error(`[WebRTC] Error agregando candidato ICE al instante de ${remoteId}:`, err);
          }
        }
      }
    };

    const onUserLeft = (userId) => {
      console.log(`[WebRTC] Usuario salió (user-left): ${userId}`);
      if (pcs.current[userId]) {
        pcs.current[userId].close();
        delete pcs.current[userId];
        delete pendingCandidates.current[userId];
        if (Object.keys(pcs.current).length === 0) setRemoteStream(null);
      }
    };

    // ── Pre-registration of listeners ──
    socket.on('existing-peers', onExistingPeers);
    socket.on('user-joined',    onUserJoined);
    socket.on('offer',          onOffer);
    socket.on('answer',         onAnswer);
    socket.on('ice-candidate',  onIce);
    socket.on('user-left',      onUserLeft);

    const init = async () => {
      try {
        console.log('[WebRTC] Pidiendo permisos de cámara/micrófono...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: true 
        });
        
        if (!isMounted) { 
          stream.getTracks().forEach(t => t.stop()); 
          return; 
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        console.log(`[WebRTC] Stream local listo. Uniéndose formalmente a la sala: ${roomId}`);
        
        // NOW we join the room, after listeners are ready AND media is prepared
        socket.emit('join-room', roomId);

      } catch (err) {
        console.warn('[WebRTC] Media failed (no cam/mic):', err.message);
        // Aún así nos unimos por si somos clientes de solo ver.
        socket.emit('join-room', roomId);
      }
    };

    init();

    return () => {
      isMounted = false;
      socket.off('existing-peers', onExistingPeers);
      socket.off('user-joined',    onUserJoined);
      socket.off('offer',          onOffer);
      socket.off('answer',         onAnswer);
      socket.off('ice-candidate',  onIce);
      socket.off('user-left',      onUserLeft);

      // Close all peer connections
      Object.values(pcs.current).forEach(pc => pc.close());
      pcs.current = {};
      pendingCandidates.current = {};

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId]);

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCameraActive(track.enabled); }
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicActive(track.enabled); }
  };

  const switchCamera = async () => {
    try {
      const newMode = facingMode === 'user' ? 'environment' : 'user';
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode },
        audio: false
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];
      
      if (oldVideoTrack) oldVideoTrack.stop();
      
      if (localStreamRef.current && oldVideoTrack) {
        localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(newVideoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
      
      setFacingMode(newMode);
      setCameraActive(true);
      
      Object.values(pcs.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(newVideoTrack).catch(err => console.error('Error replacing track', err));
      });
    } catch (err) {
      console.warn('Error cambiando cámara:', err.message);
    }
  };

  return { localStream, remoteStream, toggleCamera, toggleMic, cameraActive, micActive, switchCamera, facingMode };
}
