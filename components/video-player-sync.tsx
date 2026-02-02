import { View, Text, ActivityIndicator, Platform, TouchableOpacity } from "react-native";
import { useRef, useEffect, useState, useCallback } from "react";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";

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
  onSeek,
}: VideoPlayerSyncProps) {
  const colors = useColors();
  const [localTime, setLocalTime] = useState(currentTime);
  const [isLoading, setIsLoading] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSyncTime = useRef(0);

  const getYouTubeId = (input: string): string => {
    if (input.length === 11 && !input.includes("/")) {
      return input;
    }
    const match = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\\n?#]+)/);
    return match ? match[1] : input;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Enviar comando para o player YouTube via postMessage
  const sendCommand = useCallback((command: string, args?: any) => {
    if (iframeRef.current && playerReady) {
      const message = JSON.stringify({
        event: "command",
        func: command,
        args: args || [],
      });
      iframeRef.current.contentWindow?.postMessage(message, "*");
    }
  }, [playerReady]);

  // Controlar play/pause
  useEffect(() => {
    if (playerReady) {
      if (isPlaying) {
        sendCommand("playVideo");
      } else {
        sendCommand("pauseVideo");
      }
    }
  }, [isPlaying, playerReady, sendCommand]);

  // Sincronizar tempo quando mudar significativamente (mais de 2 segundos de diferença)
  useEffect(() => {
    if (playerReady && Math.abs(currentTime - localTime) > 2) {
      sendCommand("seekTo", [currentTime, true]);
      setLocalTime(currentTime);
      lastSyncTime.current = Date.now();
    }
  }, [currentTime, localTime, playerReady, sendCommand]);

  // Escutar mensagens do player YouTube
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        
        if (data.event === "onReady") {
          setPlayerReady(true);
          setIsLoading(false);
          // Iniciar no tempo correto
          if (currentTime > 0) {
            sendCommand("seekTo", [currentTime, true]);
          }
        }
        
        if (data.event === "onStateChange") {
          // -1: não iniciado, 0: finalizado, 1: reproduzindo, 2: pausado, 3: buffering
          const state = data.info;
          if (state === 1 && !isPlaying) {
            onPlayPause?.(true);
          } else if (state === 2 && isPlaying) {
            onPlayPause?.(false);
          }
        }

        if (data.event === "infoDelivery" && data.info?.currentTime !== undefined) {
          const newTime = data.info.currentTime;
          setLocalTime(newTime);
          
          // Reportar tempo a cada 3 segundos para sincronização
          if (Date.now() - lastSyncTime.current > 3000) {
            onTimeUpdate?.(newTime);
            lastSyncTime.current = Date.now();
          }
        }
      } catch (e) {
        // Ignorar mensagens não-JSON
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentTime, isPlaying, onPlayPause, onTimeUpdate, sendCommand]);

  // Atualizar tempo local quando reproduzindo
  useEffect(() => {
    if (!isPlaying || !playerReady) return;

    const interval = setInterval(() => {
      setLocalTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playerReady]);

  if (platform === "youtube") {
    const youtubeId = getYouTubeId(videoId);
    // URL com enablejsapi=1 para controle via postMessage e origin para segurança
    const youtubeUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=${isPlaying ? 1 : 0}&start=${Math.floor(currentTime)}&rel=0&modestbranding=1&playsinline=1`;

    if (Platform.OS === "web") {
      return (
        <View className="w-full rounded-lg overflow-hidden relative" style={{ aspectRatio: "16/9" }}>
          {isLoading && (
            <View className="absolute inset-0 items-center justify-center bg-black z-10">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-white mt-2">Carregando vídeo...</Text>
            </View>
          )}
          <iframe
            ref={(ref) => { iframeRef.current = ref; }}
            width="100%"
            height="100%"
            src={youtubeUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: "none", backgroundColor: "#000" }}
            onLoad={() => {
              // Player carregou, aguardar onReady do YouTube
              setTimeout(() => setIsLoading(false), 1000);
            }}
          />
          
          {/* Barra de controle inferior */}
          <View className="absolute bottom-0 left-0 right-0 bg-black/80 px-4 py-2 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => onPlayPause?.(!isPlaying)}
              className="p-1"
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color="white"
              />
            </TouchableOpacity>
            
            <View className="flex-1 mx-3">
              <View className="h-1 bg-white/30 rounded-full overflow-hidden">
                <View 
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min((localTime / 3600) * 100, 100)}%` }}
                />
              </View>
            </View>
            
            <Text className="text-white text-xs font-mono">{formatTime(localTime)}</Text>
          </View>
        </View>
      );
    } else {
      // Mobile: mostrar informações do vídeo
      return (
        <View
          className="w-full bg-black rounded-lg items-center justify-center"
          style={{ aspectRatio: "16/9" }}
        >
          <Ionicons name="logo-youtube" size={48} color="#FF0000" />
          <Text className="text-white text-center px-4 mt-2 font-semibold">{title}</Text>
          <Text className="text-white/70 text-xs mt-2">
            {isPlaying ? "▶ Reproduzindo" : "⏸ Pausado"} • {formatTime(localTime)}
          </Text>
          <Text className="text-white/50 text-xs mt-1">ID: {youtubeId}</Text>
          
          <View className="flex-row gap-4 mt-4">
            <TouchableOpacity
              onPress={() => onPlayPause?.(!isPlaying)}
              className="bg-white/20 px-6 py-2 rounded-full"
            >
              <Text className="text-white font-semibold">
                {isPlaying ? "Pausar" : "Reproduzir"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  }

  // Google Drive
  if (platform === "google-drive") {
    const driveUrl = `https://drive.google.com/file/d/${videoId}/preview`;
    
    if (Platform.OS === "web") {
      return (
        <View className="w-full rounded-lg overflow-hidden relative" style={{ aspectRatio: "16/9" }}>
          {isLoading && (
            <View className="absolute inset-0 items-center justify-center bg-black z-10">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-white mt-2">Carregando Google Drive...</Text>
            </View>
          )}
          <iframe
            width="100%"
            height="100%"
            src={driveUrl}
            title={title}
            allow="autoplay"
            allowFullScreen
            style={{ border: "none", backgroundColor: "#000" }}
            onLoad={() => setIsLoading(false)}
          />
        </View>
      );
    }
  }

  // Fallback para outras plataformas
  return (
    <View
      className="w-full bg-surface rounded-lg items-center justify-center border border-border"
      style={{ aspectRatio: "16/9" }}
    >
      <Ionicons name="videocam-off" size={48} color={colors.muted} />
      <Text className="text-foreground text-center px-4 mt-2">
        {platform === "netflix" && "Netflix requer app nativo"}
        {platform === "prime" && "Prime Video requer app nativo"}
        {!["youtube", "google-drive", "netflix", "prime"].includes(platform) && "Plataforma não suportada"}
      </Text>
      <Text className="text-muted text-xs mt-2">
        Use YouTube ou Google Drive para assistir em grupo
      </Text>
    </View>
  );
}
