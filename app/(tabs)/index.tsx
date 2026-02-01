import { ScrollView, Text, View, TouchableOpacity, FlatList, Pressable } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

// Mock data for rooms
const MOCK_ROOMS = [
  {
    id: "1",
    name: "Filme Clássico",
    videoTitle: "Inception",
    platform: "YouTube",
    usersOnline: 3,
    thumbnail: "🎬",
  },
  {
    id: "2",
    name: "Série Noturna",
    videoTitle: "Breaking Bad - S01E01",
    platform: "Google Drive",
    usersOnline: 5,
    thumbnail: "📺",
  },
  {
    id: "3",
    name: "Documentário",
    videoTitle: "Planet Earth",
    platform: "Netflix",
    usersOnline: 2,
    thumbnail: "🌍",
  },
];

interface Room {
  id: string;
  name: string;
  videoTitle: string;
  platform: string;
  usersOnline: number;
  thumbnail: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);

  const handleCreateRoom = () => {
    router.push("/create-room");
  };

  const handleEnterRoom = (roomId: string) => {
    router.push({
      pathname: "/room/[id]",
      params: { id: roomId },
    });
  };

  const renderRoomCard = ({ item }: { item: Room }) => (
    <Pressable
      onPress={() => handleEnterRoom(item.id)}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        className="bg-surface rounded-2xl p-4 mb-3 border border-border"
        style={{ borderColor: colors.border }}
      >
        {/* Room Header */}
        <View className="flex-row items-center mb-3">
          <Text className="text-3xl mr-3">{item.thumbnail}</Text>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-xs text-muted">{item.platform}</Text>
          </View>
          <View className="bg-primary rounded-full px-2 py-1">
            <Text className="text-xs font-semibold text-white">{item.usersOnline}</Text>
          </View>
        </View>

        {/* Video Info */}
        <View className="bg-background rounded-lg p-3">
          <Text className="text-sm text-muted">Assistindo agora:</Text>
          <Text className="text-sm font-semibold text-foreground mt-1" numberOfLines={2}>
            {item.videoTitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-3xl font-bold text-foreground">CineSync</Text>
          <Text className="text-sm text-muted">Assista juntos</Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
          style={{ borderColor: colors.border }}
        >
          <Ionicons name="person-circle" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar (placeholder) */}
      <View className="mb-6">
        <View className="flex-row items-center bg-surface rounded-lg px-4 py-3 border border-border">
          <Ionicons name="search" size={18} color={colors.muted} />
          <Text className="text-muted ml-2 flex-1">Buscar salas...</Text>
        </View>
      </View>

      {/* Rooms List */}
      <View className="flex-1">
        <Text className="text-lg font-semibold text-foreground mb-3">Salas Ativas</Text>
        <FlatList
          data={rooms}
          renderItem={renderRoomCard}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted text-center">Nenhuma sala disponível</Text>
            </View>
          }
        />
      </View>

      {/* Create Room Button */}
      <TouchableOpacity
        onPress={handleCreateRoom}
        className="bg-primary rounded-full py-4 items-center justify-center mt-4"
        activeOpacity={0.8}
      >
        <View className="flex-row items-center">
          <Ionicons name="add-circle" size={24} color="white" />
          <Text className="text-white font-semibold ml-2">Criar Sala</Text>
        </View>
      </TouchableOpacity>
    </ScreenContainer>
  );
}
