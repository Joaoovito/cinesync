import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  rooms: router({
    list: publicProcedure.query(async () => {
      return db.getRooms();
    }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getRoomById(input.id);
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          videoTitle: z.string().min(1).max(255),
          platform: z.enum(["youtube", "google-drive", "netflix", "prime", "direct", "url"]),
          videoUrl: z.string().url(),
          videoId: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log("[Router] Creating room with user:", ctx.user.id);
        console.log("[Router] Input:", input);
        return db.createRoom({
          creatorId: ctx.user.id,
          name: input.name,
          videoTitle: input.videoTitle,
          platform: input.platform,
          videoUrl: input.videoUrl,
          videoId: input.videoId,
          currentTime: 0,
          isPlaying: false,
          duration: 0,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const room = await db.getRoomById(input.id);
        if (!room || room.creatorId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        await db.deleteRoom(input.id);
        return { success: true };
      }),

    updateVideoState: protectedProcedure
      .input(
        z.object({
          roomId: z.number(),
          currentTime: z.number().optional(),
          isPlaying: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateVideoSyncState(input.roomId, {
          currentTime: input.currentTime,
          isPlaying: input.isPlaying,
        });
        return { success: true };
      }),

    getVideoState: publicProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        return db.getVideoSyncState(input.roomId);
      }),

    // Evento: Solicitar play (não executa localmente, envia para o servidor)
    playRequest: protectedProcedure
      .input(z.object({ roomId: z.number(), currentTime: z.number() }))
      .mutation(async ({ input }) => {
        // Atualizar estado no banco - todos os clientes vão receber via polling
        await db.updateVideoSyncState(input.roomId, {
          isPlaying: true,
          currentTime: input.currentTime,
        });
        console.log(`[Sync] Play command for room ${input.roomId} at ${input.currentTime}s`);
        return { success: true, command: "play", currentTime: input.currentTime };
      }),

    // Evento: Solicitar pause
    pauseRequest: protectedProcedure
      .input(z.object({ roomId: z.number(), currentTime: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateVideoSyncState(input.roomId, {
          isPlaying: false,
          currentTime: input.currentTime,
        });
        console.log(`[Sync] Pause command for room ${input.roomId} at ${input.currentTime}s`);
        return { success: true, command: "pause", currentTime: input.currentTime };
      }),

    // Evento: Solicitar seek
    seekRequest: protectedProcedure
      .input(z.object({ roomId: z.number(), seekTime: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateVideoSyncState(input.roomId, {
          currentTime: input.seekTime,
        });
        console.log(`[Sync] Seek command for room ${input.roomId} to ${input.seekTime}s`);
        return { success: true, command: "seek", seekTime: input.seekTime };
      }),

    // Time sync do Host - atualiza o tempo atual no servidor
    timeSync: protectedProcedure
      .input(
        z.object({
          roomId: z.number(),
          currentTime: z.number(),
          timestamp: z.number(), // Date.now() do cliente
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verificar se o usuário é o host (criador da sala)
        const room = await db.getRoomById(input.roomId);
        if (!room || room.creatorId !== ctx.user.id) {
          // Apenas o host pode enviar time_sync
          return { success: false, error: "Only host can sync time" };
        }

        // Atualizar tempo no banco
        await db.updateVideoSyncState(input.roomId, {
          currentTime: input.currentTime,
        });

        return {
          success: true,
          hostTime: input.currentTime,
          serverTimestamp: Date.now(),
        };
      }),

    // Obter estado de sincronização com informação do host
    getSyncState: publicProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        const room = await db.getRoomById(input.roomId);
        const syncState = await db.getVideoSyncState(input.roomId);
        
        return {
          ...syncState,
          hostId: room?.creatorId || null,
          serverTimestamp: Date.now(),
        };
      }),
  }),

  participants: router({
    join: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.addParticipant({
          roomId: input.roomId,
          userId: ctx.user.id,
        });
        return { success: true };
      }),

    leave: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.removeParticipant(input.roomId, ctx.user.id);
        return { success: true };
      }),

    list: publicProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        return db.getRoomParticipants(input.roomId);
      }),

    count: publicProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ input }) => {
        return db.getRoomParticipantCount(input.roomId);
      }),
  }),

  chat: router({
    send: protectedProcedure
      .input(
        z.object({
          roomId: z.number(),
          message: z.string().min(1).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.sendMessage({
          roomId: input.roomId,
          userId: ctx.user.id,
          message: input.message,
        });
      }),

    messages: publicProcedure
      .input(
        z.object({
          roomId: z.number(),
          limit: z.number().min(1).max(100).default(50),
        })
      )
      .query(async ({ input }) => {
        return db.getRoomMessages(input.roomId, input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
