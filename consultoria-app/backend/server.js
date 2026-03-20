require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const twilio = require('twilio');

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
  socket.on('offer', ({ target, sdp }) => {
    io.to(target).emit('offer', { caller: socket.id, sdp });
  });

  socket.on('answer', ({ target, sdp }) => {
    io.to(target).emit('answer', { callee: socket.id, sdp });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('ice-candidate', { sender: socket.id, candidate });
  });

  // ========== Collaborative State Sync ==========
  socket.on('update-state', (payload) => {
    // Broadcast to everyone else in the room
    socket.to(payload.roomId).emit('state-updated', payload);
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
