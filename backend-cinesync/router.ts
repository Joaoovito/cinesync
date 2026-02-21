import { router, publicProcedure } from './trpc';

export const appRouter = router({
  greeting: publicProcedure.query(() => {
    return 'hello from tRPC v11!';
  }),
});

export type AppRouter = typeof appRouter;
