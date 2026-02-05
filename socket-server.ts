/**
 * Socket.IO Server para Sincronização de Vídeo
 * 
 * Este servidor gerencia a sincronização em tempo real entre usuários
 * que estão assistindo o mesmo vídeo em uma sala.
 * 
 * Porta: 4000
 */

import { Server, Socket } from "socket.io";
import { createServer } from "http";

const PORT = 4000;

// Tipos de eventos
interface SyncActionPayload {
  action: "play" | "pause" | "seek";
  roomId: string;
  currentTime?: number;
  seekTime?: number;
  userId?: string;
  timestamp?: number;
}

interface JoinRoomPayload {
  roomId: string;
  userId: string;
  isHost?: boolean;
}

interface TimeSyncPayload {
  roomId: string;
  currentTime: number;
  timestamp: number;
  isPlaying: boolean;
}

interface RoomState {
  hostId: string | null;
  currentTime: number;
  isPlaying: boolean;
  lastUpdate: number;
}

// Estado das salas
const roomStates = new Map<string, RoomState>();

// Criar servidor HTTP
const httpServer = createServer();

// Criar servidor Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Em produção, restringir para domínios específicos
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Função para obter ou criar estado da sala
function getRoomState(roomId: string): RoomState {
  if (!roomStates.has(roomId)) {
    roomStates.set(roomId, {
      hostId: null,
      currentTime: 0,
      isPlaying: false,
      lastUpdate: Date.now(),
    });
  }
  return roomStates.get(roomId)!;
}

// Conexão de socket
io.on("connection", (socket: Socket) => {
  console.log(`[Socket] Cliente conectado: ${socket.id}`);

  // Entrar em uma sala
  socket.on("join_room", (payload: JoinRoomPayload) => {
    const { roomId, userId, isHost } = payload;
    
    socket.join(roomId);
    console.log(`[Socket] Usuário ${userId} entrou na sala ${roomId} (host: ${isHost})`);
    
    // Atualizar estado da sala
    const roomState = getRoomState(roomId);
    
    // Se for o host, definir como host da sala
    if (isHost) {
      roomState.hostId = userId;
      console.log(`[Socket] Host da sala ${roomId} definido: ${userId}`);
    }
    
    // Enviar estado atual para o novo usuário
    socket.emit("room_state", {
      roomId,
      ...roomState,
    });
    
    // Notificar outros usuários
    socket.to(roomId).emit("user_joined", {
      userId,
      isHost,
    });
  });

  // Sair de uma sala
  socket.on("leave_room", (payload: { roomId: string; userId: string }) => {
    const { roomId, userId } = payload;
    
    socket.leave(roomId);
    console.log(`[Socket] Usuário ${userId} saiu da sala ${roomId}`);
    
    // Se era o host, limpar
    const roomState = getRoomState(roomId);
    if (roomState.hostId === userId) {
      roomState.hostId = null;
      console.log(`[Socket] Host da sala ${roomId} removido`);
    }
    
    // Notificar outros usuários
    socket.to(roomId).emit("user_left", { userId });
  });

  // Ação de sincronização (play, pause, seek)
  socket.on("sync_action", (payload: SyncActionPayload) => {
    const { action, roomId, currentTime, seekTime, userId, timestamp } = payload;
    
    console.log(`[Socket] Ação de sync: ${action} na sala ${roomId} por ${userId}`);
    
    // Atualizar estado da sala
    const roomState = getRoomState(roomId);
    roomState.lastUpdate = Date.now();
    
    switch (action) {
      case "play":
        roomState.isPlaying = true;
        if (currentTime !== undefined) {
          roomState.currentTime = currentTime;
        }
        break;
      case "pause":
        roomState.isPlaying = false;
        if (currentTime !== undefined) {
          roomState.currentTime = currentTime;
        }
        break;
      case "seek":
        if (seekTime !== undefined) {
          roomState.currentTime = seekTime;
        }
        break;
    }
    
    // Retransmitir para TODOS na sala (incluindo quem enviou)
    io.to(roomId).emit("sync_action", {
      action,
      roomId,
      currentTime: roomState.currentTime,
      seekTime,
      userId,
      timestamp: timestamp || Date.now(),
    });
    
    console.log(`[Socket] Retransmitido ${action} para sala ${roomId}`);
  });

  // Time sync do Host (enviado a cada 2 segundos)
  socket.on("time_sync", (payload: TimeSyncPayload) => {
    const { roomId, currentTime, timestamp, isPlaying } = payload;
    
    // Atualizar estado da sala
    const roomState = getRoomState(roomId);
    roomState.currentTime = currentTime;
    roomState.isPlaying = isPlaying;
    roomState.lastUpdate = Date.now();
    
    // Retransmitir para outros na sala (não para quem enviou)
    socket.to(roomId).emit("time_sync", {
      roomId,
      currentTime,
      timestamp,
      isPlaying,
      serverTimestamp: Date.now(),
    });
  });

  // Solicitar estado atual da sala
  socket.on("request_state", (payload: { roomId: string }) => {
    const { roomId } = payload;
    const roomState = getRoomState(roomId);
    
    socket.emit("room_state", {
      roomId,
      ...roomState,
    });
  });

  // Desconexão
  socket.on("disconnect", () => {
    console.log(`[Socket] Cliente desconectado: ${socket.id}`);
  });
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`[Socket.IO] Servidor rodando na porta ${PORT}`);
  console.log(`[Socket.IO] Pronto para conexões WebSocket`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Socket.IO] Encerrando servidor...");
  io.close(() => {
    console.log("[Socket.IO] Servidor encerrado");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[Socket.IO] Encerrando servidor...");
  io.close(() => {
    console.log("[Socket.IO] Servidor encerrado");
    process.exit(0);
  });
});
