import { ScrollView, Text, View, TouchableOpacity, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

interface Room {
  id: number;
  name: string;
  videoTitle: string;
  platform: string;
  usersOnline?: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, isAuthenticated } = useAuth();
  const { data: rooms, isLoading, refetch } = trpc.rooms.list.useQuery();
  const [roomsWithCounts, setRoomsWithCounts] = useState<Room[]>([]);

  useEffect(() => {
    if (rooms) {
      setRoomsWithCounts(
        rooms.map((room: any) => ({
          ...room,
          usersOnline: Math.floor(Math.random() * 5) + 1,
        }))
      );
    }
  }, [rooms]);

  const handleCreateRoom = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    router.push("/create-room");
  };

  const handleEnterRoom = (roomId: number) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
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
        <View className="flex-row items-center mb-3">
          <Text className="text-3xl mr-3">🎬</Text>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-xs text-muted">{item.platform}</Text>
          </View>
          <View className="bg-primary rounded-full px-2 py-1">
            <Text className="text-xs font-semibold text-white">{item.usersOnline || 0}</Text>
          </View>
        </View>

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
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-3xl font-bold text-foreground">CineSync</Text>
          <Text className="text-sm text-muted">Assista juntos</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings")}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
          style={{ borderColor: colors.border }}
        >
          <Ionicons name="person-circle" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View className="mb-6">
        <View className="flex-row items-center bg-surface rounded-lg px-4 py-3 border border-border">
          <Ionicons name="search" size={18} color={colors.muted} />
          <Text className="text-muted ml-2 flex-1">Buscar salas...</Text>
        </View>
      </View>

      <View className="flex-1">
        <Text className="text-lg font-semibold text-foreground mb-3">Salas Ativas</Text>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={roomsWithCounts}
            renderItem={renderRoomCard}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={{ flexGrow: 1 }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center">
                <Ionicons name="film" size={48} color={colors.muted} />
                <Text className="text-muted text-center mt-4">Nenhuma sala disponível</Text>
                <Text className="text-muted text-center text-sm mt-2">
                  Crie a primeira sala para começar!
                </Text>
              </View>
            }
          />
        )}
      </View>

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
