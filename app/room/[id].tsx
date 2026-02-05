/**
 * Tela de Sala - Sincronização via Socket.IO
 * 
 * Arquitetura:
 * 1. Conecta ao servidor Socket.IO ao entrar na sala
 * 2. Botões de controle emitem eventos ao servidor
 * 3. Servidor retransmite para todos na sala
 * 4. Player executa ações apenas ao receber eventos
 * 5. Host envia time_sync a cada 2 segundos
 */

import { Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { VideoPlayerSync, VideoPlayerSyncRef } from "@/components/video-player-sync";
import { ChatRoom } from "@/components/chat-room";
import { NotificationToast, type NotificationType } from "@/components/notification-toast";
import { useSocket } from "@/hooks/use-socket";

interface ChatMessage {
  id: number;
  userId: number;
  message: string;
  createdAt: Date;
  isOwn: boolean;
  userName?: string;
}

export default function RoomScreen() {
  const router = useRouter();
  const colors = useColors();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const roomId = Number(id);
  const roomIdStr = String(roomId);

  // Queries
  const { data: room, isLoading: roomLoading } = trpc.rooms.get.useQuery({ id: roomId });
  const { data: messages, refetch: refetchMessages } = trpc.chat.messages.useQuery({
    roomId,
    limit: 50,
  }, { refetchInterval: 2000 });
  const { data: participantCount } = trpc.participants.count.useQuery({ roomId }, { refetchInterval: 3000 });

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [isHost, setIsHost] = useState(false);
  
  // Refs
  const playerRef = useRef<VideoPlayerSyncRef>(null);
  const previousParticipantCount = useRef<number | undefined>(undefined);
  const timeSyncInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const localTimeRef = useRef(0);

  // Mutations
  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      refetchMessages();
    },
  });

  // Verificar se o usuário é o host (criador da sala)
  useEffect(() => {
    if (room && user) {
      const userIsHost = room.creatorId === user.id;
      setIsHost(userIsHost);
      console.log("[Room] User is host:", userIsHost, "creatorId:", room.creatorId, "userId:", user.id);
    }
  }, [room, user]);

  // ==================== SOCKET.IO ====================

  // Callback para receber ações de sincronização
  const handleSyncAction = useCallback((action: {
    action: "play" | "pause" | "seek";
    currentTime?: number;
    seekTime?: number;
  }) => {
    console.log("[Room] Recebido sync_action:", action);
    
    switch (action.action) {
      case "play":
        setIsPlaying(true);
        if (action.currentTime !== undefined) {
          setCurrentTime(action.currentTime);
          localTimeRef.current = action.currentTime;
        }
        break;
      case "pause":
        setIsPlaying(false);
        if (action.currentTime !== undefined) {
          setCurrentTime(action.currentTime);
          localTimeRef.current = action.currentTime;
        }
        break;
      case "seek":
        if (action.seekTime !== undefined) {
          setCurrentTime(action.seekTime);
          localTimeRef.current = action.seekTime;
          playerRef.current?.seekTo(action.seekTime);
        }
        break;
    }
  }, []);

  // Callback para receber time_sync do host
  const handleTimeSync = useCallback((sync: {
    currentTime: number;
    isPlaying: boolean;
  }) => {
    // Não aplicar se for o host (ele é quem envia)
    if (isHost) return;
    
    const localTime = localTimeRef.current;
    const diff = Math.abs(sync.currentTime - localTime);
    
    // Se diferença > 2 segundos, corrigir
    if (diff > 2) {
      console.log("[Room] Correção de tempo do host:", sync.currentTime, "diff:", diff.toFixed(1));
      setCurrentTime(sync.currentTime);
      localTimeRef.current = sync.currentTime;
      playerRef.current?.seekTo(sync.currentTime);
    }
    
    // Sincronizar play/pause
    if (sync.isPlaying !== isPlaying) {
      setIsPlaying(sync.isPlaying);
    }
  }, [isHost, isPlaying]);

  // Callback para estado inicial da sala
  const handleRoomState = useCallback((state: {
    currentTime: number;
    isPlaying: boolean;
  }) => {
    console.log("[Room] Estado inicial da sala:", state);
    setCurrentTime(state.currentTime);
    setIsPlaying(state.isPlaying);
    localTimeRef.current = state.currentTime;
  }, []);

  // Callback para usuário entrou
  const handleUserJoined = useCallback((data: { userId: string }) => {
    setNotification({
      message: "Um novo usuário entrou na sala",
      type: "user-joined",
    });
  }, []);

  // Callback para usuário saiu
  const handleUserLeft = useCallback((data: { userId: string }) => {
    setNotification({
      message: "Um usuário saiu da sala",
      type: "user-left",
    });
  }, []);

  // Hook do Socket.IO
  const { isConnected, connectionError, emitSyncAction, emitTimeSync } = useSocket({
    roomId: roomIdStr,
    userId: String(user?.id || "anonymous"),
    isHost,
    onSyncAction: handleSyncAction,
    onTimeSync: handleTimeSync,
    onRoomState: handleRoomState,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
  });

  // ==================== TIME SYNC DO HOST ====================

  // Host envia time_sync a cada 2 segundos
  useEffect(() => {
    if (!isHost || !isConnected) return;

    // Limpar interval anterior
    if (timeSyncInterval.current) {
      clearInterval(timeSyncInterval.current);
    }

    // Enviar time_sync a cada 2 segundos
    timeSyncInterval.current = setInterval(() => {
      const currentVideoTime = localTimeRef.current;
      console.log("[Host] Enviando time_sync:", currentVideoTime.toFixed(1));
      emitTimeSync(currentVideoTime, isPlaying);
    }, 2000);

    return () => {
      if (timeSyncInterval.current) {
        clearInterval(timeSyncInterval.current);
      }
    };
  }, [isHost, isConnected, isPlaying, emitTimeSync]);

  // ==================== HANDLERS ====================

  // Handler para play request - EMITE EVENTO
  const handlePlayRequest = useCallback(() => {
    console.log("[Room] Emitindo play_request");
    emitSyncAction("play", localTimeRef.current);
  }, [emitSyncAction]);

  // Handler para pause request - EMITE EVENTO
  const handlePauseRequest = useCallback(() => {
    console.log("[Room] Emitindo pause_request");
    emitSyncAction("pause", localTimeRef.current);
  }, [emitSyncAction]);

  // Handler para seek request - EMITE EVENTO
  const handleSeekRequest = useCallback((seekTime: number) => {
    console.log("[Room] Emitindo seek_request:", seekTime);
    emitSyncAction("seek", undefined, seekTime);
  }, [emitSyncAction]);

  // Handler para atualização de tempo local
  const handleTimeUpdate = useCallback((time: number) => {
    localTimeRef.current = time;
  }, []);

  // Formatar mensagens do chat
  useEffect(() => {
    if (messages) {
      const formatted = messages.map((msg: any) => ({
        ...msg,
        isOwn: msg.userId === user?.id,
        userName: msg.userId === user?.id ? "Você" : `Usuário ${msg.userId}`,
      }));
      setChatMessages(formatted);
    }
  }, [messages, user?.id]);

  // Handler para enviar mensagem
  const handleSendMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    sendMessageMutation.mutate({
      roomId,
      message: message.trim(),
    });
  }, [roomId, sendMessageMutation]);

  // Handler para sair da sala
  const handleLeaveRoom = useCallback(() => {
    // Se for o host, pausar antes de sair
    if (isHost) {
      emitSyncAction("pause", localTimeRef.current);
    }
    router.back();
  }, [isHost, emitSyncAction, router]);

  if (roomLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Carregando sala...</Text>
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text className="text-foreground mt-4">Sala não encontrada</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          className="mt-4 bg-primary px-6 py-2 rounded-full"
        >
          <Text className="text-white font-semibold">Voltar</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0 flex-1">
      {/* Notificações */}
      {notification && (
        <NotificationToast
          message={notification.message}
          type={notification.type}
          duration={3000}
          onDismiss={() => setNotification(null)}
        />
      )}
      
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-3 border-b border-border"
        style={{ borderColor: colors.border }}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
              {room.name}
            </Text>
            {isHost && (
              <View className="bg-primary/20 px-2 py-0.5 rounded">
                <Text className="text-xs text-primary font-semibold">HOST</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center mt-1 gap-3">
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-success mr-2" />
              <Text className="text-xs text-muted">
                {participantCount || 0} {participantCount === 1 ? "pessoa" : "pessoas"}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons 
                name={isConnected ? "wifi" : "wifi-outline"} 
                size={12} 
                color={isConnected ? colors.success : colors.error} 
              />
              <Text className="text-xs text-muted ml-1">
                {isConnected ? "Conectado" : connectionError || "Desconectado"}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleLeaveRoom}
          className="w-10 h-10 rounded-full bg-error/10 items-center justify-center"
          activeOpacity={0.7}
        >
          <Ionicons name="exit" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Player de Vídeo */}
      <View className="px-4 py-3">
        <VideoPlayerSync
          ref={playerRef}
          videoId={room.videoId}
          platform={room.platform}
          title={room.videoTitle}
          isPlaying={isPlaying}
          currentTime={currentTime}
          onPlayRequest={handlePlayRequest}
          onPauseRequest={handlePauseRequest}
          onSeekRequest={handleSeekRequest}
          onTimeUpdate={handleTimeUpdate}
        />
      </View>

      {/* Controles de Vídeo */}
      <View 
        className="flex-row items-center justify-between px-4 py-3 bg-surface border-b border-border"
        style={{ borderColor: colors.border }}
      >
        <TouchableOpacity
          onPress={isPlaying ? handlePauseRequest : handlePlayRequest}
          className="flex-row items-center gap-2"
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPlaying ? "pause-circle" : "play-circle"}
            size={28}
            color={colors.primary}
          />
          <Text className="text-sm font-medium text-foreground">
            {isPlaying ? "Reproduzindo" : "Pausado"}
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1">
            <Ionicons 
              name={isConnected ? "sync" : "sync-outline"} 
              size={14} 
              color={isConnected ? colors.success : colors.muted} 
            />
            <Text className="text-xs text-muted">
              {isHost ? "Host" : "Sincronizado"}
            </Text>
          </View>
        </View>
      </View>

      {/* Chat */}
      <ChatRoom
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isSending={sendMessageMutation.isPending}
        currentUserId={user?.id}
      />
    </ScreenContainer>
  );
}
