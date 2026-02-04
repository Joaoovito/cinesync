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
  
  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSyncTime = useRef(0);
  const isSeeking = useRef(false);
  const initialSeekDone = useRef(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useKeepAwake();

  // Determinar a URL do vídeo - aceita qualquer URL
  const getVideoUrl = useCallback((): string => {
    // Se já é uma URL completa, usar diretamente
    if (videoId.startsWith("http://") || videoId.startsWith("https://")) {
      return videoId;
    }

    // YouTube - tentar extrair ID e usar embed (não funciona para sync, mas mostra algo)
    if (platform === "youtube") {
      // Extrair ID do YouTube se for URL
      const youtubeMatch = videoId.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
      if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}?enablejsapi=1&autoplay=1`;
      }
      // Se for só o ID
      if (videoId.length === 11) {
        return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1`;
      }
      return "";
    }

    // Google Drive - converter para URL de download direto
    if (platform === "google-drive") {
      // Se for URL completa do Drive
      const driveMatch = videoId.match(/\/d\/([^/]+)/);
      if (driveMatch) {
        return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
      }
      // Se for só o ID
      return `https://drive.google.com/uc?export=download&id=${videoId}`;
    }

    // URL direta - retornar como está
    return videoId;
  }, [videoId, platform]);

  const videoUrl = getVideoUrl();

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

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play().catch((err) => {
        console.error("[Player] Erro ao dar play:", err);
      });
    } else {
      videoRef.current.pause();
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Seek para posição específica
  const seekTo = useCallback((time: number) => {
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
  }, [duration, onTimeUpdate, resetControlsTimeout]);

  // Seek por porcentagem (clique na barra)
  const seekToPercentage = useCallback((percentage: number) => {
    if (duration <= 0) return;
    const newTime = (percentage / 100) * duration;
    seekTo(newTime);
  }, [duration, seekTo]);

  // Pular 10 segundos
  const skip = useCallback((seconds: number) => {
    seekTo(localTime + seconds);
  }, [localTime, seekTo]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    resetControlsTimeout();
  }, [isMuted, resetControlsTimeout]);

  // Ajustar volume
  const changeVolume = useCallback((newVolume: number) => {
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
  }, [isMuted, resetControlsTimeout]);

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
    if (!videoRef.current) return;
    setPlayerState("loading");
    setErrorMessage(null);
    videoRef.current.load();
  }, []);

  // Controlar play/pause externo (sincronização)
  useEffect(() => {
    if (!videoRef.current || Platform.OS !== "web") return;

    try {
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    } catch (e) {
      console.log("[Player] Erro ao sincronizar play/pause:", e);
    }
  }, [isPlaying]);

  // Sincronizar tempo quando mudar significativamente (>3s de diferença)
  useEffect(() => {
    if (!videoRef.current || isSeeking.current || Platform.OS !== "web") return;

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
  }, [currentTime, localTime]);

  // Atualizar tempo local e enviar para servidor periodicamente
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && !isSeeking.current) {
        const time = videoRef.current.currentTime;
        setLocalTime(time);

        // Enviar atualização a cada 3 segundos
        if (Date.now() - lastSyncTime.current > 3000) {
          onTimeUpdate?.(time);
          lastSyncTime.current = Date.now();
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [onTimeUpdate]);

  // Listener para fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // YouTube - usar iframe (sem sincronização real)
  if (platform === "youtube" && videoUrl) {
    return (
      <View
        className="w-full bg-black rounded-xl overflow-hidden"
        style={{ aspectRatio: 16/9 }}
      >
        {Platform.OS === "web" ? (
          <iframe
            src={videoUrl}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="logo-youtube" size={64} color="#FF0000" />
            <Text className="text-white text-center mt-4 font-bold text-lg">
              YouTube
            </Text>
            <Text className="text-gray-400 text-sm mt-2 text-center px-6">
              Abra no navegador para assistir
            </Text>
          </View>
        )}
      </View>
    );
  }

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
          Cole uma URL direta de vídeo (MP4, WebM, etc.)
        </Text>
      </View>
    );
  }

  // Estado de erro
  if (playerState === "error") {
    return (
      <View
        className="w-full bg-black rounded-xl items-center justify-center p-4"
        style={{ aspectRatio: 16/9 }}
      >
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text className="text-white text-center mt-3 font-bold text-base">
          Erro ao carregar vídeo
        </Text>
        <Text className="text-gray-400 text-xs mt-2 text-center px-4 leading-4">
          {errorMessage || "Verifique se a URL é válida e acessível."}
        </Text>
        <Text className="text-gray-500 text-xs mt-2 text-center px-4 leading-4">
          URL: {videoUrl.substring(0, 50)}...
        </Text>
        <Pressable
          onPress={retryLoading}
          style={({ pressed }) => ({
            marginTop: 12,
            backgroundColor: colors.primary,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text className="text-white font-semibold text-sm">Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  // Player Web
  if (Platform.OS === "web") {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          aspectRatio: "16/9",
          backgroundColor: "#000",
          borderRadius: isFullscreen ? 0 : 12,
          overflow: "hidden",
          position: "relative",
          cursor: "pointer",
        }}
        onClick={resetControlsTimeout}
        onMouseMove={resetControlsTimeout}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          src={videoUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backgroundColor: "#000",
          }}
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          onLoadStart={() => setPlayerState("loading")}
          onLoadedMetadata={(e) => {
            const video = e.target as HTMLVideoElement;
            setDuration(video.duration);
            setPlayerState("ready");
            
            // Seek inicial
            if (currentTime > 0 && !initialSeekDone.current) {
              video.currentTime = currentTime;
              setLocalTime(currentTime);
              initialSeekDone.current = true;
            }
          }}
          onCanPlay={() => {
            if (playerState === "loading" || playerState === "buffering") {
              setPlayerState("ready");
            }
          }}
          onWaiting={() => setPlayerState("buffering")}
          onPlaying={() => setPlayerState("playing")}
          onPause={() => setPlayerState("paused")}
          onPlay={() => {
            setPlayerState("playing");
            if (!isPlaying) onPlayPause?.(true);
          }}
          onEnded={() => {
            setPlayerState("paused");
            onPlayPause?.(false);
          }}
          onError={(e) => {
            const video = e.target as HTMLVideoElement;
            let msg = "Erro desconhecido";
            if (video.error) {
              switch (video.error.code) {
                case 1: msg = "Carregamento abortado"; break;
                case 2: msg = "Erro de rede - verifique sua conexão"; break;
                case 3: msg = "Erro de decodificação - arquivo corrompido"; break;
                case 4: msg = "Formato não suportado ou CORS bloqueado"; break;
              }
            }
            console.error("[Player] Erro:", video.error, "URL:", videoUrl);
            setErrorMessage(msg);
            setPlayerState("error");
          }}
          onTimeUpdate={(e) => {
            const video = e.target as HTMLVideoElement;
            if (!isSeeking.current) {
              setLocalTime(video.currentTime);
            }
          }}
          onVolumeChange={(e) => {
            const video = e.target as HTMLVideoElement;
            setVolume(video.volume);
            setIsMuted(video.muted);
          }}
        />

        {/* Loading/Buffering Overlay */}
        {(playerState === "loading" || playerState === "buffering") && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.7)",
              zIndex: 20,
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: "#fff", marginTop: 12, fontSize: 14 }}>
              {playerState === "buffering" ? "Carregando..." : "Preparando vídeo..."}
            </Text>
          </div>
        )}

        {/* Play button central (quando pausado ou pronto) */}
        {(playerState === "paused" || playerState === "ready") && showControls && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "rgba(99, 102, 241, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 15,
              transition: "transform 0.2s, background-color 0.2s",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
            }}
          >
            <Ionicons name="play" size={36} color="#fff" style={{ marginLeft: 4 }} />
          </div>
        )}

        {/* Controles */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.9))",
            padding: "40px 16px 16px",
            opacity: showControls ? 1 : 0,
            transition: "opacity 0.3s",
            zIndex: 10,
          }}
        >
          {/* Barra de progresso */}
          <div
            style={{
              width: "100%",
              height: 6,
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 3,
              marginBottom: 12,
              cursor: "pointer",
              position: "relative",
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percentage = ((e.clientX - rect.left) / rect.width) * 100;
              seekToPercentage(percentage);
            }}
          >
            {/* Progresso carregado (buffer) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${Math.min(progress + 10, 100)}%`,
                backgroundColor: "rgba(255,255,255,0.3)",
                borderRadius: 3,
              }}
            />
            {/* Progresso atual */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${progress}%`,
                backgroundColor: colors.primary,
                borderRadius: 3,
                transition: "width 0.1s linear",
              }}
            />
            {/* Indicador */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `${progress}%`,
                transform: "translate(-50%, -50%)",
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "#fff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}
            />
          </div>

          {/* Controles inferiores */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Esquerda: Play, Skip, Tempo */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Play/Pause */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={playerState === "playing" ? "pause" : "play"}
                  size={28}
                  color="#fff"
                />
              </button>

              {/* Skip -10s */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skip(-10);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="play-back" size={22} color="#fff" />
              </button>

              {/* Skip +10s */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skip(10);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="play-forward" size={22} color="#fff" />
              </button>

              {/* Tempo */}
              <span style={{ color: "#fff", fontSize: 13, fontFamily: "monospace" }}>
                {formatTime(localTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Direita: Volume, Fullscreen */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Volume */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={isMuted || volume === 0 ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high"}
                    size={22}
                    color="#fff"
                  />
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 70,
                    height: 4,
                    cursor: "pointer",
                    accentColor: colors.primary,
                  }}
                />
              </div>

              {/* Fullscreen */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={isFullscreen ? "contract" : "expand"}
                  size={22}
                  color="#fff"
                />
              </button>
            </div>
          </div>
        </div>

        {/* Título */}
        {showControls && title && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              background: "linear-gradient(rgba(0,0,0,0.7), transparent)",
              padding: "12px 16px 30px",
              zIndex: 10,
            }}
          >
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>
              {title}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Mobile fallback
  return (
    <View
      className="w-full bg-black rounded-xl items-center justify-center"
      style={{ aspectRatio: 16/9 }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text className="text-white text-center mt-4">
        Carregando player...
      </Text>
    </View>
  );
}
