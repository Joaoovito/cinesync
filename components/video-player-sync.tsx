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
}: VideoPlayerSyncProps) {
  const colors = useColors();
  const [localTime, setLocalTime] = useState(currentTime);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSyncTime = useRef(0);
  const initialSeekDone = useRef(false);

  const getYouTubeId = (input: string): string => {
    if (input.length === 11 && !input.includes("/")) {
      return input;
    }
    const match = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\\n?#]+)/);
    return match ? match[1] : input;
  };

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

  // Sincronizar tempo quando mudar significativamente (mais de 3 segundos de diferença)
  useEffect(() => {
    if (playerReady && currentTime > 0) {
      const diff = Math.abs(currentTime - localTime);
      // Sincronizar se diferença for maior que 3 segundos ou se for o primeiro seek
      if (diff > 3 || (!initialSeekDone.current && currentTime > 0)) {
        sendCommand("seekTo", [currentTime, true]);
        setLocalTime(currentTime);
        lastSyncTime.current = Date.now();
        initialSeekDone.current = true;
      }
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
          // Iniciar no tempo correto se já tiver um tempo salvo
          if (currentTime > 0) {
            setTimeout(() => {
              sendCommand("seekTo", [currentTime, true]);
              initialSeekDone.current = true;
            }, 500);
          }
        }
        
        if (data.event === "onStateChange") {
          // -1: não iniciado, 0: finalizado, 1: reproduzindo, 2: pausado, 3: buffering
          const state = data.info;
          setIsBuffering(state === 3);
          
          if (state === 1 && !isPlaying) {
            onPlayPause?.(true);
          } else if (state === 2 && isPlaying) {
            onPlayPause?.(false);
          }
        }

        if (data.event === "infoDelivery") {
          if (data.info?.currentTime !== undefined) {
            const newTime = data.info.currentTime;
            setLocalTime(newTime);
            
            // Reportar tempo a cada 2 segundos para sincronização e persistência
            if (Date.now() - lastSyncTime.current > 2000) {
              onTimeUpdate?.(newTime);
              lastSyncTime.current = Date.now();
            }
          }
          
          if (data.info?.duration !== undefined && data.info.duration > 0) {
            setDuration(data.info.duration);
          }
        }
      } catch (e) {
        // Ignorar mensagens não-JSON
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentTime, isPlaying, onPlayPause, onTimeUpdate, sendCommand]);

  // Atualizar tempo local quando reproduzindo (fallback se não receber do player)
  useEffect(() => {
    if (!isPlaying || !playerReady) return;

    const interval = setInterval(() => {
      setLocalTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playerReady]);

  // Calcular progresso
  const progress = duration > 0 ? (localTime / duration) * 100 : 0;

  if (platform === "youtube") {
    const youtubeId = getYouTubeId(videoId);
    // URL com enablejsapi=1 para controle via postMessage
    const youtubeUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=0&start=${Math.floor(currentTime)}&rel=0&modestbranding=1&playsinline=1&controls=0&showinfo=0`;

    if (Platform.OS === "web") {
      return (
        <View className="w-full rounded-xl overflow-hidden relative shadow-lg" style={{ aspectRatio: "16/9" }}>
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
            </View>
          )}
          
          {/* YouTube iframe */}
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
              setTimeout(() => setIsLoading(false), 1500);
            }}
          />
          
          {/* Controles customizados */}
          <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-8 pb-3 px-4">
            {/* Título do vídeo */}
            <Text className="text-white text-xs mb-2 opacity-80" numberOfLines={1}>
              {title}
            </Text>
            
            {/* Barra de progresso */}
            <View className="mb-3">
              <View className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <View 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${Math.min(progress, 100)}%`,
                    backgroundColor: colors.primary,
                  }}
                />
              </View>
            </View>
            
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
    } else {
      // Mobile: mostrar informações do vídeo
      return (
        <View
          className="w-full bg-black rounded-xl items-center justify-center"
          style={{ aspectRatio: "16/9" }}
        >
          <Ionicons name="logo-youtube" size={56} color="#FF0000" />
          <Text className="text-white text-center px-4 mt-3 font-semibold text-lg">{title}</Text>
          <Text className="text-white/70 text-sm mt-2">
            {isPlaying ? "▶ Reproduzindo" : "⏸ Pausado"} • {formatTime(localTime)}
          </Text>
          
          <View className="flex-row gap-4 mt-6">
            <TouchableOpacity
              onPress={() => onPlayPause?.(!isPlaying)}
              className="bg-red-600 px-8 py-3 rounded-full flex-row items-center gap-2"
              activeOpacity={0.8}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="white" />
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
        <View className="w-full rounded-xl overflow-hidden relative shadow-lg" style={{ aspectRatio: "16/9" }}>
          {isLoading && (
            <View className="absolute inset-0 items-center justify-center bg-black z-10">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-white mt-3 text-sm">Carregando Google Drive...</Text>
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
          
          {/* Info overlay para Google Drive */}
          <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-3 px-4">
            <Text className="text-white text-xs opacity-80">{title}</Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Ionicons name="logo-google" size={14} color="white" />
              <Text className="text-white/60 text-xs">Google Drive</Text>
            </View>
          </View>
        </View>
      );
    }
  }

  // Fallback para outras plataformas
  return (
    <View
      className="w-full bg-surface rounded-xl items-center justify-center border border-border"
      style={{ aspectRatio: "16/9" }}
    >
      <Ionicons name="videocam-off" size={56} color={colors.muted} />
      <Text className="text-foreground text-center px-6 mt-3 font-medium">
        {platform === "netflix" && "Netflix requer app nativo"}
        {platform === "prime" && "Prime Video requer app nativo"}
        {!["youtube", "google-drive", "netflix", "prime"].includes(platform) && "Plataforma não suportada"}
      </Text>
      <Text className="text-muted text-sm mt-2 text-center px-6">
        Use YouTube ou Google Drive para assistir em grupo
      </Text>
    </View>
  );
}
