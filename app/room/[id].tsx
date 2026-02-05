import { Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { VideoPlayerSync } from "@/components/video-player-sync";
import { ChatRoom } from "@/components/chat-room";
import { NotificationToast, type NotificationType } from "@/components/notification-toast";

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

  // Queries
  const { data: room, isLoading: roomLoading } = trpc.rooms.get.useQuery({ id: roomId });
  const { data: messages, refetch: refetchMessages } = trpc.chat.messages.useQuery({
    roomId,
    limit: 50,
  }, { refetchInterval: 2000 });
  const { data: participantCount } = trpc.participants.count.useQuery({ roomId }, { refetchInterval: 3000 });
  
  // Query de sincronização - polling rápido para receber comandos
  const { data: syncState, refetch: refetchSyncState } = trpc.rooms.getSyncState.useQuery(
    { roomId },
    { refetchInterval: 500 } // Polling a cada 500ms para sincronização rápida
  );

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [isHost, setIsHost] = useState(false);
  
  // Refs para evitar loops e controlar sincronização
  const previousParticipantCount = useRef<number | undefined>(undefined);
  const isInitialized = useRef(false);
  const lastServerState = useRef<{ isPlaying: boolean | null; currentTime: number }>({
    isPlaying: null,
    currentTime: 0,
  });
  const localTimeRef = useRef(0); // Tempo local do player
  const timeSyncInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCommand = useRef<"play" | "pause" | "seek" | null>(null);

  // Mutations para enviar comandos ao servidor
  const playRequestMutation = trpc.rooms.playRequest.useMutation({
    onSuccess: () => {
      console.log("[Sync] Play request enviado ao servidor");
      refetchSyncState();
    },
  });

  const pauseRequestMutation = trpc.rooms.pauseRequest.useMutation({
    onSuccess: () => {
      console.log("[Sync] Pause request enviado ao servidor");
      refetchSyncState();
    },
  });

  const seekRequestMutation = trpc.rooms.seekRequest.useMutation({
    onSuccess: () => {
      console.log("[Sync] Seek request enviado ao servidor");
      refetchSyncState();
    },
  });

  const timeSyncMutation = trpc.rooms.timeSync.useMutation();

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

  // Inicializar estado do vídeo quando carregar da sala
  useEffect(() => {
    if (syncState && !isInitialized.current) {
      console.log("[Room] Inicializando com estado salvo:", syncState);
      setIsPlaying(syncState.isPlaying ?? false);
      setCurrentTime(syncState.currentTime ?? 0);
      localTimeRef.current = syncState.currentTime ?? 0;
      isInitialized.current = true;
      lastServerState.current = {
        isPlaying: syncState.isPlaying ?? null,
        currentTime: syncState.currentTime ?? 0,
      };
    }
  }, [syncState]);

  // ==================== SINCRONIZAÇÃO VIA POLLING ====================
  
  // Receber comandos do servidor (play/pause/seek)
  useEffect(() => {
    if (!syncState || !isInitialized.current) return;

    // Detectar mudança de play/pause
    if (syncState.isPlaying !== null && syncState.isPlaying !== undefined && syncState.isPlaying !== lastServerState.current.isPlaying) {
      console.log("[Sync] Comando recebido:", syncState.isPlaying ? "PLAY" : "PAUSE");
      setIsPlaying(syncState.isPlaying);
      lastServerState.current.isPlaying = syncState.isPlaying;
    }

    // Detectar mudança de tempo (seek) - tolerância de 2 segundos
    if (syncState.currentTime !== null && syncState.currentTime !== undefined) {
      const serverTime = syncState.currentTime;
      const localTime = localTimeRef.current;
      const diff = Math.abs(serverTime - localTime);
      
      // Se a diferença for maior que 2 segundos, fazer seek
      if (diff > 2) {
        console.log("[Sync] Correção de tempo:", serverTime, "diff:", diff.toFixed(1), "s");
        setCurrentTime(serverTime);
        localTimeRef.current = serverTime;
        lastServerState.current.currentTime = serverTime;
      }
    }
  }, [syncState?.isPlaying, syncState?.currentTime]);

  // ==================== TIME SYNC DO HOST ====================
  
  // Host envia time_sync a cada 2 segundos
  useEffect(() => {
    if (!isHost || !isInitialized.current) return;

    // Limpar interval anterior
    if (timeSyncInterval.current) {
      clearInterval(timeSyncInterval.current);
    }

    // Enviar time_sync a cada 2 segundos
    timeSyncInterval.current = setInterval(() => {
      if (isPlaying) {
        const currentVideoTime = localTimeRef.current;
        console.log("[Host] Enviando time_sync:", currentVideoTime.toFixed(1));
        
        timeSyncMutation.mutate({
          roomId,
          currentTime: currentVideoTime,
          timestamp: Date.now(),
        });
      }
    }, 2000);

    return () => {
      if (timeSyncInterval.current) {
        clearInterval(timeSyncInterval.current);
      }
    };
  }, [isHost, isPlaying, roomId, timeSyncMutation]);

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

  // Notificações de entrada/saída
  useEffect(() => {
    if (participantCount !== undefined) {
      if (previousParticipantCount.current !== undefined) {
        if (participantCount > previousParticipantCount.current) {
          setNotification({
            message: `Um novo usuário entrou na sala`,
            type: "user-joined",
          });
        } else if (participantCount < previousParticipantCount.current) {
          setNotification({
            message: `Um usuário saiu da sala`,
            type: "user-left",
          });
        }
      }
      previousParticipantCount.current = participantCount;
    }
  }, [participantCount]);

  // ==================== HANDLERS DE CONTROLE ====================

  // Handler para play/pause - ENVIA REQUEST AO SERVIDOR, NÃO EXECUTA LOCALMENTE
  const handlePlayRequest = useCallback(() => {
    if (isPlaying) {
      // Solicitar PAUSE ao servidor
      console.log("[Control] Enviando pause_request");
      pauseRequestMutation.mutate({
        roomId,
        currentTime: Math.floor(localTimeRef.current),
      });
    } else {
      // Solicitar PLAY ao servidor
      console.log("[Control] Enviando play_request");
      playRequestMutation.mutate({
        roomId,
        currentTime: Math.floor(localTimeRef.current),
      });
    }
  }, [isPlaying, roomId, playRequestMutation, pauseRequestMutation]);

  // Handler para seek - ENVIA REQUEST AO SERVIDOR
  const handleSeekRequest = useCallback((seekTime: number) => {
    console.log("[Control] Enviando seek_request:", seekTime);
    seekRequestMutation.mutate({
      roomId,
      seekTime: Math.floor(seekTime),
    });
  }, [roomId, seekRequestMutation]);

  // Handler para atualização de tempo local (do player)
  const handleTimeUpdate = useCallback((time: number) => {
    localTimeRef.current = time;
    setCurrentTime(time);
  }, []);

  // Handler quando o player muda play/pause localmente (para sincronizar estado visual)
  const handleLocalPlayPause = useCallback((playing: boolean) => {
    // Este callback é chamado pelo player quando o estado muda
    // Não enviamos request aqui, apenas atualizamos o estado visual
    // O request é enviado pelo handlePlayRequest
  }, []);

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
      pauseRequestMutation.mutate({
        roomId,
        currentTime: Math.floor(localTimeRef.current),
      });
    }
    router.back();
  }, [roomId, isHost, pauseRequestMutation, router]);

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
          <View className="flex-row items-center mt-1">
            <View className="w-2 h-2 rounded-full bg-success mr-2" />
            <Text className="text-xs text-muted">
              {participantCount || 0} {participantCount === 1 ? "pessoa" : "pessoas"} online
            </Text>
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
          videoId={room.videoId}
          platform={room.platform}
          title={room.videoTitle}
          isPlaying={isPlaying}
          currentTime={currentTime}
          onPlayPause={handleLocalPlayPause}
          onTimeUpdate={handleTimeUpdate}
          onPlayRequest={handlePlayRequest}
          onSeekRequest={handleSeekRequest}
        />
      </View>

      {/* Controles de Vídeo */}
      <View 
        className="flex-row items-center justify-between px-4 py-3 bg-surface border-b border-border"
        style={{ borderColor: colors.border }}
      >
        <TouchableOpacity
          onPress={handlePlayRequest}
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
            <Ionicons name="sync" size={14} color={colors.success} />
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
