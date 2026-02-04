import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from "react-native";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type Platform = "youtube" | "direct" | "google-drive";

const PLATFORMS: { label: string; value: Platform; icon: string; description: string }[] = [
  { 
    label: "YouTube", 
    value: "youtube", 
    icon: "logo-youtube",
    description: "Vídeos do YouTube (links youtube.com ou youtu.be)"
  },
  { 
    label: "URL Direta", 
    value: "direct", 
    icon: "link",
    description: "MP4, WebM, M3U8 ou qualquer URL de vídeo"
  },
  { 
    label: "Google Drive", 
    value: "google-drive", 
    icon: "logo-google",
    description: "Vídeos compartilhados do Google Drive"
  },
];

// Detectar automaticamente a plataforma baseada na URL
function detectPlatform(url: string): Platform | null {
  if (!url) return null;
  
  // YouTube
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  }
  
  // Google Drive
  if (url.includes("drive.google.com")) {
    return "google-drive";
  }
  
  // URL direta (se tem extensão de vídeo ou é uma URL válida)
  if (url.match(/\.(mp4|webm|mov|m3u8|mkv|avi)(\?|$)/i) || url.startsWith("http")) {
    return "direct";
  }
  
  return null;
}

// Extrair ID do YouTube de várias formas de URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
    /(?:youtube\.com\/v\/)([^?\s]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

export default function CreateRoomScreen() {
  const router = useRouter();
  const colors = useColors();
  const [roomName, setRoomName] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");

  const createRoomMutation = trpc.rooms.create.useMutation({
    onSuccess: (room) => {
      console.log("[CreateRoom] Room created:", room);
      Alert.alert("Sucesso", "Sala criada com sucesso!");
      trpc.useUtils().rooms.list.invalidate();
      router.replace("/(tabs)");
    },
    onError: (error) => {
      Alert.alert("Erro", error.message || "Falha ao criar a sala");
    },
  });

  // Auto-detectar plataforma quando URL muda
  useEffect(() => {
    const detected = detectPlatform(videoUrl);
    if (detected && detected !== selectedPlatform) {
      setSelectedPlatform(detected);
    }
  }, [videoUrl]);

  // Extrair ID do Google Drive da URL
  const extractGoogleDriveId = (url: string): string => {
    // Formatos suportados:
    // https://drive.google.com/file/d/FILE_ID/view
    // https://drive.google.com/open?id=FILE_ID
    // https://drive.google.com/uc?id=FILE_ID
    const patterns = [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return url; // Retornar como está se não encontrar padrão
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert("Erro", "Digite um nome para a sala");
      return;
    }

    if (!videoUrl.trim()) {
      Alert.alert("Erro", "Digite a URL do vídeo");
      return;
    }

    if (!videoTitle.trim()) {
      Alert.alert("Erro", "Digite o título do vídeo");
      return;
    }

    // Processar URL baseado na plataforma
    let processedVideoId = videoUrl.trim();
    
    if (selectedPlatform === "youtube") {
      const youtubeId = extractYouTubeId(videoUrl);
      if (!youtubeId) {
        Alert.alert("Erro", "URL do YouTube inválida. Use um link como youtube.com/watch?v=... ou youtu.be/...");
        return;
      }
      processedVideoId = youtubeId;
    } else if (selectedPlatform === "google-drive") {
      processedVideoId = extractGoogleDriveId(videoUrl);
    }

    createRoomMutation.mutate({
      name: roomName,
      videoTitle: videoTitle,
      platform: selectedPlatform,
      videoUrl: videoUrl,
      videoId: processedVideoId,
    });
  };

  const handleCancel = () => {
    router.back();
  };

  const getPlaceholder = () => {
    switch (selectedPlatform) {
      case "youtube":
        return "https://www.youtube.com/watch?v=...";
      case "google-drive":
        return "https://drive.google.com/file/d/...";
      default:
        return "https://exemplo.com/video.mp4";
    }
  };

  const getHelpText = () => {
    switch (selectedPlatform) {
      case "youtube":
        return "Cole o link do vídeo do YouTube (youtube.com/watch?v=... ou youtu.be/...)";
      case "google-drive":
        return "Cole o link de compartilhamento do Google Drive";
      default:
        return "Cole a URL direta do vídeo (MP4, WebM, M3U8)";
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-foreground">Criar Sala</Text>
          <TouchableOpacity onPress={handleCancel}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View className="gap-6">
          {/* Nome da Sala */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Nome da Sala</Text>
            <TextInput
              placeholder="Ex: Sessão de Filme"
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

          {/* Título do Vídeo */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Título do Vídeo</Text>
            <TextInput
              placeholder="Ex: Inception (2010)"
              placeholderTextColor={colors.muted}
              value={videoTitle}
              onChangeText={setVideoTitle}
              className="bg-surface rounded-lg px-4 py-3 border border-border text-foreground"
              style={{
                borderColor: colors.border,
                color: colors.foreground,
              }}
            />
          </View>

          {/* Seleção de Plataforma */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">Fonte do Vídeo</Text>
            <View className="gap-2">
              {PLATFORMS.map((platform) => (
                <TouchableOpacity
                  key={platform.value}
                  onPress={() => setSelectedPlatform(platform.value)}
                  className={`flex-row items-center p-4 rounded-lg border ${
                    selectedPlatform === platform.value
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  }`}
                  style={{
                    borderColor:
                      selectedPlatform === platform.value ? colors.primary : colors.border,
                  }}
                  activeOpacity={0.7}
                >
                  <View 
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ 
                      backgroundColor: selectedPlatform === platform.value 
                        ? platform.value === "youtube" ? "#FF0000" : colors.primary 
                        : colors.surface 
                    }}
                  >
                    <Ionicons
                      name={platform.icon as any}
                      size={20}
                      color={selectedPlatform === platform.value ? "white" : colors.muted}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-semibold ${
                        selectedPlatform === platform.value
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {platform.label}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      {platform.description}
                    </Text>
                  </View>
                  {selectedPlatform === platform.value && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* URL do Vídeo */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              {selectedPlatform === "youtube"
                ? "Link do YouTube"
                : selectedPlatform === "google-drive"
                ? "Link do Google Drive"
                : "URL do Vídeo"}
            </Text>
            <TextInput
              placeholder={getPlaceholder()}
              placeholderTextColor={colors.muted}
              value={videoUrl}
              onChangeText={setVideoUrl}
              className="bg-surface rounded-lg px-4 py-3 border border-border text-foreground"
              style={{
                borderColor: colors.border,
                color: colors.foreground,
              }}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text className="text-xs text-muted mt-2">
              {getHelpText()}
            </Text>
          </View>

          {/* Informação sobre sincronização */}
          <View className="bg-primary/5 rounded-lg p-4 border border-primary/20">
            <View className="flex-row items-start">
              <Ionicons name="sync" size={20} color={colors.primary} />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  Sincronização em Tempo Real
                </Text>
                <Text className="text-xs text-muted mt-1">
                  Todos os participantes assistirão ao vídeo sincronizados. 
                  Quando alguém pausar ou avançar, todos verão a mesma cena.
                </Text>
              </View>
            </View>
          </View>

          {/* Dica sobre formatos suportados */}
          <View className="bg-surface rounded-lg p-4 border border-border">
            <View className="flex-row items-start">
              <Ionicons name="bulb" size={20} color={colors.warning} />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  Dica: Formatos Suportados
                </Text>
                <Text className="text-xs text-muted mt-1">
                  • YouTube - Vídeos públicos e não listados{"\n"}
                  • MP4, WebM, MOV - Vídeos comuns{"\n"}
                  • M3U8, HLS - Streaming adaptativo{"\n"}
                  • Google Drive - Vídeos compartilhados
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Botões de ação */}
        <View className="gap-3 mt-8">
          <TouchableOpacity
            onPress={handleCreateRoom}
            disabled={createRoomMutation.isPending}
            className="bg-primary rounded-full py-4 items-center justify-center flex-row gap-2"
            activeOpacity={0.8}
          >
            {createRoomMutation.isPending ? (
              <>
                <Ionicons name="hourglass" size={20} color="white" />
                <Text className="text-white font-semibold">Criando...</Text>
              </>
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="white" />
                <Text className="text-white font-semibold">Criar Sala</Text>
              </>
            )}
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
