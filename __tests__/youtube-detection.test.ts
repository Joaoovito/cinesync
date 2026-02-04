import { describe, it, expect } from "vitest";

// Função de extração do YouTube (copiada do componente)
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

// Função de detecção de plataforma (copiada do componente create-room)
function detectPlatform(url: string): string | null {
  if (!url) return null;
  
  // YouTube
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  }
  
  // Google Drive
  if (url.includes("drive.google.com")) {
    return "google-drive";
  }
  
  // URL direta
  if (url.match(/\.(mp4|webm|mov|m3u8|mkv|avi)(\?|$)/i) || url.startsWith("http")) {
    return "direct";
  }
  
  return null;
}

describe("YouTube URL Detection", () => {
  describe("extractYouTubeId", () => {
    it("should extract ID from standard youtube.com/watch URL", () => {
      const url = "https://www.youtube.com/watch?v=6XfWZNh6lpk";
      expect(extractYouTubeId(url)).toBe("6XfWZNh6lpk");
    });

    it("should extract ID from youtube.com/watch URL with extra params", () => {
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";
      expect(extractYouTubeId(url)).toBe("dQw4w9WgXcQ");
    });

    it("should extract ID from youtu.be short URL", () => {
      const url = "https://youtu.be/6XfWZNh6lpk";
      expect(extractYouTubeId(url)).toBe("6XfWZNh6lpk");
    });

    it("should extract ID from youtu.be URL with params", () => {
      const url = "https://youtu.be/6XfWZNh6lpk?t=120";
      expect(extractYouTubeId(url)).toBe("6XfWZNh6lpk");
    });

    it("should extract ID from embed URL", () => {
      const url = "https://www.youtube.com/embed/6XfWZNh6lpk";
      expect(extractYouTubeId(url)).toBe("6XfWZNh6lpk");
    });

    it("should extract ID from v/ URL", () => {
      const url = "https://www.youtube.com/v/6XfWZNh6lpk";
      expect(extractYouTubeId(url)).toBe("6XfWZNh6lpk");
    });

    it("should return the ID if it's already just the ID", () => {
      const id = "6XfWZNh6lpk";
      expect(extractYouTubeId(id)).toBe("6XfWZNh6lpk");
    });

    it("should return null for non-YouTube URLs", () => {
      const url = "https://example.com/video.mp4";
      expect(extractYouTubeId(url)).toBeNull();
    });

    it("should return null for Google Drive URLs", () => {
      const url = "https://drive.google.com/file/d/abc123/view";
      expect(extractYouTubeId(url)).toBeNull();
    });
  });

  describe("detectPlatform", () => {
    it("should detect YouTube from youtube.com URL", () => {
      expect(detectPlatform("https://www.youtube.com/watch?v=6XfWZNh6lpk")).toBe("youtube");
    });

    it("should detect YouTube from youtu.be URL", () => {
      expect(detectPlatform("https://youtu.be/6XfWZNh6lpk")).toBe("youtube");
    });

    it("should detect Google Drive", () => {
      expect(detectPlatform("https://drive.google.com/file/d/abc123/view")).toBe("google-drive");
    });

    it("should detect direct MP4 URL", () => {
      expect(detectPlatform("https://example.com/video.mp4")).toBe("direct");
    });

    it("should detect direct WebM URL", () => {
      expect(detectPlatform("https://example.com/video.webm")).toBe("direct");
    });

    it("should detect direct M3U8 URL", () => {
      expect(detectPlatform("https://example.com/stream.m3u8")).toBe("direct");
    });

    it("should return null for empty string", () => {
      expect(detectPlatform("")).toBeNull();
    });
  });
});
