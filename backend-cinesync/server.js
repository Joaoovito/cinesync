const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const rooms = {};

const calculateCurrentTime = (room) => {
  if (!room.isPlaying) return room.currentTime;
  const now = Date.now();
  const timeElapsedInSeconds = (now - room.lastActionTime) / 1000;
  return room.currentTime + timeElapsedInSeconds;
};

// Função auxiliar para enviar apenas os dados seguros da sala
const getRoomData = (room) => ({
  users: room.users,
  ownerId: room.ownerId,
  currentVideo: room.currentVideo,
  isPlaying: room.isPlaying,
  currentTime: calculateCurrentTime(room),
  mode: room.mode,
  hasPassword: !!room.password
});

const broadcastRoomList = () => {
  const roomList = Object.keys(rooms).map(roomId => ({
    id: roomId,
    userCount: rooms[roomId].users.length,
    hasVideo: !!rooms[roomId].currentVideo,
    hasPassword: !!rooms[roomId].password
  }));
  roomList.sort((a, b) => b.userCount - a.userCount);
  io.emit('active_rooms', roomList);
};

io.on('connection', (socket) => {
  const userName = socket.handshake.query.displayName || 'Anônimo';

  // 1. ENTRAR NA SALA E VERIFICAÇÃO DE SENHA
  socket.on('join_room', ({ roomId, videoUrl, password }) => {
    if (!rooms[roomId]) {
      // Cria a sala com a nova estrutura
      rooms[roomId] = {
        users: [],
        ownerId: socket.id,
        password: password || null,
        currentVideo: videoUrl || '',
        isPlaying: false,
        currentTime: 0,
        lastActionTime: Date.now(),
        messages: [],
        mode: 1, // 1: Ditador, 2: Sugestões, 3: Democracia
        queue: [] // Array de vídeos na fila
      };
    } else if (rooms[roomId].password && rooms[roomId].password !== password) {
      // Senha incorreta
      return socket.emit('access_denied', { message: 'Senha incorreta para esta sala.' });
    }

    socket.join(roomId);
    
    // Atualiza a lista de usuários
    const newUser = { id: socket.id, displayName: userName, isOwner: rooms[roomId].ownerId === socket.id };
    rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
    rooms[roomId].users.push(newUser);

    // Envia o estado completo para quem acabou de entrar
    io.to(socket.id).emit('room_data', getRoomData(rooms[roomId]));
    io.to(socket.id).emit('queue_updated', rooms[roomId].queue);
    io.to(socket.id).emit('chat_history', rooms[roomId].messages);
    // Avisa os outros
    socket.to(roomId).emit('user_joined', newUser);
    broadcastRoomList();
  });

  // 2. EXPULSÃO DE USUÁRIO (KICK)
  socket.on('kick_user', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (room && room.ownerId === socket.id) {
      room.users = room.users.filter(u => u.id !== targetId);
      
      // Avisa o usuário que ele foi expulso para o frontend dele forçar a saída
      io.to(targetId).emit('you_were_kicked'); 
      
      // Força o socket a sair do canal de comunicação
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) targetSocket.leave(roomId);
      
      // Atualiza o resto da sala
      io.to(roomId).emit('room_data', getRoomData(room));
      broadcastRoomList();
    }
  });

  // 3. MUDANÇA DE MODO DA SALA
  socket.on('change_mode', ({ roomId, mode }) => {
    const room = rooms[roomId];
    if (room && room.ownerId === socket.id && [1, 2, 3].includes(mode)) {
      room.mode = mode;
      io.to(roomId).emit('room_data', getRoomData(room)); // Avisa a sala da mudança
    }
  });

  // 4. ADICIONAR VÍDEO À FILA
  socket.on('add_to_queue', ({ roomId, url }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    // Regra: No modo 1, só o Host adiciona.
    if (room.mode === 1 && room.ownerId !== socket.id) return;

    const videoItem = {
      id: Math.random().toString(36).substring(2, 15), // Gera um ID único simples
      url,
      addedBy: userName,
      votes: []
    };
    
    room.queue.push(videoItem);
    io.to(roomId).emit('queue_updated', room.queue);
  });

  // 5. VOTAR EM UM VÍDEO (SISTEMA DE VOTO ÚNICO E ORDENAÇÃO)
  socket.on('vote_video', ({ roomId, videoId }) => {
    const room = rooms[roomId];
    if (!room || room.mode !== 3) return;

    // Descobre se o usuário já tinha votado NESTE vídeo específico antes de mexer na fila
    const targetVideo = room.queue.find(v => v.id === videoId);
    if (!targetVideo) return;
    const hasVotedForTarget = targetVideo.votes.includes(socket.id);

    // 1º Passo: Recria a fila inteira do zero, removendo o voto deste usuário de TODOS os vídeos
    room.queue = room.queue.map(video => ({
      ...video,
      votes: video.votes.filter(id => id !== socket.id)
    }));

    // 2º Passo: Se ele não estava apenas tentando remover o voto, adiciona o voto no novo vídeo
    if (!hasVotedForTarget) {
      const newTarget = room.queue.find(v => v.id === videoId);
      if (newTarget) newTarget.votes.push(socket.id);
    }

    // 3º Passo: Reordena a fila instantaneamente (Maior número de votos para o menor)
    room.queue.sort((a, b) => b.votes.length - a.votes.length);

    // 4º Passo: Atualiza a interface de todos na sala
    io.to(roomId).emit('queue_updated', room.queue);
  });

  
  // 6. AVANÇAR PARA O PRÓXIMO VÍDEO (GATILHO AUTOMÁTICO OU MANUAL)
  socket.on('play_next', ({ roomId, forceVideoId }) => {
    const room = rooms[roomId];
    if (!room || room.ownerId !== socket.id) return; // Apenas o Host dispara o play_next

    if (room.queue.length === 0) {
      // Fila vazia, entra em modo de espera
      room.currentVideo = '';
      room.isPlaying = false;
      room.currentTime = 0;
    } else {
      let nextVideo;

      // Se o host clicou num vídeo específico da fila (Modos 1 e 2)
      if (forceVideoId && room.mode !== 3) {
        const idx = room.queue.findIndex(v => v.id === forceVideoId);
        if (idx !== -1) {
          nextVideo = room.queue[idx];
          room.queue.splice(idx, 1);
        }
      }

      // Lógica Padrão: Pega o próximo (ou o mais votado no Modo 3)
      if (!nextVideo) {
        if (room.mode === 3) {
          // Desempate: quem tiver mais votos sobe. (Se empate, o mais antigo ganha).
          room.queue.sort((a, b) => b.votes.length - a.votes.length);
        }
        nextVideo = room.queue.shift(); // Remove e pega o primeiro da lista
      }

      room.currentVideo = nextVideo.url;
      room.isPlaying = true;
      room.currentTime = 0;
      room.lastActionTime = Date.now();
    }

    // Atualiza a sala inteira com o novo vídeo e a fila atualizada
    io.to(roomId).emit('room_data', getRoomData(room));
    io.to(roomId).emit('queue_updated', room.queue);
    io.to(roomId).emit('sync_video_state', { isPlaying: room.isPlaying, currentTime: room.currentTime });
    broadcastRoomList();
  });

  // CONTROLES DE VÍDEO (Sincronia Existente)
  socket.on('request_individual_sync', ({ roomId }) => {
    if (rooms[roomId]) {
      socket.emit('sync_video_state', { isPlaying: rooms[roomId].isPlaying, currentTime: calculateCurrentTime(rooms[roomId]) });
    }
  });

  socket.on('video_control', (data) => {
    const { roomId, action, currentTime } = data;
    if (rooms[roomId]) {
      if (typeof currentTime === 'number') rooms[roomId].currentTime = currentTime;
      else rooms[roomId].currentTime = calculateCurrentTime(rooms[roomId]);

      if (action === 'play') { rooms[roomId].isPlaying = true; rooms[roomId].lastActionTime = Date.now(); }
      else if (action === 'pause') { rooms[roomId].isPlaying = false; rooms[roomId].lastActionTime = Date.now(); }
      else if (action === 'seek') { rooms[roomId].lastActionTime = Date.now(); }

      socket.to(roomId).emit('sync_video_state', { isPlaying: rooms[roomId].isPlaying, currentTime: rooms[roomId].currentTime });
    }
  });


  socket.on('send_message', ({ roomId, text }) => {
    const room = rooms[roomId];
    if (!room || !text || !text.trim()) return;

    const message = {
      id: Math.random().toString(36).substring(2, 15),
      text: text.trim(),
      sender: userName,
      senderId: socket.id,
      timestamp: Date.now()
    };

    // Guarda e mantém apenas as últimas 50 mensagens para não pesar a RAM
    room.messages.push(message);
    if (room.messages.length > 50) room.messages.shift();

    io.to(roomId).emit('new_message', message);
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
      
      // Limpa os votos deixados por este usuário na fila
      rooms[roomId].queue.forEach(v => {
        v.votes = v.votes.filter(id => id !== socket.id);
      });

      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      } else if (rooms[roomId].ownerId === socket.id) {
        rooms[roomId].ownerId = rooms[roomId].users[0].id;
        rooms[roomId].users[0].isOwner = true;
        io.to(roomId).emit('room_data', getRoomData(rooms[roomId]));
      }
    }
    broadcastRoomList();
  });
});

server.listen(3000, '0.0.0.0', () => console.log(`🚀 Servidor CineSync na porta 3000`));