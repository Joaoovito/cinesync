import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

type Platform = "youtube" | "google-drive" | "netflix" | "prime";

const PLATFORMS: { label: string; value: Platform }[] = [
  { label: "YouTube", value: "youtube" },
  { label: "Google Drive", value: "google-drive" },
  { label: "Netflix", value: "netflix" },
  { label: "Prime Video", value: "prime" },
];

export default function CreateRoomScreen() {
  const router = useRouter();
  const colors = useColors();
  const [roomName, setRoomName] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert("Erro", "Digite um nome para a sala");
      return;
    }

    if (!videoUrl.trim()) {
      Alert.alert("Erro", "Digite a URL ou ID do vídeo");
      return;
    }

    setLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Navigate to room
      router.push({
        pathname: "/room/[id]",
        params: { id: "new-room-1" },
      });
    } catch (error) {
      Alert.alert("Erro", "Falha ao criar a sala. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-foreground">Criar Sala</Text>
          <TouchableOpacity onPress={handleCancel}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View className="gap-6">
          {/* Room Name */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Nome da Sala</Text>
            <TextInput
              placeholder="Ex: Filme Clássico"
              placeholderTextColor={colors.muted}
              value={roomName}
              onChangeText={setRoomName}
              className="bg-surface rounded-lg px-4 py-3 border border-border text-foreground"
              style={{
                borderColor: colors.border,
                color: colors.foreground,
              }}
            />
          </View>

          {/* Platform Selection */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Plataforma</Text>
            <View className="gap-2">
              {PLATFORMS.map((platform) => (
                <TouchableOpacity
                  key={platform.value}
                  onPress={() => setSelectedPlatform(platform.value)}
                  className={`flex-row items-center p-3 rounded-lg border ${
                    selectedPlatform === platform.value
                      ? "bg-primary border-primary"
                      : "bg-surface border-border"
                  }`}
                  style={{
                    borderColor:
                      selectedPlatform === platform.value ? colors.primary : colors.border,
                    backgroundColor:
                      selectedPlatform === platform.value ? colors.primary : colors.surface,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={
                      selectedPlatform === platform.value ? "white" : colors.muted
                    }
                  />
                  <Text
                    className={`ml-3 font-medium ${
                      selectedPlatform === platform.value
                        ? "text-white"
                        : "text-foreground"
                    }`}
                  >
                    {platform.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Video URL/ID */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              {selectedPlatform === "youtube"
                ? "ID do Vídeo YouTube"
                : selectedPlatform === "google-drive"
                  ? "Link do Google Drive"
                  : "URL do Vídeo"}
            </Text>
            <TextInput
              placeholder={
                selectedPlatform === "youtube"
                  ? "Ex: dQw4w9WgXcQ"
                  : "Ex: https://..."
              }
              placeholderTextColor={colors.muted}
              value={videoUrl}
              onChangeText={setVideoUrl}
              className="bg-surface rounded-lg px-4 py-3 border border-border text-foreground"
              style={{
                borderColor: colors.border,
                color: colors.foreground,
              }}
              multiline
            />
            <Text className="text-xs text-muted mt-2">
              {selectedPlatform === "youtube"
                ? "Você pode encontrar o ID na URL: youtube.com/watch?v=ID"
                : "Cole o link completo do vídeo"}
            </Text>
          </View>

          {/* Info Box */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <View className="flex-row">
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text className="text-xs text-muted ml-2 flex-1">
                O vídeo será exibido em tempo real para todos os participantes da sala.
              </Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View className="gap-3 mt-8">
          <TouchableOpacity
            onPress={handleCreateRoom}
            disabled={loading}
            className="bg-primary rounded-full py-4 items-center justify-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold">
              {loading ? "Criando..." : "Criar Sala"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCancel}
            className="bg-surface rounded-full py-4 items-center justify-center border border-border"
            style={{ borderColor: colors.border }}
            activeOpacity={0.8}
          >
            <Text className="text-foreground font-semibold">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
