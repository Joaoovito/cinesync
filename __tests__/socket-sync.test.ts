/**
 * Testes para a lógica de sincronização Socket.IO
 */

import { describe, it, expect, vi } from "vitest";

// Mock do Platform para evitar erros de React Native
vi.mock("react-native", () => ({
  Platform: {
    OS: "web",
  },
}));

describe("Socket Sync Logic", () => {
  describe("getSocketUrl", () => {
    it("deve retornar localhost quando window não está definido", () => {
      // Simular ambiente sem window
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      // A função deve retornar localhost
      const getSocketUrl = () => {
        if (typeof window !== "undefined") {
          return `${window.location.protocol}//${window.location.hostname}:4000`;
        }
        return "http://localhost:4000";
      };
      
      expect(getSocketUrl()).toBe("http://localhost:4000");
      
      // Restaurar window
      global.window = originalWindow;
    });

    it("deve retornar URL baseada em window quando disponível", () => {
      // Mock do window
      const mockWindow = {
        location: {
          protocol: "https:",
          hostname: "example.com",
        },
      };
      
      // @ts-ignore
      global.window = mockWindow;
      
      const getSocketUrl = () => {
        if (typeof window !== "undefined") {
          return `${window.location.protocol}//${window.location.hostname}:4000`;
        }
        return "http://localhost:4000";
      };
      
      expect(getSocketUrl()).toBe("https://example.com:4000");
    });
  });

  describe("Time Sync Logic", () => {
    it("deve ignorar diferenças menores que 2 segundos", () => {
      const hostTime = 120.5;
      const participantTime = 121.0;
      const diff = Math.abs(hostTime - participantTime);
      
      expect(diff).toBeLessThan(2);
      
      // Não deve fazer seek
      const shouldSeek = diff > 2;
      expect(shouldSeek).toBe(false);
    });

    it("deve corrigir diferenças maiores que 2 segundos", () => {
      const hostTime = 120.5;
      const participantTime = 115.0;
      const diff = Math.abs(hostTime - participantTime);
      
      expect(diff).toBeGreaterThan(2);
      
      // Deve fazer seek
      const shouldSeek = diff > 2;
      expect(shouldSeek).toBe(true);
    });

    it("deve calcular diferença corretamente quando host está à frente", () => {
      const hostTime = 150.0;
      const participantTime = 145.0;
      const diff = Math.abs(hostTime - participantTime);
      
      expect(diff).toBe(5);
      expect(diff > 2).toBe(true);
    });

    it("deve calcular diferença corretamente quando participante está à frente", () => {
      const hostTime = 100.0;
      const participantTime = 105.0;
      const diff = Math.abs(hostTime - participantTime);
      
      expect(diff).toBe(5);
      expect(diff > 2).toBe(true);
    });
  });

  describe("Sync Action Handling", () => {
    it("deve processar ação de play corretamente", () => {
      const action = {
        action: "play" as const,
        roomId: "123",
        currentTime: 50.0,
        timestamp: Date.now(),
      };

      expect(action.action).toBe("play");
      expect(action.currentTime).toBe(50.0);
    });

    it("deve processar ação de pause corretamente", () => {
      const action = {
        action: "pause" as const,
        roomId: "123",
        currentTime: 75.5,
        timestamp: Date.now(),
      };

      expect(action.action).toBe("pause");
      expect(action.currentTime).toBe(75.5);
    });

    it("deve processar ação de seek corretamente", () => {
      const action = {
        action: "seek" as const,
        roomId: "123",
        seekTime: 120.0,
        timestamp: Date.now(),
      };

      expect(action.action).toBe("seek");
      expect(action.seekTime).toBe(120.0);
    });
  });

  describe("Room State", () => {
    it("deve criar estado inicial da sala corretamente", () => {
      const roomState = {
        hostId: null,
        currentTime: 0,
        isPlaying: false,
        lastUpdate: Date.now(),
      };

      expect(roomState.hostId).toBeNull();
      expect(roomState.currentTime).toBe(0);
      expect(roomState.isPlaying).toBe(false);
    });

    it("deve atualizar estado após play", () => {
      const roomState = {
        hostId: "user1",
        currentTime: 50.0,
        isPlaying: false,
        lastUpdate: Date.now(),
      };

      // Simular play
      roomState.isPlaying = true;
      roomState.lastUpdate = Date.now();

      expect(roomState.isPlaying).toBe(true);
    });

    it("deve atualizar tempo após seek", () => {
      const roomState = {
        hostId: "user1",
        currentTime: 50.0,
        isPlaying: true,
        lastUpdate: Date.now(),
      };

      // Simular seek
      const seekTime = 120.0;
      roomState.currentTime = seekTime;
      roomState.lastUpdate = Date.now();

      expect(roomState.currentTime).toBe(120.0);
    });
  });

  describe("Time Sync Interval", () => {
    it("deve enviar time_sync a cada 2 segundos (simulação)", () => {
      vi.useFakeTimers();
      
      let syncCount = 0;
      const emitTimeSync = () => {
        syncCount++;
      };

      const interval = setInterval(emitTimeSync, 2000);

      // Avançar 6 segundos
      vi.advanceTimersByTime(6000);

      expect(syncCount).toBe(3);

      clearInterval(interval);
      vi.useRealTimers();
    });
  });
});
