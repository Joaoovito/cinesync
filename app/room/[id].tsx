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
  const { data: videoState, refetch: refetchVideoState } = trpc.rooms.getVideoState.useQuery({ roomId }, { refetchInterval: 1500 });

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  
  // Refs para evitar loops
  const lastSavedTime = useRef(0);
  const previousParticipantCount = useRef<number | undefined>(undefined);
  const isInitialized = useRef(false);

  // Mutations
  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      refetchMessages();
    },
  });

  const updateVideoStateMutation = trpc.rooms.updateVideoState.useMutation();

  // Inicializar estado do vídeo quando carregar da sala
  useEffect(() => {
    if (videoState && !isInitialized.current) {
      console.log("[Room] Inicializando com estado salvo:", videoState);
      setIsPlaying(videoState.isPlaying ?? false);
      setCurrentTime(videoState.currentTime ?? 0);
      lastSavedTime.current = videoState.currentTime ?? 0;
      isInitialized.current = true;
    }
  }, [videoState]);

  // Sincronizar estado do vídeo quando mudar no servidor (outros usuários)
  useEffect(() => {
    if (videoState && isInitialized.current) {
      // Sincronizar play/pause
      if (videoState.isPlaying !== null && videoState.isPlaying !== isPlaying) {
        setIsPlaying(videoState.isPlaying);
      }
      
      // Sincronizar tempo se diferença for maior que 3 segundos
      if (videoState.currentTime !== null) {
        const diff = Math.abs(videoState.currentTime - currentTime);
        if (diff > 3) {
          console.log("[Room] Sincronizando tempo:", videoState.currentTime);
          setCurrentTime(videoState.currentTime);
        }
      }
    }
  }, [videoState?.isPlaying, videoState?.currentTime]);

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

  // Handler para play/pause
  const handlePlayPause = useCallback((playing: boolean) => {
    console.log("[Room] Play/Pause:", playing);
    setIsPlaying(playing);
    
    // Salvar no banco de dados para sincronizar com outros usuários
    updateVideoStateMutation.mutate({
      roomId,
      isPlaying: playing,
      currentTime: Math.floor(currentTime),
    });
  }, [roomId, currentTime, updateVideoStateMutation]);

  // Handler para atualização de tempo
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
    
    // Salvar no banco de dados a cada 3 segundos para persistência
    const timeDiff = Math.abs(time - lastSavedTime.current);
    if (timeDiff >= 3) {
      console.log("[Room] Salvando tempo:", Math.floor(time));
      lastSavedTime.current = time;
      updateVideoStateMutation.mutate({
        roomId,
        currentTime: Math.floor(time),
      });
    }
  }, [roomId, updateVideoStateMutation]);

  // Handler para enviar mensagem
  const handleSendMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    sendMessageMutation.mutate({
      roomId,
      message: message.trim(),
    });
  }, [roomId, sendMessageMutation]);

  // Estado para nova mensagem
  const [newMessage, setNewMessage] = useState("");

  const onSendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    handleSendMessage(newMessage);
    setNewMessage("");
  }, [newMessage, handleSendMessage]);

  // Handler para sair da sala
  const handleLeaveRoom = useCallback(() => {
    // Salvar tempo atual antes de sair
    updateVideoStateMutation.mutate({
      roomId,
      currentTime: Math.floor(currentTime),
      isPlaying: false,
    });
    router.back();
  }, [roomId, currentTime, updateVideoStateMutation, router]);

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
          <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
            {room.name}
          </Text>
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
          onPlayPause={handlePlayPause}
          onTimeUpdate={handleTimeUpdate}
        />
      </View>

      {/* Controles de Vídeo */}
      <View 
        className="flex-row items-center justify-between px-4 py-3 bg-surface border-b border-border"
        style={{ borderColor: colors.border }}
      >
        <TouchableOpacity
          onPress={() => handlePlayPause(!isPlaying)}
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
            <Text className="text-xs text-muted">Sincronizado</Text>
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
