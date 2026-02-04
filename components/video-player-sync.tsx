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

  // Determinar a URL do vídeo
  const getVideoUrl = useCallback((): string => {
    // Se já é uma URL completa
    if (videoId.startsWith("http://") || videoId.startsWith("https://")) {
      return videoId;
    }

    // YouTube não é suportado diretamente
    if (platform === "youtube") {
      return "";
    }

    // Google Drive
    if (platform === "google-drive") {
      return `https://drive.google.com/uc?export=download&id=${videoId}`;
    }

    // URL direta
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

  // YouTube não suportado
  if (!videoUrl && platform === "youtube") {
    return (
      <View
        className="w-full bg-black rounded-xl items-center justify-center"
        style={{ aspectRatio: 16/9 }}
      >
        <Ionicons name="logo-youtube" size={64} color="#FF0000" />
        <Text className="text-white text-center mt-4 font-bold text-lg">
          YouTube não suportado
        </Text>
        <Text className="text-gray-400 text-sm mt-2 text-center px-6 leading-5">
          Para sincronização em tempo real, use uma URL direta de vídeo (MP4, WebM) ou Google Drive.
        </Text>
      </View>
    );
  }

  // Estado de erro
  if (playerState === "error") {
    return (
      <View
        className="w-full bg-black rounded-xl items-center justify-center"
        style={{ aspectRatio: 16/9 }}
      >
        <Ionicons name="alert-circle" size={64} color={colors.error} />
        <Text className="text-white text-center mt-4 font-bold text-lg">
          Erro ao carregar vídeo
        </Text>
        <Text className="text-gray-400 text-sm mt-2 text-center px-6 leading-5">
          {errorMessage || "Verifique se a URL do vídeo é válida e acessível."}
        </Text>
        <Pressable
          onPress={retryLoading}
          style={({ pressed }) => ({
            marginTop: 16,
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 24,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text className="text-white font-semibold">Tentar novamente</Text>
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
          preload="metadata"
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
                case 2: msg = "Erro de rede"; break;
                case 3: msg = "Erro de decodificação"; break;
                case 4: msg = "Formato não suportado"; break;
              }
            }
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

        {/* Play button central (quando pausado) */}
        {playerState === "paused" && showControls && (
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
              backgroundColor: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 15,
              transition: "transform 0.2s, background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.3)";
              e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)";
              e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
            }}
          >
            <Ionicons name="play" size={36} color="#fff" />
          </div>
        )}

        {/* Controles */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
            padding: "40px 16px 12px 16px",
            opacity: showControls ? 1 : 0,
            transition: "opacity 0.3s",
            zIndex: 10,
          }}
        >
          {/* Título */}
          <div style={{ marginBottom: 8 }}>
            <Text style={{ color: "#fff", fontSize: 12, opacity: 0.8 }} numberOfLines={1}>
              {title}
            </Text>
          </div>

          {/* Barra de progresso */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = (x / rect.width) * 100;
              seekToPercentage(Math.max(0, Math.min(100, percentage)));
            }}
            style={{
              height: 6,
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 3,
              cursor: "pointer",
              marginBottom: 12,
              position: "relative",
            }}
          >
            {/* Progresso */}
            <div
              style={{
                height: "100%",
                width: `${Math.min(progress, 100)}%`,
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
                left: `${Math.min(progress, 100)}%`,
                transform: "translate(-50%, -50%)",
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: colors.primary,
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}
            />
          </div>

          {/* Controles inferiores */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Lado esquerdo */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Play/Pause */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Ionicons 
                  name={playerState === "playing" ? "pause" : "play"} 
                  size={22} 
                  color="#fff" 
                />
              </div>

              {/* Skip -10s */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  skip(-10);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Ionicons name="play-back" size={16} color="#fff" />
              </div>

              {/* Skip +10s */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  skip(10);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Ionicons name="play-forward" size={16} color="#fff" />
              </div>

              {/* Volume */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Ionicons 
                    name={isMuted || volume === 0 ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high"} 
                    size={16} 
                    color="#fff" 
                  />
                </div>
                
                {/* Volume slider */}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 60,
                    height: 4,
                    cursor: "pointer",
                    accentColor: colors.primary,
                  }}
                />
              </div>

              {/* Tempo */}
              <Text style={{ color: "#fff", fontSize: 13, fontFamily: "monospace" }}>
                {formatTime(localTime)} / {formatTime(duration)}
              </Text>
            </div>

            {/* Lado direito */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Status de sincronização */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#22c55e",
                  }}
                />
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
                  Sincronizado
                </Text>
              </div>

              {/* Fullscreen */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Ionicons 
                  name={isFullscreen ? "contract" : "expand"} 
                  size={16} 
                  color="#fff" 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Player Mobile (placeholder)
  return (
    <View
      className="w-full bg-black rounded-xl items-center justify-center"
      style={{ aspectRatio: 16/9 }}
    >
      <Ionicons name="phone-portrait" size={64} color={colors.primary} />
      <Text className="text-white text-center mt-4 font-bold text-lg">
        Player Mobile
      </Text>
      <Text className="text-gray-400 text-sm mt-2 text-center px-6 leading-5">
        Para melhor experiência de sincronização, use o app no navegador web.
      </Text>
    </View>
  );
}
