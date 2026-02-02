import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useRef, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

interface ChatMessage {
  id: number;
  userId: number;
  message: string;
  createdAt: Date;
  isOwn: boolean;
  userName?: string;
}

interface ChatRoomProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isSending?: boolean;
  currentUserId?: number;
}

export function ChatRoom({ messages, onSendMessage, isSending = false, currentUserId }: ChatRoomProps) {
  const colors = useColors();
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll para a mensagem mais recente
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToIndex({ index: 0, animated: true });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    onSendMessage(newMessage);
    setNewMessage("");
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderChatMessage = ({ item }: { item: ChatMessage }) => (
    <View className={`mb-3 flex-row ${item.isOwn ? "justify-end" : "justify-start"} px-4`}>
      {!item.isOwn && (
        <View className="w-8 h-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: colors.primary }}>
          <Text className="text-white text-xs font-bold">
            {item.userName?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
      )}

      <View
        className={`max-w-xs rounded-lg px-3 py-2 ${
          item.isOwn ? "rounded-br-none" : "rounded-bl-none"
        }`}
        style={{
          backgroundColor: item.isOwn ? colors.primary : colors.surface,
          borderWidth: item.isOwn ? 0 : 1,
          borderColor: item.isOwn ? "transparent" : colors.border,
        }}
      >
        {!item.isOwn && (
          <Text className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
            {item.userName || "Usuário"}
          </Text>
        )}
        <Text
          className="text-sm"
          style={{
            color: item.isOwn ? "white" : colors.foreground,
          }}
        >
          {item.message}
        </Text>
        <Text
          className="text-xs mt-1"
          style={{
            color: item.isOwn ? "rgba(255,255,255,0.7)" : colors.muted,
          }}
        >
          {formatTime(item.createdAt)}
        </Text>
      </View>
    </View>
  );

  const renderEmptyChat = () => (
    <View className="flex-1 items-center justify-center">
      <Ionicons name="chatbubbles-outline" size={48} color={colors.muted} />
      <Text className="text-muted mt-3">Nenhuma mensagem ainda</Text>
      <Text className="text-muted text-xs mt-1">Comece a conversa!</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View className="flex-1 flex-row" style={{ backgroundColor: colors.surface }}>
        <View className="flex-1">
          {messages.length === 0 ? (
            renderEmptyChat()
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderChatMessage}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingVertical: 8 }}
              inverted
              scrollEventThrottle={16}
              onScrollToIndexFailed={() => {}}
            />
          )}
        </View>
      </View>

      <View
        className="flex-row items-center gap-2 px-4 py-3 border-t"
        style={{
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <TextInput
          placeholder="Digite uma mensagem..."
          placeholderTextColor={colors.muted}
          value={newMessage}
          onChangeText={setNewMessage}
          editable={!isSending}
          multiline
          maxLength={500}
          className="flex-1 rounded-full px-4 py-2 text-sm"
          style={{
            backgroundColor: colors.background,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: 100,
          }}
        />
        <TouchableOpacity
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || isSending}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{
            backgroundColor: newMessage.trim() && !isSending ? colors.primary : colors.border,
            opacity: newMessage.trim() && !isSending ? 1 : 0.5,
          }}
          activeOpacity={0.8}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={18} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
