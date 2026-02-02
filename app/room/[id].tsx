import { ScrollView, Text, View, TouchableOpacity, TextInput, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { VideoPlayerSync } from "@/components/video-player-sync";
import { ChatRoom } from "@/components/chat-room";

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

  const { data: room, isLoading: roomLoading } = trpc.rooms.get.useQuery({ id: roomId });
  const { data: messages, refetch: refetchMessages } = trpc.chat.messages.useQuery({
    roomId,
    limit: 50,
  });
  const { data: participantCount } = trpc.participants.count.useQuery({ roomId });
  const { data: videoState, refetch: refetchVideoState } = trpc.rooms.getVideoState.useQuery({ roomId });

  const [newMessage, setNewMessage] = useState("");
  const [isPlaying, setIsPlaying] = useState(videoState?.isPlaying || false);
  const [currentTime, setCurrentTime] = useState(videoState?.currentTime || 0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lastTimeUpdate, setLastTimeUpdate] = useState(0);

  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
    },
  });

  const updateVideoStateMutation = trpc.rooms.updateVideoState.useMutation();

  // Polling para sincronização de vídeo em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      refetchVideoState();
      refetchMessages();
    }, 1000);
    return () => clearInterval(interval);
  }, [refetchVideoState, refetchMessages]);

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

  useEffect(() => {
    if (videoState) {
      if (videoState.isPlaying !== null) {
        setIsPlaying(videoState.isPlaying);
      }
      if (videoState.currentTime !== null) {
        setCurrentTime(videoState.currentTime);
      }
    }
  }, [videoState]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    sendMessageMutation.mutate({
      roomId,
      message: newMessage,
    });
  };

  const handleTogglePlay = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    updateVideoStateMutation.mutate({
      roomId,
      isPlaying: newState,
    });
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    setLastTimeUpdate(Date.now());
    if (Date.now() - lastTimeUpdate > 5000) {
      updateVideoStateMutation.mutate({
        roomId,
        currentTime: Math.floor(time),
      });
    }
  };

  const handleLeaveRoom = () => {
    router.back();
  };



  if (roomLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!room) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">Sala não encontrada</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0 flex-1">
      <View
        className="flex-row items-center justify-between px-4 py-3 border-b border-border"
        style={{ borderColor: colors.border }}
      >
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{room.name}</Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="people" size={14} color={colors.success} />
            <Text className="text-xs text-muted ml-1">
              {participantCount || 0} pessoas online
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleLeaveRoom}
          className="w-10 h-10 rounded-full bg-error/10 items-center justify-center"
        >
          <Ionicons name="exit" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <View className="px-4 py-3">
        <VideoPlayerSync
          videoId={room.videoId}
          platform={room.platform}
          title={room.videoTitle}
          isPlaying={isPlaying}
          currentTime={currentTime}
          onTimeUpdate={handleTimeUpdate}
        />
      </View>

      <View className="flex-row items-center justify-between px-4 py-3 bg-surface border-b border-border">
        <TouchableOpacity
          onPress={handleTogglePlay}
          className="flex-row items-center gap-2"
        >
          <Ionicons
            name={isPlaying ? "pause-circle" : "play-circle"}
            size={24}
            color={colors.primary}
          />
          <Text className="text-sm text-foreground">
            {isPlaying ? "Reproduzindo" : "Pausado"}
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-3">
          <TouchableOpacity>
            <Ionicons name="volume-high" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="expand" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <ChatRoom
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isSending={sendMessageMutation.isPending}
        currentUserId={user?.id}
      />
    </ScreenContainer>
  );
}
