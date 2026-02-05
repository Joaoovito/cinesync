/**
 * VideoPlayerSync - Player de vídeo com sincronização via Socket.IO
 * 
 * Arquitetura de Overlay:
 * 1. YoutubePlayer invisível (controles nativos desabilitados)
 * 2. Controles personalizados sobrepostos
 * 3. Lógica de "marionete" - botões emitem eventos, ações executam ao receber
 */

import { View, Text, ActivityIndicator, Platform, Pressable, Dimensions } from "react-native";
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import Slider from "@react-native-community/slider";

// Importar YoutubePlayer apenas em plataformas nativas
let YoutubePlayer: any = null;
if (Platform.OS !== "web") {
  try {
    YoutubePlayer = require("react-native-youtube-iframe").default;
  } catch (e) {
    console.log("[VideoPlayer] react-native-youtube-iframe não disponível");
  }
}

interface VideoPlayerSyncProps {
  videoId: string;
  platform: string;
  title: string;
  isPlaying?: boolean;
  currentTime?: number;
  // Callbacks de marionete - emitir eventos, não executar localmente
  onPlayRequest?: () => void;
  onPauseRequest?: () => void;
  onSeekRequest?: (time: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onReady?: () => void;
}

export interface VideoPlayerSyncRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

type PlayerState = "loading" | "ready" | "playing" | "paused" | "error" | "buffering";

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
  
  // Se for só o ID (11 caracteres)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  return null;
}

export const VideoPlayerSync = forwardRef<VideoPlayerSyncRef, VideoPlayerSyncProps>(({
  videoId,
  platform,
  title,
  isPlaying = false,
  currentTime = 0,
  onPlayRequest,
  onPauseRequest,
  onSeekRequest,
  onTimeUpdate,
  onReady,
}, ref) => {
  const colors = useColors();
  const { width: screenWidth } = Dimensions.get("window");
  const playerHeight = (screenWidth * 9) / 16; // Aspect ratio 16:9
  
  // Estados do player
  const [playerState, setPlayerState] = useState<PlayerState>("loading");
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  
  // Refs
  const playerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimeUpdate = useRef(0);
  const isSeeking = useRef(false);

  useKeepAwake();

  // Detectar se é YouTube
  const youtubeId = (() => {
    if (platform === "youtube") {
      return extractYouTubeId(videoId);
    }
    if (videoId.includes("youtube.com") || videoId.includes("youtu.be")) {
      return extractYouTubeId(videoId);
    }
    return null;
  })();
  const isYouTube = !!youtubeId;

  // Formatar tempo (HH:MM:SS ou MM:SS)
  const formatTime = useCallback((seconds: number): string => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Calcular progresso
  const progress = duration > 0 ? (localTime / duration) * 100 : 0;

  // Auto-hide controles
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    setShowControls(true);
    if (playerState === "playing") {
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [playerState]);

  // ==================== COMANDOS DO PLAYER (executados ao receber evento) ====================

  // Play - executar localmente
  const executePlay = useCallback(() => {
    console.log("[Player] Executando PLAY");
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      const message = JSON.stringify({
        event: "command",
        func: "playVideo",
        args: [],
      });
      iframeRef.current.contentWindow.postMessage(message, "*");
    }
    setPlayerState("playing");
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Pause - executar localmente
  const executePause = useCallback(() => {
    console.log("[Player] Executando PAUSE");
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      const message = JSON.stringify({
        event: "command",
        func: "pauseVideo",
        args: [],
      });
      iframeRef.current.contentWindow.postMessage(message, "*");
    }
    setPlayerState("paused");
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Seek - executar localmente
  const executeSeek = useCallback((time: number) => {
    console.log("[Player] Executando SEEK para:", time);
    isSeeking.current = true;
    
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      const message = JSON.stringify({
        event: "command",
        func: "seekTo",
        args: [time, true],
      });
      iframeRef.current.contentWindow.postMessage(message, "*");
    }
    
    setLocalTime(time);
    setTimeout(() => {
      isSeeking.current = false;
    }, 500);
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Expor métodos via ref
  useImperativeHandle(ref, () => ({
    play: executePlay,
    pause: executePause,
    seekTo: executeSeek,
    getCurrentTime: () => localTime,
  }), [executePlay, executePause, executeSeek, localTime]);

  // ==================== HANDLERS DE CONTROLE (emitem eventos) ====================

  // Toggle play/pause - EMITE EVENTO, NÃO EXECUTA
  const handleTogglePlayPause = useCallback(() => {
    resetControlsTimeout();
    
    if (playerState === "playing") {
      console.log("[Player] Emitindo PAUSE request");
      onPauseRequest?.();
    } else {
      console.log("[Player] Emitindo PLAY request");
      onPlayRequest?.();
    }
  }, [playerState, onPlayRequest, onPauseRequest, resetControlsTimeout]);

  // Seek - EMITE EVENTO, NÃO EXECUTA
  const handleSeek = useCallback((time: number) => {
    const newTime = Math.max(0, Math.min(time, duration));
    console.log("[Player] Emitindo SEEK request para:", newTime);
    onSeekRequest?.(newTime);
    resetControlsTimeout();
  }, [duration, onSeekRequest, resetControlsTimeout]);

  // Slider handlers
  const handleSliderStart = useCallback(() => {
    setIsSliding(true);
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
  }, []);

  const handleSliderComplete = useCallback((value: number) => {
    setIsSliding(false);
    const newTime = (value / 100) * duration;
    handleSeek(newTime);
  }, [duration, handleSeek]);

  // Skip segundos
  const skip = useCallback((seconds: number) => {
    handleSeek(localTime + seconds);
  }, [localTime, handleSeek]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      const message = JSON.stringify({
        event: "command",
        func: isMuted ? "unMute" : "mute",
        args: [],
      });
      iframeRef.current.contentWindow.postMessage(message, "*");
    }
    setIsMuted(!isMuted);
    resetControlsTimeout();
  }, [isMuted, resetControlsTimeout]);

  // ==================== SINCRONIZAÇÃO COM PROPS ====================

  // Executar play/pause quando isPlaying mudar (comando do servidor)
  useEffect(() => {
    if (isPlaying && playerState !== "playing") {
      executePlay();
    } else if (!isPlaying && playerState === "playing") {
      executePause();
    }
  }, [isPlaying, playerState, executePlay, executePause]);

  // Executar seek quando currentTime mudar significativamente (comando do servidor)
  useEffect(() => {
    if (isSeeking.current) return;
    
    const diff = Math.abs(currentTime - localTime);
    if (diff > 2 && currentTime > 0) {
      console.log("[Player] Correção de tempo do servidor:", currentTime, "diff:", diff);
      executeSeek(currentTime);
    }
  }, [currentTime, localTime, executeSeek]);

  // ==================== WEB: YOUTUBE IFRAME ====================

  // Listener para mensagens do YouTube IFrame
  useEffect(() => {
    if (!isYouTube || Platform.OS !== "web" || typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        
        if (data.event === "onReady") {
          console.log("[YouTube] Player ready");
          setPlayerState("ready");
          onReady?.();
          
          // Seek para o tempo inicial se necessário
          if (currentTime > 0) {
            setTimeout(() => executeSeek(currentTime), 500);
          }
        }
        
        if (data.event === "onStateChange") {
          const state = data.info;
          switch (state) {
            case -1:
              setPlayerState("loading");
              break;
            case 0:
              setPlayerState("paused");
              break;
            case 1:
              setPlayerState("playing");
              break;
            case 2:
              setPlayerState("paused");
              break;
            case 3:
              setPlayerState("buffering");
              break;
          }
        }
        
        if (data.event === "infoDelivery") {
          if (data.info?.currentTime !== undefined && !isSeeking.current && !isSliding) {
            setLocalTime(data.info.currentTime);
            
            // Enviar atualização de tempo
            if (Date.now() - lastTimeUpdate.current > 250) {
              onTimeUpdate?.(data.info.currentTime);
              lastTimeUpdate.current = Date.now();
            }
          }
          if (data.info?.duration !== undefined) {
            setDuration(data.info.duration);
          }
          if (data.info?.muted !== undefined) {
            setIsMuted(data.info.muted);
          }
        }
      } catch (e) {
        // Ignorar mensagens que não são JSON
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [isYouTube, currentTime, executeSeek, onTimeUpdate, onReady, isSliding]);

  // ==================== RENDER ====================

  // Renderizar controles overlay
  const renderControls = () => (
    <Pressable
      onPress={resetControlsTimeout}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "flex-end",
        backgroundColor: showControls ? "rgba(0,0,0,0.4)" : "transparent",
        zIndex: 10,
      }}
    >
      {/* Área central - Play/Pause grande */}
      <Pressable
        onPress={handleTogglePlayPause}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: [{ translateX: -30 }, { translateY: -30 }],
          opacity: showControls ? 1 : 0,
        }}
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons
            name={playerState === "playing" ? "pause" : "play"}
            size={32}
            color="white"
          />
        </View>
      </Pressable>

      {/* Loading/Buffering indicator */}
      {(playerState === "loading" || playerState === "buffering") && (
        <View
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: [{ translateX: -20 }, { translateY: -20 }],
          }}
        >
          <ActivityIndicator size="large" color="white" />
        </View>
      )}

      {/* Barra de controles inferior */}
      {showControls && (
        <View
          style={{
            padding: 12,
            paddingBottom: 16,
            backgroundColor: "rgba(0,0,0,0.6)",
          }}
        >
          {/* Slider de progresso */}
          {Platform.OS === "web" ? (
            <Pressable
              onPress={(e: any) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.nativeEvent.pageX - rect.left;
                const percentage = (x / rect.width) * 100;
                const newTime = (percentage / 100) * duration;
                handleSeek(newTime);
              }}
              style={{
                height: 20,
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  height: 4,
                  backgroundColor: "rgba(255,255,255,0.3)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${isSliding ? sliderValue : progress}%`,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                  }}
                />
              </View>
            </Pressable>
          ) : (
            <Slider
              style={{ width: "100%", height: 20, marginBottom: 8 }}
              minimumValue={0}
              maximumValue={100}
              value={isSliding ? sliderValue : progress}
              onSlidingStart={handleSliderStart}
              onValueChange={handleSliderChange}
              onSlidingComplete={handleSliderComplete}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor={colors.primary}
            />
          )}

          {/* Controles */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Lado esquerdo */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {/* Play/Pause */}
              <Pressable onPress={handleTogglePlayPause}>
                <Ionicons
                  name={playerState === "playing" ? "pause" : "play"}
                  size={24}
                  color="white"
                />
              </Pressable>

              {/* Skip -10s */}
              <Pressable onPress={() => skip(-10)}>
                <Ionicons name="play-back" size={20} color="white" />
              </Pressable>

              {/* Skip +10s */}
              <Pressable onPress={() => skip(10)}>
                <Ionicons name="play-forward" size={20} color="white" />
              </Pressable>

              {/* Volume */}
              <Pressable onPress={toggleMute}>
                <Ionicons
                  name={isMuted ? "volume-mute" : "volume-high"}
                  size={20}
                  color="white"
                />
              </Pressable>

              {/* Tempo */}
              <Text style={{ color: "white", fontSize: 12 }}>
                {formatTime(localTime)} / {formatTime(duration)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );

  // ==================== YOUTUBE PLAYER ====================
  if (isYouTube && youtubeId) {
    // Web: usar iframe
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const youtubeEmbedUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=0&controls=0&showinfo=0&modestbranding=1&rel=0&iv_load_policy=3&fs=0&playsinline=1&origin=${origin}`;

      return (
        <View
          className="w-full bg-black rounded-xl overflow-hidden"
          style={{ aspectRatio: 16/9 }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
            }}
          >
            {/* YouTube IFrame - controles ocultos, sem interação */}
            <iframe
              ref={iframeRef as any}
              src={youtubeEmbedUrl}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "none",
                pointerEvents: "none", // Impedir toques diretos
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
            
            {/* Overlay com nossos controles */}
            {renderControls()}
          </div>
        </View>
      );
    }

    // Mobile: usar react-native-youtube-iframe
    if (YoutubePlayer) {
      return (
        <View
          className="w-full bg-black rounded-xl overflow-hidden"
          style={{ height: playerHeight }}
        >
          <View style={{ position: "relative", width: "100%", height: "100%" }}>
            {/* YouTube Player - controles ocultos */}
            <View pointerEvents="none" style={{ width: "100%", height: "100%" }}>
              <YoutubePlayer
                ref={playerRef}
                height={playerHeight}
                width={screenWidth - 32}
                videoId={youtubeId}
                play={isPlaying}
                initialPlayerParams={{
                  controls: false,
                  modestbranding: true,
                  rel: false,
                  showClosedCaptions: false,
                }}
                onReady={() => {
                  console.log("[YouTube] Player ready");
                  setPlayerState("ready");
                  onReady?.();
                }}
                onChangeState={(state: string) => {
                  console.log("[YouTube] State:", state);
                  switch (state) {
                    case "playing":
                      setPlayerState("playing");
                      break;
                    case "paused":
                      setPlayerState("paused");
                      break;
                    case "buffering":
                      setPlayerState("buffering");
                      break;
                    case "ended":
                      setPlayerState("paused");
                      break;
                  }
                }}
                onProgress={(data: { currentTime: number }) => {
                  if (!isSeeking.current && !isSliding) {
                    setLocalTime(data.currentTime);
                    if (Date.now() - lastTimeUpdate.current > 250) {
                      onTimeUpdate?.(data.currentTime);
                      lastTimeUpdate.current = Date.now();
                    }
                  }
                }}
              />
            </View>
            
            {/* Overlay com nossos controles */}
            {renderControls()}
          </View>
        </View>
      );
    }

    // Fallback se YoutubePlayer não estiver disponível
    return (
      <View
        className="w-full bg-black rounded-xl items-center justify-center"
        style={{ aspectRatio: 16/9 }}
      >
        <Ionicons name="logo-youtube" size={64} color="#FF0000" />
        <Text className="text-white text-center mt-4 font-bold text-lg">
          YouTube
        </Text>
        <Text className="text-gray-400 text-sm mt-2 text-center px-6">
          Abra no navegador para assistir sincronizado
        </Text>
      </View>
    );
  }

  // Sem URL válida
  return (
    <View
      className="w-full bg-black rounded-xl items-center justify-center"
      style={{ aspectRatio: 16/9 }}
    >
      <Ionicons name="videocam-off" size={64} color="#666" />
      <Text className="text-white text-center mt-4 font-bold text-lg">
        URL de vídeo inválida
      </Text>
      <Text className="text-gray-400 text-sm mt-2 text-center px-6 leading-5">
        Cole uma URL do YouTube para assistir
      </Text>
    </View>
  );
});

VideoPlayerSync.displayName = "VideoPlayerSync";
