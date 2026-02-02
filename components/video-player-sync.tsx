import { View, Text, Platform, ActivityIndicator } from "react-native";
import { useRef, useEffect, useState } from "react";
import { useColors } from "@/hooks/use-colors";

interface VideoPlayerSyncProps {
  videoId: string;
  platform: string;
  title: string;
  isPlaying?: boolean;
  currentTime?: number;
  onPlayPause?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number) => void;
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
  const [displayTime, setDisplayTime] = useState(currentTime);
  const [isLoading, setIsLoading] = useState(false);

  // Sincronizar currentTime quando mudar
  useEffect(() => {
    setDisplayTime(currentTime);
  }, [currentTime]);

  // Simular atualização de tempo
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setDisplayTime((prev) => {
        const newTime = prev + 0.1;
        if (onTimeUpdate) {
          onTimeUpdate(newTime);
        }
        return newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, onTimeUpdate]);

  const getYouTubeId = (input: string): string => {
    if (input.length === 11 && !input.includes("/")) {
      return input;
    }
    const match = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
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

  if (platform === "youtube") {
    const youtubeId = getYouTubeId(videoId);
    const youtubeUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&start=${Math.floor(currentTime)}`;

    if (Platform.OS === "web") {
      return (
        <View className="w-full bg-black rounded-lg overflow-hidden relative" style={{ aspectRatio: "16/9" }}>
          {isLoading && (
            <View className="absolute inset-0 items-center justify-center bg-black/50 z-10">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          <iframe
            width="100%"
            height="100%"
            src={youtubeUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: "none" }}
            onLoad={() => setIsLoading(false)}
          />
          <View className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2">
            <Text className="text-white text-xs">{formatTime(displayTime)}</Text>
          </View>
        </View>
      );
    } else {
      return (
        <View
          className="w-full bg-surface rounded-lg items-center justify-center border border-border"
          style={{ aspectRatio: "16/9" }}
        >
          <Text className="text-foreground text-center px-4">Player YouTube Sincronizado</Text>
          <Text className="text-muted text-xs mt-2">Tempo: {formatTime(displayTime)}</Text>
          <Text className="text-muted text-xs mt-1">ID: {getYouTubeId(videoId)}</Text>
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
      <Text className="text-foreground text-center px-4">
        {platform === "google-drive" && "Google Drive não suportado"}
        {platform === "netflix" && "Netflix não suportado"}
        {platform === "prime" && "Prime Video não suportado"}
      </Text>
      <Text className="text-muted text-xs mt-2">Tempo sincronizado: {formatTime(displayTime)}</Text>
    </View>
  );
}
