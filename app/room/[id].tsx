import { ScrollView, Text, View, TouchableOpacity, TextInput, FlatList, Pressable } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  isOwn: boolean;
}

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    userId: "user1",
    userName: "João",
    message: "Que filme incrível!",
    timestamp: "14:30",
    isOwn: false,
  },
  {
    id: "2",
    userId: "user2",
    userName: "Maria",
    message: "Concordo! Adorei essa cena",
    timestamp: "14:31",
    isOwn: false,
  },
  {
    id: "3",
    userId: "user3",
    userName: "Você",
    message: "Melhor filme que já vi!",
    timestamp: "14:32",
    isOwn: true,
  },
];

export default function RoomScreen() {
  const router = useRouter();
  const colors = useColors();
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  const [usersOnline, setUsersOnline] = useState(3);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: String(messages.length + 1),
      userId: "current-user",
      userName: "Você",
      message: newMessage,
      timestamp: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isOwn: true,
    };

    setMessages([...messages, message]);
    setNewMessage("");
  };

  const handleLeaveRoom = () => {
    router.back();
  };

  const renderChatMessage = ({ item }: { item: ChatMessage }) => (
    <View
      className={`mb-3 flex-row ${item.isOwn ? "justify-end" : "justify-start"}`}
    >
      {!item.isOwn && (
        <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-2">
          <Text className="text-white text-xs font-bold">
            {item.userName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View
        className={`max-w-xs rounded-lg px-3 py-2 ${
          item.isOwn
            ? "bg-primary"
            : "bg-surface border border-border"
        }`}
        style={
          !item.isOwn
            ? { borderColor: colors.border }
            : {}
        }
      >
        {!item.isOwn && (
          <Text className="text-xs font-semibold text-muted mb-1">
            {item.userName}
          </Text>
        )}
        <Text
          className={`text-sm ${
            item.isOwn ? "text-white" : "text-foreground"
          }`}
        >
          {item.message}
        </Text>
        <Text
          className={`text-xs mt-1 ${
            item.isOwn ? "text-blue-100" : "text-muted"
          }`}
        >
          {item.timestamp}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-3 border-b border-border"
        style={{ borderColor: colors.border }}
      >
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">Sala: Inception</Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="people" size={14} color={colors.success} />
            <Text className="text-xs text-muted ml-1">{usersOnline} pessoas online</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleLeaveRoom}
          className="w-10 h-10 rounded-full bg-error/10 items-center justify-center"
        >
          <Ionicons name="exit" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Video Player Area */}
      <View className="bg-black h-64 items-center justify-center">
        <Ionicons name="play-circle" size={80} color="white" />
        <Text className="text-white text-sm mt-4">Inception</Text>
      </View>

      {/* Player Controls */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-surface border-b border-border">
        <TouchableOpacity
          onPress={() => setIsPlaying(!isPlaying)}
          className="flex-row items-center gap-2"
        >
          <Ionicons
            name={isPlaying ? "pause-circle" : "play-circle"}
            size={24}
            color={colors.primary}
          />
          <Text className="text-sm text-foreground">
            {isPlaying ? "Pausado" : "Reproduzindo"}
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

      {/* Chat Section */}
      <View className="flex-1 flex-row bg-surface">
        {/* Messages */}
        <View className="flex-1 px-4 py-3">
          <FlatList
            data={messages}
            renderItem={renderChatMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            inverted
          />
        </View>
      </View>

      {/* Chat Input */}
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
          disabled={!newMessage.trim()}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
