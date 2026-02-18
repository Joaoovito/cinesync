const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};

const calculateCurrentTime = (room) => {
  if (!room.isPlaying) return room.currentTime;
  const now = Date.now();
  const timeElapsedInSeconds = (now - room.lastActionTime) / 1000;
  return room.currentTime + timeElapsedInSeconds;
};

const broadcastRoomList = () => {
  const roomList = Object.keys(rooms).map(roomId => ({
    id: roomId,
    userCount: rooms[roomId].users.length,
    videoUrl: rooms[roomId].videoUrl,
    hasVideo: !!rooms[roomId].videoUrl
  }));
  roomList.sort((a, b) => b.userCount - a.userCount);
  io.emit('active_rooms', roomList);
};

io.on('connection', (socket) => {
  const userName = socket.handshake.query.displayName || 'Anônimo';

  socket.on('join_room', ({ roomId, videoUrl }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        videoUrl: videoUrl || '', 
        isPlaying: false,
        currentTime: 0,
        lastActionTime: Date.now(),
        ownerId: socket.id
      };
    }
    const realTime = calculateCurrentTime(rooms[roomId]);
    const newUser = { id: socket.id, displayName: userName, isOwner: rooms[roomId].ownerId === socket.id };
    rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
    rooms[roomId].users.push(newUser);

    io.to(socket.id).emit('room_data', {
      users: rooms[roomId].users,
      videoUrl: rooms[roomId].videoUrl,
      ownerId: rooms[roomId].ownerId,
      isPlaying: rooms[roomId].isPlaying,
      currentTime: realTime
    });
    socket.to(roomId).emit('user_joined', newUser);
    broadcastRoomList();
  });

  // 🔥 NOVO: Atende pedidos de sincronia individuais (Estratégia Econômica)
  socket.on('request_individual_sync', ({ roomId }) => {
    if (rooms[roomId]) {
      const realTime = calculateCurrentTime(rooms[roomId]);
      socket.emit('sync_video_state', { 
        isPlaying: rooms[roomId].isPlaying, 
        currentTime: realTime 
      });
    }
  });

  socket.on('video_control', (data) => {
    const { roomId, action, currentTime } = data;
    if (rooms[roomId]) {
      // Prioridade ao tempo enviado pelo Host para evitar resets
      if (typeof currentTime === 'number') {
        rooms[roomId].currentTime = currentTime;
      } else {
        rooms[roomId].currentTime = calculateCurrentTime(rooms[roomId]);
      }

      if (action === 'play') {
        rooms[roomId].isPlaying = true;
        rooms[roomId].lastActionTime = Date.now();
      } else if (action === 'pause') {
        rooms[roomId].isPlaying = false;
        rooms[roomId].lastActionTime = Date.now();
      } else if (action === 'seek') {
        rooms[roomId].lastActionTime = Date.now();
      }

      socket.to(roomId).emit('sync_video_state', { 
        isPlaying: rooms[roomId].isPlaying, 
        currentTime: rooms[roomId].currentTime 
      });
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      } else if (rooms[roomId].ownerId === socket.id) {
        rooms[roomId].ownerId = rooms[roomId].users[0].id;
        rooms[roomId].users[0].isOwner = true;
        io.to(roomId).emit('room_data', { ...rooms[roomId], currentTime: calculateCurrentTime(rooms[roomId]) });
      }
    }
    broadcastRoomList();
  });
});

server.listen(3000, '0.0.0.0', () => console.log(`🚀 Servidor CineSync na porta 3000`));