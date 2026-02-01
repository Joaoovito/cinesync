import { View, Text, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface VideoPlayerProps {
  videoId: string;
  platform: string;
  title: string;
  isPlaying?: boolean;
  currentTime?: number;
  onPlayPause?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export function VideoPlayer({
  videoId,
  platform,
  title,
  isPlaying = false,
  currentTime = 0,
  onPlayPause,
  onTimeUpdate,
}: VideoPlayerProps) {
  const colors = useColors();

  // Extract YouTube video ID from URL if needed
  const getYouTubeId = (input: string): string => {
    if (input.length === 11 && !input.includes("/")) {
      return input;
    }
    const match = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : input;
  };

  if (platform === "youtube") {
    const youtubeId = getYouTubeId(videoId);
    const youtubeUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1`;

    if (Platform.OS === "web") {
      return (
        <View className="w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <iframe
            width="100%"
            height="100%"
            src={youtubeUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: "none" }}
          />
        </View>
      );
    } else {
      return (
        <View
          className="w-full bg-surface rounded-lg items-center justify-center border border-border"
          style={{ aspectRatio: "16/9" }}
        >
          <Text className="text-foreground text-center px-4">Player YouTube</Text>
          <Text className="text-muted text-xs mt-2">ID: {youtubeId}</Text>
        </View>
      );
    }
  }

  // Fallback for other platforms
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
    </View>
  );
}
