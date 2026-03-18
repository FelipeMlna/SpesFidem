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

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.warn('Cámara/micrófono no disponible:', err.message);
      }
    };

    init();

    // ── Someone who was already in the room tells us they exist ──
    const onExistingPeers = async (peerIds) => {
      for (const peerId of peerIds) {
        const pc = createPC(peerId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { target: peerId, sdp: offer });
        } catch (e) { console.error('offer error', e); }
      }
    };

    // ── A new user just joined our room ──
    const onUserJoined = async (newPeerId) => {
      // We'll wait for their offer; they will send it via existing-peers
      createPC(newPeerId);
    };

    // ── Receive offer → send answer ──
    const onOffer = async ({ caller, sdp }) => {
      const pc = createPC(caller);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { target: caller, sdp: answer });
      } catch (e) { console.error('answer error', e); }
    };

    // ── Receive answer ──
    const onAnswer = async ({ callee, sdp }) => {
      const pc = pcs.current[callee];
      if (pc) {
        try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }
        catch (e) { console.error('set answer error', e); }
      }
    };

    // ── Receive ICE candidate ──
    const onIce = async ({ sender, candidate }) => {
      const pc = pcs.current[sender];
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { /* ignore benign errors */ }
      }
    };

    // ── Peer left ──
    const onUserLeft = (peerId) => {
      if (pcs.current[peerId]) {
        pcs.current[peerId].close();
        delete pcs.current[peerId];
      }
      setRemoteStream(null);
    };

    socket.on('existing-peers', onExistingPeers);
    socket.on('user-joined',    onUserJoined);
    socket.on('offer',          onOffer);
    socket.on('answer',         onAnswer);
    socket.on('ice-candidate',  onIce);
    socket.on('user-left',      onUserLeft);

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
