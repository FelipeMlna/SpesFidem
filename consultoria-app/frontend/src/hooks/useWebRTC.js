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

  // peerConnections keyed by remote socket ID
  const pcs = useRef({});
  const localStreamRef = useRef(null);

  // ── Helper: create a peer connection to a specific remote socket ──
  const createPC = (remoteId) => {
    if (pcs.current[remoteId]) return pcs.current[remoteId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcs.current[remoteId] = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    }

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { target: remoteId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected','failed','closed'].includes(pc.connectionState)) {
        setRemoteStream(null);
        pc.close();
        delete pcs.current[remoteId];
      }
    };

    return pc;
  };

  // ── Main effect: get media + register socket events ──
  useEffect(() => {
    if (!socket || !roomId) return;

    let isMounted = true;

    const onExistingPeers = (users) => {
      users.forEach(userId => {
        const pc = createPC(userId);
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('offer', {
              target: userId,
              caller: socket.id,
              sdp: pc.localDescription
            });
          })
          .catch(err => console.error('Error creating offer:', err));
      });
    };

    const onUserJoined = (userId) => {
      // Create a peer connection for the user who just joined
      createPC(userId);
    };

    const onOffer = (incoming) => {
      const pc = createPC(incoming.caller);
      pc.setRemoteDescription(new RTCSessionDescription(incoming.sdp))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          socket.emit('answer', {
            target: incoming.caller,
            caller: socket.id,
            sdp: pc.localDescription
          });
        })
        .catch(err => console.error('Error handling offer:', err));
    };

    const onAnswer = (incoming) => {
      // Backend emits { callee: socket.id, sdp }
      const remoteId = incoming.caller || incoming.callee;
      const pc = pcs.current[remoteId];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(incoming.sdp))
          .catch(err => console.error('Error setting remote desc in answer:', err));
      }
    };

    const onIce = (incoming) => {
      const pc = pcs.current[incoming.sender];
      if (pc && incoming.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(incoming.candidate))
          .catch(err => console.error('Error adding ICE candidate:', err));
      }
    };

    const onUserLeft = (userId) => {
      if (pcs.current[userId]) {
        pcs.current[userId].close();
        delete pcs.current[userId];
        setRemoteStream(null);
        
        // El usuario remoto se desconectó, redirigimos al inicio
        window.location.href = '/index.html';
      }
    };

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);

        // ONLY register listeners AFTER local stream is ready
        socket.on('existing-peers', onExistingPeers);
        socket.on('user-joined',    onUserJoined);
        socket.on('offer',          onOffer);
        socket.on('answer',         onAnswer);
        socket.on('ice-candidate',  onIce);
        socket.on('user-left',      onUserLeft);

      } catch (err) {
        console.warn('Cámara/micrófono no disponible:', err.message);
        socket.on('existing-peers', onExistingPeers);
        socket.on('user-joined',    onUserJoined);
        socket.on('offer',          onOffer);
        socket.on('answer',         onAnswer);
        socket.on('ice-candidate',  onIce);
        socket.on('user-left',      onUserLeft);
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

      // Stop local media
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

  return { localStream, remoteStream, toggleCamera, toggleMic, cameraActive, micActive };
}
