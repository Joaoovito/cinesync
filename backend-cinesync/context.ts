import { type CreateNextContextOptions } from '@trpc/server/adapters/next';

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/v11/context
 */
export async function createHttpContext(opts: CreateNextContextOptions) {
  // for API-response caching see https://trpc.io/docs/v11/caching
  
  return {
    ...opts,
  };
}
