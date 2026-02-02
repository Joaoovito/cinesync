import { View, Text, ActivityIndicator, Platform, TouchableOpacity } from "react-native";
import { useRef, useEffect, useState, useCallback } from "react";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useKeepAwake } from "expo-keep-awake";

interface VideoPlayerSyncProps {
  videoId: string; // Agora pode ser uma URL direta de vídeo
  platform: string;
  title: string;
  isPlaying?: boolean;
  currentTime?: number;
  onPlayPause?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onSeek?: (time: number) => void;
}

export function VideoPlayerSync({
  videoId,
  platform,
  title,
  isPlaying = false,
  currentTime = 0,
  onPlayPause,
  onTimeUpdate,
}: VideoPlayerSyncProps) {
  const colors = useColors();
  const [localTime, setLocalTime] = useState(currentTime);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const lastSyncTime = useRef(0);
  const initialSeekDone = useRef(false);
  const isSeeking = useRef(false);

  // Manter tela ligada durante reprodução
  useKeepAwake();

  // Determinar a URL do vídeo baseado na plataforma
  const getVideoUrl = useCallback((): string => {
    // Se for uma URL direta (mp4, webm, m3u8, etc.)
    if (videoId.startsWith("http://") || videoId.startsWith("https://")) {
      return videoId;
    }

    // YouTube - não suportado diretamente (precisa de URL direta)
    if (platform === "youtube") {
      // Retornar vídeo de exemplo para demonstração
      // Em produção, seria necessário um serviço de extração de URL
      return "";
    }

    // Google Drive - converter para URL de download direto
    if (platform === "google-drive") {
      return `https://drive.google.com/uc?export=download&id=${videoId}`;
    }

    // URL direta
    if (platform === "direct" || platform === "url") {
      return videoId;
    }

    return videoId;
  }, [videoId, platform]);

  const videoUrl = getVideoUrl();

  // Criar player de vídeo com expo-video
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.muted = false;
    player.volume = 1.0;
    
    // Iniciar no tempo correto se já tiver um tempo salvo
    if (currentTime > 0 && !initialSeekDone.current) {
      player.currentTime = currentTime;
      initialSeekDone.current = true;
    }
  });

  // Controlar play/pause baseado no estado sincronizado
  useEffect(() => {
    if (!player || !videoUrl) return;

    try {
      if (isPlaying && player.playing === false) {
        player.play();
      } else if (!isPlaying && player.playing === true) {
        player.pause();
      }
    } catch (e) {
      console.log("[Player] Erro ao controlar play/pause:", e);
    }
  }, [isPlaying, player, videoUrl]);

  // Sincronizar tempo quando mudar significativamente (mais de 3 segundos de diferença)
  useEffect(() => {
    if (!player || isSeeking.current || !videoUrl) return;

    const diff = Math.abs(currentTime - localTime);
    // Sincronizar se diferença for maior que 3 segundos
    if (diff > 3) {
      console.log("[Player] Sincronizando tempo:", currentTime);
      isSeeking.current = true;
      player.currentTime = currentTime;
      setLocalTime(currentTime);
      setTimeout(() => {
        isSeeking.current = false;
      }, 500);
    }
  }, [currentTime, localTime, player, videoUrl]);

  // Monitorar status do player
  useEffect(() => {
    if (!player) return;

    const statusSubscription = player.addListener("statusChange", (event) => {
      console.log("[Player] Status:", event);
      const status = event.status;
      
      if (status === "readyToPlay") {
        setIsLoading(false);
        setIsBuffering(false);
        setPlayerError(null);
        
        // Obter duração
        if (player.duration > 0) {
          setDuration(player.duration);
        }
      } else if (status === "loading") {
        setIsBuffering(true);
      } else if (status === "error") {
        setPlayerError("Erro ao carregar vídeo");
        setIsLoading(false);
      }
    });

    const playingSubscription = player.addListener("playingChange", (event) => {
      const playing = event.isPlaying;
      if (playing !== isPlaying) {
        onPlayPause?.(playing);
      }
    });

    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
    };
  }, [player, isPlaying, onPlayPause]);

  // Atualizar tempo local e reportar para sincronização
  useEffect(() => {
    if (!player || !videoUrl) return;

    const interval = setInterval(() => {
      if (player.playing && !isSeeking.current) {
        const time = player.currentTime;
        setLocalTime(time);

        // Reportar tempo a cada 2 segundos para sincronização e persistência
        if (Date.now() - lastSyncTime.current > 2000) {
          onTimeUpdate?.(time);
          lastSyncTime.current = Date.now();
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [player, onTimeUpdate, videoUrl]);

  // Formatar tempo
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Calcular progresso
  const progress = duration > 0 ? (localTime / duration) * 100 : 0;

  // Handler para seek na barra de progresso
  const handleSeek = useCallback((percentage: number) => {
    if (!player || duration <= 0) return;
    
    const newTime = (percentage / 100) * duration;
    isSeeking.current = true;
    player.currentTime = newTime;
    setLocalTime(newTime);
    onTimeUpdate?.(newTime);
    
    setTimeout(() => {
      isSeeking.current = false;
    }, 500);
  }, [player, duration, onTimeUpdate]);

  // Se não tiver URL válida (YouTube sem extração)
  if (!videoUrl && platform === "youtube") {
    return (
      <View
        className="w-full bg-surface rounded-xl items-center justify-center border border-border p-6"
        style={{ aspectRatio: "16/9" }}
      >
        <Ionicons name="logo-youtube" size={48} color="#FF0000" />
        <Text className="text-foreground text-center mt-4 font-semibold">
          YouTube não suportado diretamente
        </Text>
        <Text className="text-muted text-sm mt-2 text-center px-4">
          Para sincronização real, use uma URL direta de vídeo (MP4, WebM) ou Google Drive.
        </Text>
        <Text className="text-muted text-xs mt-4 text-center px-4">
          Dica: Faça upload do vídeo no Google Drive e compartilhe o link.
        </Text>
      </View>
    );
  }

  // Se tiver erro
  if (playerError) {
    return (
      <View
        className="w-full bg-surface rounded-xl items-center justify-center border border-error/30 p-6"
        style={{ aspectRatio: "16/9" }}
      >
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text className="text-error text-center mt-4 font-semibold">
          Erro ao carregar vídeo
        </Text>
        <Text className="text-muted text-sm mt-2 text-center px-4">
          {playerError}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setPlayerError(null);
            setIsLoading(true);
            player?.play();
          }}
          className="mt-4 bg-primary px-6 py-2 rounded-full"
        >
          <Text className="text-white font-semibold">Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="w-full rounded-xl overflow-hidden relative shadow-lg" style={{ aspectRatio: "16/9" }}>
      {/* Player de vídeo */}
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        nativeControls={false}
      />

      {/* Loading overlay */}
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center bg-black z-20">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-white mt-3 text-sm">Carregando vídeo...</Text>
        </View>
      )}

      {/* Buffering indicator */}
      {isBuffering && !isLoading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50 z-15">
          <ActivityIndicator size="small" color="white" />
          <Text className="text-white text-xs mt-2">Carregando...</Text>
        </View>
      )}

      {/* Controles customizados */}
      <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-8 pb-3 px-4">
        {/* Título do vídeo */}
        <Text className="text-white text-xs mb-2 opacity-80" numberOfLines={1}>
          {title}
        </Text>

        {/* Barra de progresso clicável */}
        <TouchableOpacity
          onPress={(e) => {
            // @ts-ignore - web only
            if (Platform.OS === "web" && e.nativeEvent) {
              const rect = (e.target as any).getBoundingClientRect?.();
              if (rect) {
                const x = (e.nativeEvent as any).clientX - rect.left;
                const percentage = (x / rect.width) * 100;
                handleSeek(Math.max(0, Math.min(100, percentage)));
              }
            }
          }}
          activeOpacity={0.9}
          className="mb-3"
        >
          <View className="h-2 bg-white/20 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: colors.primary,
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Controles inferiores */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            {/* Botão Play/Pause */}
            <TouchableOpacity
              onPress={() => onPlayPause?.(!isPlaying)}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={22}
                color="white"
              />
            </TouchableOpacity>

            {/* Botões de seek */}
            <TouchableOpacity
              onPress={() => {
                const newTime = Math.max(0, localTime - 10);
                handleSeek((newTime / duration) * 100);
              }}
              className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="play-back" size={16} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const newTime = Math.min(duration, localTime + 10);
                handleSeek((newTime / duration) * 100);
              }}
              className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="play-forward" size={16} color="white" />
            </TouchableOpacity>

            {/* Tempo */}
            <Text className="text-white text-sm font-mono">
              {formatTime(localTime)} {duration > 0 ? `/ ${formatTime(duration)}` : ""}
            </Text>
          </View>

          {/* Status de sincronização */}
          <View className="flex-row items-center gap-2">
            <View className="w-2 h-2 rounded-full bg-success" />
            <Text className="text-white/70 text-xs">Sincronizado</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
