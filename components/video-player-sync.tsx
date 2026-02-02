import { View, Text, ActivityIndicator, Platform, TouchableOpacity } from "react-native";
import { useRef, useEffect, useState, useCallback } from "react";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";

interface VideoPlayerSyncProps {
  videoId: string;
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
  const [playerError, setPlayerError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSyncTime = useRef(0);
  const isSeeking = useRef(false);
  const initialSeekDone = useRef(false);

  useKeepAwake();

  // Determinar a URL do vídeo baseado na plataforma
  const getVideoUrl = useCallback((): string => {
    if (videoId.startsWith("http://") || videoId.startsWith("https://")) {
      return videoId;
    }

    if (platform === "youtube") {
      return "";
    }

    if (platform === "google-drive") {
      // URL de streaming do Google Drive
      return `https://drive.google.com/uc?export=download&id=${videoId}`;
    }

    if (platform === "direct" || platform === "url") {
      return videoId;
    }

    return videoId;
  }, [videoId, platform]);

  const videoUrl = getVideoUrl();

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

  // Handler para seek
  const handleSeek = useCallback((percentage: number) => {
    if (!videoRef.current || duration <= 0) return;
    
    const newTime = (percentage / 100) * duration;
    isSeeking.current = true;
    videoRef.current.currentTime = newTime;
    setLocalTime(newTime);
    onTimeUpdate?.(newTime);
    
    setTimeout(() => {
      isSeeking.current = false;
    }, 500);
  }, [duration, onTimeUpdate]);

  // Controlar play/pause
  useEffect(() => {
    if (!videoRef.current || Platform.OS !== "web") return;

    try {
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    } catch (e) {
      console.log("[Player] Erro ao controlar play/pause:", e);
    }
  }, [isPlaying]);

  // Sincronizar tempo quando mudar significativamente
  useEffect(() => {
    if (!videoRef.current || isSeeking.current || Platform.OS !== "web") return;

    const diff = Math.abs(currentTime - localTime);
    if (diff > 3) {
      console.log("[Player] Sincronizando tempo:", currentTime);
      isSeeking.current = true;
      videoRef.current.currentTime = currentTime;
      setLocalTime(currentTime);
      setTimeout(() => {
        isSeeking.current = false;
      }, 500);
    }
  }, [currentTime, localTime]);

  // Atualizar tempo local periodicamente
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && !isSeeking.current) {
        const time = videoRef.current.currentTime;
        setLocalTime(time);

        if (Date.now() - lastSyncTime.current > 2000) {
          onTimeUpdate?.(time);
          lastSyncTime.current = Date.now();
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [onTimeUpdate]);

  // Se não tiver URL válida (YouTube)
  if (!videoUrl && platform === "youtube") {
    return (
      <View
        className="w-full bg-surface rounded-xl items-center justify-center border border-border p-6"
        style={{ aspectRatio: 16/9 }}
      >
        <Ionicons name="logo-youtube" size={48} color="#FF0000" />
        <Text className="text-foreground text-center mt-4 font-semibold">
          YouTube não suportado diretamente
        </Text>
        <Text className="text-muted text-sm mt-2 text-center px-4">
          Para sincronização real, use uma URL direta de vídeo (MP4, WebM) ou Google Drive.
        </Text>
      </View>
    );
  }

  // Se tiver erro
  if (playerError) {
    return (
      <View
        className="w-full bg-surface rounded-xl items-center justify-center border border-border p-6"
        style={{ aspectRatio: 16/9 }}
      >
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text className="text-foreground text-center mt-4 font-semibold">
          Erro ao carregar vídeo
        </Text>
        <Text className="text-muted text-sm mt-2 text-center px-4">
          {playerError}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setPlayerError(null);
            setIsLoading(true);
            if (videoRef.current) {
              videoRef.current.load();
            }
          }}
          className="mt-4 bg-primary px-6 py-2 rounded-full"
        >
          <Text className="text-white font-semibold">Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Player para Web usando HTML5 Video
  if (Platform.OS === "web") {
    return (
      <View className="w-full rounded-xl overflow-hidden relative shadow-lg" style={{ aspectRatio: 16/9 }}>
        {/* Player HTML5 */}
        <video
          ref={(el) => { videoRef.current = el; }}
          src={videoUrl}
          style={{ 
            width: "100%", 
            height: "100%", 
            backgroundColor: "#000",
            objectFit: "contain"
          }}
          playsInline
          onLoadedMetadata={(e) => {
            const video = e.target as HTMLVideoElement;
            setDuration(video.duration);
            setIsLoading(false);
            
            // Seek para o tempo inicial
            if (currentTime > 0 && !initialSeekDone.current) {
              video.currentTime = currentTime;
              initialSeekDone.current = true;
            }
          }}
          onError={() => {
            setPlayerError("Não foi possível carregar o vídeo. Verifique se a URL é válida.");
            setIsLoading(false);
          }}
          onPlay={() => {
            if (!isPlaying) onPlayPause?.(true);
          }}
          onPause={() => {
            if (isPlaying) onPlayPause?.(false);
          }}
          onTimeUpdate={(e) => {
            const video = e.target as HTMLVideoElement;
            if (!isSeeking.current) {
              setLocalTime(video.currentTime);
            }
          }}
          onWaiting={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
        />

        {/* Loading overlay */}
        {isLoading && (
          <View className="absolute inset-0 items-center justify-center bg-black/80" style={{ zIndex: 20 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-white mt-3 text-sm">Carregando vídeo...</Text>
          </View>
        )}

        {/* Controles customizados */}
        <View 
          className="absolute bottom-0 left-0 right-0 pt-8 pb-3 px-4 bg-black/80"
          style={{ zIndex: 10 }}
        >
          {/* Título */}
          <Text className="text-white text-xs mb-2 opacity-80" numberOfLines={1}>
            {title}
          </Text>

          {/* Barra de progresso */}
          <TouchableOpacity
            onPress={(e: any) => {
              const rect = e.target.getBoundingClientRect?.();
              if (rect) {
                const x = e.nativeEvent.clientX - rect.left;
                const percentage = (x / rect.width) * 100;
                handleSeek(Math.max(0, Math.min(100, percentage)));
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

          {/* Controles */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4">
              {/* Play/Pause */}
              <TouchableOpacity
                onPress={() => onPlayPause?.(!isPlaying)}
                className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="white" />
              </TouchableOpacity>

              {/* Seek -10s */}
              <TouchableOpacity
                onPress={() => {
                  const newTime = Math.max(0, localTime - 10);
                  if (videoRef.current) {
                    videoRef.current.currentTime = newTime;
                    setLocalTime(newTime);
                    onTimeUpdate?.(newTime);
                  }
                }}
                className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name="play-back" size={16} color="white" />
              </TouchableOpacity>

              {/* Seek +10s */}
              <TouchableOpacity
                onPress={() => {
                  const newTime = Math.min(duration, localTime + 10);
                  if (videoRef.current) {
                    videoRef.current.currentTime = newTime;
                    setLocalTime(newTime);
                    onTimeUpdate?.(newTime);
                  }
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

            {/* Status */}
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-green-500" />
              <Text className="text-white/70 text-xs">Sincronizado</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Player para Mobile (placeholder - expo-video tem limitações)
  return (
    <View
      className="w-full bg-surface rounded-xl items-center justify-center border border-border p-6"
      style={{ aspectRatio: 16/9 }}
    >
      <Ionicons name="phone-portrait" size={48} color={colors.primary} />
      <Text className="text-foreground text-center mt-4 font-semibold">
        Player Mobile
      </Text>
      <Text className="text-muted text-sm mt-2 text-center px-4">
        Para melhor experiência, use o app no navegador web.
      </Text>
    </View>
  );
}
