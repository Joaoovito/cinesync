import { View, Text, ActivityIndicator, Platform, Pressable } from "react-native";
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
  
  // Estados do player
  const [playerState, setPlayerState] = useState<PlayerState>("loading");
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [youtubeReady, setYoutubeReady] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSyncTime = useRef(0);
  const isSeeking = useRef(false);
  const initialSeekDone = useRef(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useKeepAwake();

  // Detectar se é YouTube - verificar plataforma OU detectar automaticamente da URL
  const youtubeId = (() => {
    // Se a plataforma é youtube, extrair o ID
    if (platform === "youtube") {
      return extractYouTubeId(videoId);
    }
    // Também detectar automaticamente se a URL parece ser do YouTube
    if (videoId.includes("youtube.com") || videoId.includes("youtu.be")) {
      return extractYouTubeId(videoId);
    }
    return null;
  })();
  const isYouTube = !!youtubeId;
  
  // Debug
  useEffect(() => {
    console.log("[VideoPlayer] videoId:", videoId);
    console.log("[VideoPlayer] platform:", platform);
    console.log("[VideoPlayer] youtubeId:", youtubeId);
    console.log("[VideoPlayer] isYouTube:", isYouTube);
  }, [videoId, platform, youtubeId, isYouTube]);

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

  // ==================== YOUTUBE PLAYER CONTROLS ====================
  
  // Enviar comando para o YouTube IFrame
  const sendYouTubeCommand = useCallback((command: string, args?: any) => {
    if (!iframeRef.current?.contentWindow) return;
    
    const message = JSON.stringify({
      event: "command",
      func: command,
      args: args || [],
    });
    
    iframeRef.current.contentWindow.postMessage(message, "*");
  }, []);

  // Play YouTube
  const youtubePlay = useCallback(() => {
    sendYouTubeCommand("playVideo");
    setPlayerState("playing");
    onPlayPause?.(true);
    resetControlsTimeout();
  }, [sendYouTubeCommand, onPlayPause, resetControlsTimeout]);

  // Pause YouTube
  const youtubePause = useCallback(() => {
    sendYouTubeCommand("pauseVideo");
    setPlayerState("paused");
    onPlayPause?.(false);
    resetControlsTimeout();
  }, [sendYouTubeCommand, onPlayPause, resetControlsTimeout]);

  // Seek YouTube
  const youtubeSeek = useCallback((time: number) => {
    isSeeking.current = true;
    sendYouTubeCommand("seekTo", [time, true]);
    setLocalTime(time);
    onTimeUpdate?.(time);
    setTimeout(() => {
      isSeeking.current = false;
    }, 500);
    resetControlsTimeout();
  }, [sendYouTubeCommand, onTimeUpdate, resetControlsTimeout]);

  // Toggle play/pause YouTube
  const youtubeTogglePlayPause = useCallback(() => {
    if (playerState === "playing") {
      youtubePause();
    } else {
      youtubePlay();
    }
  }, [playerState, youtubePlay, youtubePause]);

  // Mute/Unmute YouTube
  const youtubeToggleMute = useCallback(() => {
    if (isMuted) {
      sendYouTubeCommand("unMute");
      setIsMuted(false);
    } else {
      sendYouTubeCommand("mute");
      setIsMuted(true);
    }
    resetControlsTimeout();
  }, [isMuted, sendYouTubeCommand, resetControlsTimeout]);

  // Set volume YouTube
  const youtubeSetVolume = useCallback((vol: number) => {
    sendYouTubeCommand("setVolume", [vol * 100]);
    setVolume(vol);
    if (vol === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
      sendYouTubeCommand("unMute");
    }
    resetControlsTimeout();
  }, [sendYouTubeCommand, isMuted, resetControlsTimeout]);

  // Listener para mensagens do YouTube IFrame
  useEffect(() => {
    if (!isYouTube || Platform.OS !== "web") return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        
        if (data.event === "onReady") {
          console.log("[YouTube] Player ready");
          setYoutubeReady(true);
          setPlayerState("ready");
          
          // Seek para o tempo inicial se necessário
          if (currentTime > 0 && !initialSeekDone.current) {
            initialSeekDone.current = true;
            setTimeout(() => {
              youtubeSeek(currentTime);
            }, 500);
          }
        }
        
        if (data.event === "onStateChange") {
          const state = data.info;
          // -1: não iniciado, 0: finalizado, 1: reproduzindo, 2: pausado, 3: buffering, 5: vídeo na fila
          switch (state) {
            case -1:
              setPlayerState("loading");
              break;
            case 0:
              setPlayerState("paused");
              onPlayPause?.(false);
              break;
            case 1:
              setPlayerState("playing");
              onPlayPause?.(true);
              break;
            case 2:
              setPlayerState("paused");
              onPlayPause?.(false);
              break;
            case 3:
              setPlayerState("buffering");
              break;
          }
        }
        
        if (data.event === "infoDelivery") {
          if (data.info?.currentTime !== undefined && !isSeeking.current) {
            setLocalTime(data.info.currentTime);
            
            // Enviar atualização a cada 3 segundos
            if (Date.now() - lastSyncTime.current > 3000) {
              onTimeUpdate?.(data.info.currentTime);
              lastSyncTime.current = Date.now();
            }
          }
          if (data.info?.duration !== undefined) {
            setDuration(data.info.duration);
          }
          if (data.info?.volume !== undefined) {
            setVolume(data.info.volume / 100);
          }
          if (data.info?.muted !== undefined) {
            setIsMuted(data.info.muted);
          }
        }
      } catch (e) {
        // Ignorar mensagens que não são JSON
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isYouTube, currentTime, youtubeSeek, onPlayPause, onTimeUpdate]);

  // Sincronizar tempo do YouTube quando mudar significativamente
  useEffect(() => {
    if (!isYouTube || !youtubeReady || isSeeking.current) return;

    const diff = Math.abs(currentTime - localTime);
    if (diff > 3 && currentTime > 0) {
      console.log("[YouTube] Sincronizando tempo:", currentTime, "diff:", diff);
      youtubeSeek(currentTime);
    }
  }, [isYouTube, youtubeReady, currentTime, localTime, youtubeSeek]);

  // Sincronizar play/pause do YouTube
  useEffect(() => {
    if (!isYouTube || !youtubeReady) return;

    if (isPlaying && playerState !== "playing") {
      youtubePlay();
    } else if (!isPlaying && playerState === "playing") {
      youtubePause();
    }
  }, [isYouTube, youtubeReady, isPlaying, playerState, youtubePlay, youtubePause]);

  // ==================== HTML5 VIDEO PLAYER CONTROLS ====================

  // Determinar URL para vídeos não-YouTube
  const getVideoUrl = useCallback((): string => {
    if (isYouTube) return "";
    
    // Se já é uma URL completa, usar diretamente
    if (videoId.startsWith("http://") || videoId.startsWith("https://")) {
      return videoId;
    }

    // Google Drive - converter para URL de download direto
    if (platform === "google-drive") {
      const driveMatch = videoId.match(/\/d\/([^/]+)/);
      if (driveMatch) {
        return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
      }
      return `https://drive.google.com/uc?export=download&id=${videoId}`;
    }

    return videoId;
  }, [videoId, platform, isYouTube]);

  const videoUrl = getVideoUrl();

  // Toggle play/pause HTML5
  const togglePlayPause = useCallback(() => {
    if (isYouTube) {
      youtubeTogglePlayPause();
      return;
    }
    
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play().catch(console.error);
    } else {
      videoRef.current.pause();
    }
    resetControlsTimeout();
  }, [isYouTube, youtubeTogglePlayPause, resetControlsTimeout]);

  // Seek HTML5
  const seekTo = useCallback((time: number) => {
    if (isYouTube) {
      youtubeSeek(time);
      return;
    }
    
    if (!videoRef.current) return;
    
    isSeeking.current = true;
    const newTime = Math.max(0, Math.min(time, duration));
    videoRef.current.currentTime = newTime;
    setLocalTime(newTime);
    onTimeUpdate?.(newTime);
    
    setTimeout(() => {
      isSeeking.current = false;
    }, 500);
    
    resetControlsTimeout();
  }, [isYouTube, youtubeSeek, duration, onTimeUpdate, resetControlsTimeout]);

  // Seek por porcentagem
  const seekToPercentage = useCallback((percentage: number) => {
    if (duration <= 0) return;
    const newTime = (percentage / 100) * duration;
    seekTo(newTime);
  }, [duration, seekTo]);

  // Pular segundos
  const skip = useCallback((seconds: number) => {
    seekTo(localTime + seconds);
  }, [localTime, seekTo]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (isYouTube) {
      youtubeToggleMute();
      return;
    }
    
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    resetControlsTimeout();
  }, [isYouTube, youtubeToggleMute, isMuted, resetControlsTimeout]);

  // Ajustar volume
  const changeVolume = useCallback((newVolume: number) => {
    if (isYouTube) {
      youtubeSetVolume(newVolume);
      return;
    }
    
    if (!videoRef.current) return;
    const vol = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = vol;
    setVolume(vol);
    if (vol === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
    resetControlsTimeout();
  }, [isYouTube, youtubeSetVolume, isMuted, resetControlsTimeout]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(console.error);
      setIsFullscreen(false);
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Retry loading
  const retryLoading = useCallback(() => {
    if (isYouTube) {
      if (iframeRef.current) {
        const src = iframeRef.current.src;
        iframeRef.current.src = "";
        setTimeout(() => {
          if (iframeRef.current) iframeRef.current.src = src;
        }, 100);
      }
    } else if (videoRef.current) {
      setPlayerState("loading");
      setErrorMessage(null);
      videoRef.current.load();
    }
  }, [isYouTube]);

  // Controlar play/pause externo HTML5 (sincronização)
  useEffect(() => {
    if (isYouTube || !videoRef.current || Platform.OS !== "web") return;

    try {
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    } catch (e) {
      console.log("[Player] Erro ao sincronizar play/pause:", e);
    }
  }, [isYouTube, isPlaying]);

  // Sincronizar tempo HTML5 quando mudar significativamente
  useEffect(() => {
    if (isYouTube || !videoRef.current || isSeeking.current || Platform.OS !== "web") return;

    const diff = Math.abs(currentTime - localTime);
    if (diff > 3 && currentTime > 0) {
      console.log("[Player] Sincronizando tempo:", currentTime, "diff:", diff);
      isSeeking.current = true;
      videoRef.current.currentTime = currentTime;
      setLocalTime(currentTime);
      setTimeout(() => {
        isSeeking.current = false;
      }, 500);
    }
  }, [isYouTube, currentTime, localTime]);

  // Atualizar tempo local HTML5
  useEffect(() => {
    if (isYouTube || Platform.OS !== "web") return;

    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && !isSeeking.current) {
        const time = videoRef.current.currentTime;
        setLocalTime(time);

        if (Date.now() - lastSyncTime.current > 3000) {
          onTimeUpdate?.(time);
          lastSyncTime.current = Date.now();
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isYouTube, onTimeUpdate]);

  // Listener para fullscreen change
  useEffect(() => {
    if (Platform.OS !== "web") return;
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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
      }}
    >
      {/* Área central - Play/Pause grande */}
      <Pressable
        onPress={togglePlayPause}
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
          {/* Barra de progresso */}
          <Pressable
            onPress={(e: any) => {
              if (Platform.OS === "web") {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.nativeEvent.pageX - rect.left;
                const percentage = (x / rect.width) * 100;
                seekToPercentage(percentage);
              }
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
                  width: `${progress}%`,
                  backgroundColor: colors.primary,
                  borderRadius: 2,
                }}
              />
            </View>
          </Pressable>

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
              <Pressable onPress={togglePlayPause}>
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
                  name={isMuted || volume === 0 ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high"}
                  size={20}
                  color="white"
                />
              </Pressable>

              {/* Tempo */}
              <Text style={{ color: "white", fontSize: 12 }}>
                {formatTime(localTime)} / {formatTime(duration)}
              </Text>
            </View>

            {/* Lado direito */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {/* Fullscreen */}
              <Pressable onPress={toggleFullscreen}>
                <Ionicons
                  name={isFullscreen ? "contract" : "expand"}
                  size={20}
                  color="white"
                />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );

  // ==================== YOUTUBE PLAYER ====================
  if (isYouTube && youtubeId) {
    // URL do YouTube com API habilitada e controles ocultos
    const youtubeEmbedUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=0&controls=0&showinfo=0&modestbranding=1&rel=0&iv_load_policy=3&fs=0&playsinline=1&origin=${Platform.OS === "web" ? window.location.origin : ""}`;

    return (
      <View
        className="w-full bg-black rounded-xl overflow-hidden"
        style={{ aspectRatio: 16/9 }}
      >
        {Platform.OS === "web" ? (
          <div
            ref={containerRef as any}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
            }}
          >
            {/* YouTube IFrame - controles ocultos */}
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
                pointerEvents: "none", // Desabilita interação direta com o iframe
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
            
            {/* Overlay com nossos controles */}
            {renderControls()}
          </div>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="logo-youtube" size={64} color="#FF0000" />
            <Text className="text-white text-center mt-4 font-bold text-lg">
              YouTube
            </Text>
            <Text className="text-gray-400 text-sm mt-2 text-center px-6">
              Abra no navegador para assistir sincronizado
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ==================== HTML5 VIDEO PLAYER ====================
  
  // Sem URL válida
  if (!videoUrl) {
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
          Cole uma URL direta de vídeo (MP4, WebM) ou link do YouTube
        </Text>
      </View>
    );
  }

  // Player HTML5 para vídeos diretos
  if (Platform.OS === "web") {
    return (
      <View
        className="w-full bg-black rounded-xl overflow-hidden"
        style={{ aspectRatio: 16/9 }}
      >
        <div
          ref={containerRef as any}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          <video
            ref={videoRef as any}
            src={videoUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              backgroundColor: "#000",
            }}
            playsInline
            crossOrigin="anonymous"
            onLoadStart={() => setPlayerState("loading")}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              setDuration(video.duration);
              setPlayerState("ready");
              
              // Seek para o tempo inicial
              if (currentTime > 0 && !initialSeekDone.current) {
                initialSeekDone.current = true;
                video.currentTime = currentTime;
                setLocalTime(currentTime);
              }
            }}
            onCanPlay={() => {
              if (playerState === "loading") {
                setPlayerState("ready");
              }
            }}
            onPlay={() => {
              setPlayerState("playing");
              onPlayPause?.(true);
              resetControlsTimeout();
            }}
            onPause={() => {
              setPlayerState("paused");
              onPlayPause?.(false);
            }}
            onWaiting={() => setPlayerState("buffering")}
            onPlaying={() => setPlayerState("playing")}
            onError={(e) => {
              const video = e.currentTarget;
              let msg = "Erro ao carregar vídeo";
              
              if (video.error) {
                switch (video.error.code) {
                  case 1:
                    msg = "Carregamento abortado";
                    break;
                  case 2:
                    msg = "Erro de rede";
                    break;
                  case 3:
                    msg = "Erro ao decodificar vídeo";
                    break;
                  case 4:
                    msg = "Formato não suportado ou CORS bloqueado";
                    break;
                }
              }
              
              setErrorMessage(msg);
              setPlayerState("error");
            }}
          />
          
          {/* Overlay de erro */}
          {playerState === "error" && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.9)",
                justifyContent: "center",
                alignItems: "center",
                padding: 20,
              }}
            >
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold", marginTop: 12, textAlign: "center" }}>
                {errorMessage}
              </Text>
              <Text style={{ color: "#999", fontSize: 12, marginTop: 8, textAlign: "center" }}>
                URL: {videoUrl.substring(0, 50)}...
              </Text>
              <Pressable
                onPress={retryLoading}
                style={{
                  marginTop: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "white", fontWeight: "600" }}>Tentar novamente</Text>
              </Pressable>
            </View>
          )}
          
          {/* Controles overlay */}
          {playerState !== "error" && renderControls()}
        </div>
      </View>
    );
  }

  // Mobile fallback
  return (
    <View
      className="w-full bg-black rounded-xl items-center justify-center"
      style={{ aspectRatio: 16/9 }}
    >
      <Ionicons name="play-circle" size={64} color="#666" />
      <Text className="text-white text-center mt-4 font-bold text-lg">
        {title}
      </Text>
      <Text className="text-gray-400 text-sm mt-2 text-center px-6">
        Abra no navegador para assistir
      </Text>
    </View>
  );
}
