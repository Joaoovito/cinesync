const { router, publicProcedure } = require('./trpc');

const appRouter = router({
  greeting: publicProcedure.query(() => {
    return 'hello from tRPC!';
  }),
});

/**
 * @typedef {typeof appRouter} AppRouter
 */
module.exports = { 
  appRouter,
};