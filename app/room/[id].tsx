import { ScrollView, Text, View, TouchableOpacity, TextInput, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { VideoPlayer } from "@/components/video-player";

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
  const { data: videoState } = trpc.rooms.getVideoState.useQuery({ roomId });

  const [newMessage, setNewMessage] = useState("");
  const [isPlaying, setIsPlaying] = useState(videoState?.isPlaying || false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
    },
  });

  const updateVideoStateMutation = trpc.rooms.updateVideoState.useMutation();

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
    if (videoState && videoState.isPlaying !== null) {
      setIsPlaying(videoState.isPlaying);
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

  const handleLeaveRoom = () => {
    router.back();
  };

  const renderChatMessage = ({ item }: { item: ChatMessage }) => (
    <View className={`mb-3 flex-row ${item.isOwn ? "justify-end" : "justify-start"}`}>
      {!item.isOwn && (
        <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-2">
          <Text className="text-white text-xs font-bold">
            {item.userName?.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View
        className={`max-w-xs rounded-lg px-3 py-2 ${
          item.isOwn ? "bg-primary" : "bg-surface border border-border"
        }`}
        style={!item.isOwn ? { borderColor: colors.border } : {}}
      >
        {!item.isOwn && (
          <Text className="text-xs font-semibold text-muted mb-1">{item.userName}</Text>
        )}
        <Text className={`text-sm ${item.isOwn ? "text-white" : "text-foreground"}`}>
          {item.message}
        </Text>
        <Text className={`text-xs mt-1 ${item.isOwn ? "text-blue-100" : "text-muted"}`}>
          {new Date(item.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );

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
        <VideoPlayer
          videoId={room.videoId}
          platform={room.platform}
          title={room.videoTitle}
          isPlaying={isPlaying}
          currentTime={room.currentTime}
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

      <View className="flex-1 flex-row bg-surface">
        <View className="flex-1 px-4 py-3">
          <FlatList
            data={chatMessages}
            renderItem={renderChatMessage}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingVertical: 8 }}
            inverted
          />
        </View>
      </View>

      <View
        className="flex-row items-center gap-2 px-4 py-3 border-t border-border bg-surface"
        style={{ borderColor: colors.border }}
      >
        <TextInput
          placeholder="Digite uma mensagem..."
          placeholderTextColor={colors.muted}
          value={newMessage}
          onChangeText={setNewMessage}
          className="flex-1 bg-background rounded-full px-4 py-2 text-foreground border border-border"
          style={{
            borderColor: colors.border,
            color: colors.foreground,
          }}
        />
        <TouchableOpacity
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sendMessageMutation.isPending}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
