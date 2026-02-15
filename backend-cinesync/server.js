const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};

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

// Função para calcular o tempo ATUAL do vídeo baseado no último carimbo
const calculateCurrentTime = (room) => {
  if (!room.isPlaying) return room.currentTime;
  
  const now = Date.now();
  const timeElapsedInSeconds = (now - room.lastActionTime) / 1000;
  return room.currentTime + timeElapsedInSeconds;
};

io.on('connection', (socket) => {
  const userName = socket.handshake.query.displayName || 'Anônimo';

  broadcastRoomList();

  socket.on('join_room', ({ roomId, videoUrl }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        videoUrl: videoUrl || '', 
        isPlaying: false,
        currentTime: 0,
        lastActionTime: Date.now(), // 🔥 Carimbo de tempo
        ownerId: socket.id
      };
    } else if (videoUrl && videoUrl !== rooms[roomId].videoUrl) {
      rooms[roomId].videoUrl = videoUrl;
      rooms[roomId].currentTime = 0;
      rooms[roomId].isPlaying = false;
      io.to(roomId).emit('update_video_source', videoUrl);
    }

    // Calcula o tempo real AGORA para quem está entrando
    const realTime = calculateCurrentTime(rooms[roomId]);

    const newUser = { id: socket.id, displayName: userName, isOwner: rooms[roomId].ownerId === socket.id };
    rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
    rooms[roomId].users.push(newUser);

    // Envia o estado já calculado!
    io.to(socket.id).emit('room_data', {
      users: rooms[roomId].users,
      videoUrl: rooms[roomId].videoUrl,
      ownerId: rooms[roomId].ownerId,
      isPlaying: rooms[roomId].isPlaying,
      currentTime: realTime // <--- O PULO DO GATO
    });

    socket.to(roomId).emit('user_joined', newUser);
    broadcastRoomList();
  });

  socket.on('change_video', ({ roomId, videoUrl }) => {
    if (rooms[roomId]) {
      rooms[roomId].videoUrl = videoUrl;
      rooms[roomId].currentTime = 0;
      rooms[roomId].isPlaying = false;
      io.to(roomId).emit('update_video_source', videoUrl);
      broadcastRoomList(); 
    }
  });

  socket.on('send_message', (data) => {
    socket.to(data.roomId).emit('receive_message', data);
  });

  socket.on('video_control', (data) => {
    const { roomId, action, currentTime } = data;
    if (rooms[roomId]) {
      // Atualiza o estado "base"
      if (typeof currentTime === 'number') {
        rooms[roomId].currentTime = currentTime;
      }
      
      if (action === 'play') {
        rooms[roomId].isPlaying = true;
        rooms[roomId].lastActionTime = Date.now(); // 🔥 Marca a hora do Play
      } 
      else if (action === 'pause') {
        // Quando pausa, calculamos onde parou de verdade
        if (rooms[roomId].isPlaying) {
           // Se estava tocando, atualiza o currentTime somando o que passou
           rooms[roomId].currentTime = calculateCurrentTime(rooms[roomId]);
        }
        rooms[roomId].isPlaying = false;
        rooms[roomId].lastActionTime = Date.now();
      }
      else if (action === 'seek') {
        // No seek, atualizamos a base e o timestamp
        rooms[roomId].currentTime = currentTime;
        rooms[roomId].lastActionTime = Date.now();
      }

      // Avisa a todos
      const syncData = { 
        isPlaying: rooms[roomId].isPlaying, 
        currentTime: rooms[roomId].currentTime 
      };
      
      // Manda para TODOS (inclusive quem enviou, para garantir consistência) se for sync crítico
      // Mas geralmente socket.to(room) para os outros e o cliente local atualiza otimisticamente
      socket.to(roomId).emit('sync_video_state', syncData);
      
      // Se for play/pause/seek, mandamos para o próprio remetente confirmar o tempo calculado pelo server?
      // Por enquanto, vamos confiar que o Host mandou o tempo certo.
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      } else {
        if (rooms[roomId].ownerId === socket.id) {
           rooms[roomId].ownerId = rooms[roomId].users[0].id;
           rooms[roomId].users[0].isOwner = true;
           io.to(roomId).emit('room_data', { ...rooms[roomId], currentTime: calculateCurrentTime(rooms[roomId]) });
        }
        io.to(roomId).emit('user_left', socket.id);
      }
    }
    broadcastRoomList();
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});