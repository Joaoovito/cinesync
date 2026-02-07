const { Server } = require("socket.io");

const io = new Server({
  cors: { origin: "*" },
});

// MEMÓRIA DAS SALAS
// Guarda: { 'sala-1': { isPlaying: false, lastVideoTime: 0, viewers: 1, ... } }
const rooms = {};

console.log("📡 Servidor CineSync (Lista de Salas) rodando na porta 3000...");

// Função para enviar lista atualizada para todos
const broadcastRoomList = () => {
  const roomList = Object.keys(rooms).map((key) => ({
    id: key,
    viewers: rooms[key].viewers || 0,
    isPlaying: rooms[key].isPlaying
  }));
  io.emit("rooms_update", roomList);
};

io.on("connection", (socket) => {
  console.log(`Novo usuário: ${socket.id}`);
  
  // 1. Envia a lista assim que conecta
  broadcastRoomList();

  // 2. Criar ou Entrar em Sala
  socket.on("join_room", (roomId) => {
    socket.join(roomId);

    // Se sala não existe, cria na memória
    if (!rooms[roomId]) {
      rooms[roomId] = { 
        isPlaying: false, 
        lastVideoTime: 0, 
        lastUpdateAt: Date.now(), 
        viewers: 0 
      };
    }
    
    rooms[roomId].viewers += 1;
    broadcastRoomList(); // Avisa a todos que tem gente nova na sala

    // Sincronia Inteligente (Smart Sync)
    const room = rooms[roomId];
    let syncTime = room.lastVideoTime;
    if (room.isPlaying) {
      const timePassed = (Date.now() - room.lastUpdateAt) / 1000;
      syncTime += timePassed;
    }

    socket.emit("receive_action", {
      type: room.isPlaying ? 'play' : 'pause',
      value: syncTime,
      forceSync: true
    });
  });

  // 3. Receber Ações (Play/Pause/Seek)
  socket.on("send_action", (data) => {
    if (!rooms[data.roomId]) return;

    // Atualiza estado da sala
    rooms[data.roomId] = {
      ...rooms[data.roomId],
      isPlaying: data.type === 'play' || (data.type === 'sync_time' && rooms[data.roomId].isPlaying),
      lastVideoTime: data.value,
      lastUpdateAt: Date.now()
    };
    
    // Repassa ação para os outros
    socket.to(data.roomId).emit("receive_action", data);
    
    // Se mudou Play/Pause, atualiza o status "LIVE" na lista da home
    if (data.type === 'play' || data.type === 'pause') {
      broadcastRoomList();
    }
  });

  // 4. Usuário Saiu
  socket.on("disconnecting", () => {
    const userRooms = socket.rooms;
    for (const room of userRooms) {
      if (rooms[room]) {
        rooms[room].viewers -= 1;
        // Se a sala ficou vazia, deleta ela da lista
        if (rooms[room].viewers <= 0) {
          delete rooms[room];
        }
      }
    }
    broadcastRoomList();
  });
});

io.listen(3000);