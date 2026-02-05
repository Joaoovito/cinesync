/**
 * Hook para gerenciar conexão Socket.IO
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Platform } from "react-native";

// URL do servidor Socket.IO - evitar erro de window no SSR
function getSocketUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return "http://localhost:4000";
}

interface SyncAction {
  action: "play" | "pause" | "seek";
  roomId: string;
  currentTime?: number;
  seekTime?: number;
  userId?: string;
  timestamp?: number;
}

interface TimeSync {
  roomId: string;
  currentTime: number;
  timestamp: number;
  isPlaying: boolean;
  serverTimestamp?: number;
}

interface RoomState {
  roomId: string;
  hostId: string | null;
  currentTime: number;
  isPlaying: boolean;
  lastUpdate: number;
}

interface UseSocketOptions {
  roomId: string;
  userId: string;
  isHost: boolean;
  onSyncAction?: (action: SyncAction) => void;
  onTimeSync?: (sync: TimeSync) => void;
  onRoomState?: (state: RoomState) => void;
  onUserJoined?: (data: { userId: string; isHost: boolean }) => void;
  onUserLeft?: (data: { userId: string }) => void;
}

export function useSocket(options: UseSocketOptions) {
  const {
    roomId,
    userId,
    isHost,
    onSyncAction,
    onTimeSync,
    onRoomState,
    onUserJoined,
    onUserLeft,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Conectar ao socket
  useEffect(() => {
    if (!roomId || !userId) return;

    const socketUrl = getSocketUrl();
    console.log("[useSocket] Conectando ao servidor:", socketUrl);
    
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Eventos de conexão
    socket.on("connect", () => {
      console.log("[useSocket] Conectado:", socket.id);
      setIsConnected(true);
      setConnectionError(null);

      // Entrar na sala
      socket.emit("join_room", {
        roomId,
        userId,
        isHost,
      });
    });

    socket.on("disconnect", () => {
      console.log("[useSocket] Desconectado");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("[useSocket] Erro de conexão:", error.message);
      setConnectionError(error.message);
    });

    // Eventos de sincronização
    socket.on("sync_action", (action: SyncAction) => {
      console.log("[useSocket] Recebido sync_action:", action);
      onSyncAction?.(action);
    });

    socket.on("time_sync", (sync: TimeSync) => {
      console.log("[useSocket] Recebido time_sync:", sync.currentTime);
      onTimeSync?.(sync);
    });

    socket.on("room_state", (state: RoomState) => {
      console.log("[useSocket] Recebido room_state:", state);
      onRoomState?.(state);
    });

    socket.on("user_joined", (data: { userId: string; isHost: boolean }) => {
      console.log("[useSocket] Usuário entrou:", data.userId);
      onUserJoined?.(data);
    });

    socket.on("user_left", (data: { userId: string }) => {
      console.log("[useSocket] Usuário saiu:", data.userId);
      onUserLeft?.(data);
    });

    // Cleanup
    return () => {
      console.log("[useSocket] Desconectando...");
      socket.emit("leave_room", { roomId, userId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, userId, isHost]);

  // Atualizar callbacks quando mudarem
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Remover listeners antigos e adicionar novos
    socket.off("sync_action");
    socket.off("time_sync");
    socket.off("room_state");
    socket.off("user_joined");
    socket.off("user_left");

    socket.on("sync_action", (action: SyncAction) => {
      onSyncAction?.(action);
    });

    socket.on("time_sync", (sync: TimeSync) => {
      onTimeSync?.(sync);
    });

    socket.on("room_state", (state: RoomState) => {
      onRoomState?.(state);
    });

    socket.on("user_joined", (data: { userId: string; isHost: boolean }) => {
      onUserJoined?.(data);
    });

    socket.on("user_left", (data: { userId: string }) => {
      onUserLeft?.(data);
    });
  }, [onSyncAction, onTimeSync, onRoomState, onUserJoined, onUserLeft]);

  // Emitir ação de sincronização
  const emitSyncAction = useCallback((action: "play" | "pause" | "seek", currentTime?: number, seekTime?: number) => {
    const socket = socketRef.current;
    if (!socket || !isConnected) {
      console.warn("[useSocket] Socket não conectado, não pode emitir");
      return;
    }

    const payload: SyncAction = {
      action,
      roomId,
      currentTime,
      seekTime,
      userId,
      timestamp: Date.now(),
    };

    console.log("[useSocket] Emitindo sync_action:", payload);
    socket.emit("sync_action", payload);
  }, [roomId, userId, isConnected]);

  // Emitir time sync (apenas host)
  const emitTimeSync = useCallback((currentTime: number, isPlaying: boolean) => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !isHost) return;

    socket.emit("time_sync", {
      roomId,
      currentTime,
      timestamp: Date.now(),
      isPlaying,
    });
  }, [roomId, isHost, isConnected]);

  // Solicitar estado da sala
  const requestState = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    socket.emit("request_state", { roomId });
  }, [roomId, isConnected]);

  return {
    isConnected,
    connectionError,
    emitSyncAction,
    emitTimeSync,
    requestState,
  };
}
