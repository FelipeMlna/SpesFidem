require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // To parse JSON bodies

app.get('/api/rooms', (req, res) => {
  res.json({ rooms: Object.keys(rooms) || [] });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Track which sockets are in each room
const rooms = {}; // roomId -> [socketId, ...]

io.on('connection', (socket) => {
  console.log(`[+] Conectado: ${socket.id}`);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push(socket.id);

    console.log(`[R] ${socket.id} -> sala "${roomId}" (${rooms[roomId].length} usuarios)`);

    // Notify the NEW user who else is already in the room
    const others = rooms[roomId].filter(id => id !== socket.id);
    if (others.length > 0) {
      // Tell the new user the IDs of existing peers
      socket.emit('existing-peers', others);
      // Tell existing peers a new user joined
      others.forEach(peerId => {
        io.to(peerId).emit('user-joined', socket.id);
      });
    }
  });

  // ========== WebRTC Signaling (peer-to-peer by socket ID) ==========
  socket.on('offer', ({ target, sdp, roomId }) => {
    console.log(`[WebRTC] SDP Offer received from ${socket.id} to ${target} in ${roomId}`);
    if (roomId && rooms[roomId] && rooms[roomId].includes(target)) {
      io.to(target).emit('offer', { caller: socket.id, sdp });
    } else {
      console.warn(`[WebRTC] Invalid offer target ${target} or room ${roomId}`);
    }
  });

  socket.on('answer', ({ target, sdp, roomId }) => {
    console.log(`[WebRTC] SDP Answer received from ${socket.id} to ${target} in ${roomId}`);
    if (roomId && rooms[roomId] && rooms[roomId].includes(target)) {
      io.to(target).emit('answer', { caller: socket.id, callee: socket.id, sdp }); // fallback support for older logic
    } else {
      console.warn(`[WebRTC] Invalid answer target ${target} or room ${roomId}`);
    }
  });

  socket.on('ice-candidate', ({ target, candidate, roomId }) => {
    console.log(`[WebRTC] ICE candidate received from ${socket.id} to ${target}`);
    if (roomId && rooms[roomId] && rooms[roomId].includes(target)) {
      io.to(target).emit('ice-candidate', { sender: socket.id, candidate });
    }
  });

  // ========== Collaborative State Sync ==========
  socket.on('update-state', (payload) => {
    // Broadcast to everyone else in the room
    socket.to(payload.roomId).emit('state-updated', payload);
  });

  socket.on('sync-full-state', (payload) => {
    // Send full specs to specific peer when they join
    io.to(payload.target).emit('full-state-updated', payload.specs);
  });

  // ========== Admin Notifications ==========
  socket.on('new-consultation', (data) => {
    // Broadcast new consultation event to all (admin dash will filter)
    socket.broadcast.emit('new-consultation', data);
    console.log(`[!] Notificación: Nueva consulta en sala ${data.roomId}`);
  });

  // ========== Disconnect ==========
  socket.on('disconnect', () => {
    console.log(`[-] Desconectado: ${socket.id}`);
    // Remove from all rooms
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`[X] Sala "${roomId}" cerrada (sin usuarios)`);
      } else {
        // Notify remaining users
        io.to(roomId).emit('user-left', socket.id);
      }
    }
  });
});

// ========== Notificaciones (Eliminadas) ==========
// La lógica de notificación de WhatsApp fue migrada exitosamente al frontend (wa.me)
// para eliminar dependencias de APIs pagas como Twilio según requerimiento.

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Backend Spesfidem corriendo en puerto: ${PORT}\n`);
});
