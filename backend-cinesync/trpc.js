const { initTRPC } = require('@trpc/server');
const superjson = require('superjson');

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.create({
  transformer: superjson,
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
module.exports = {
  router: t.router,
  publicProcedure: t.procedure,
};
