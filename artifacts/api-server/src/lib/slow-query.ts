import { logger } from './logger';

const SLOW_QUERY_MS = 200;

/**
 * Minimal structural type for the subset of pg.Pool needed here.
 * Avoids a direct `pg` import — that package belongs to @workspace/db,
 * not to api-server directly.
 */
interface SlowQueryPool {
  on(
    event: 'connect',
    listener: (client: { query: (...args: unknown[]) => unknown }) => void,
  ): void;
}

/**
 * instrumentSlowQueryLogging
 *
 * Wraps every newly-acquired pg PoolClient so that any query taking longer than
 * SLOW_QUERY_MS (200 ms) is logged at WARN level with the duration and a
 * truncated query string. The original pool and client APIs are untouched from
 * the caller's perspective — this is purely observational.
 *
 * Call once at server startup, before any queries run.
 *
 * Log format:
 *   { durationMs: 347, query: 'SELECT * FROM sales WHERE ...' } [slow-query]
 */
export function instrumentSlowQueryLogging(pool: SlowQueryPool): void {
  pool.on('connect', (client) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = (client.query as (...args: any[]) => any).bind(client);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as { query: (...args: any[]) => any }).query = (...args: any[]): any => {
      const t0 = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = original(...args) as Promise<any>;

      void Promise.resolve(result)
        .then(() => {
          const durationMs = Date.now() - t0;
          if (durationMs > SLOW_QUERY_MS) {
            const raw = args[0];
            const query =
              typeof raw === 'string'
                ? raw
                : (raw as { text?: string })?.text ?? '[unknown]';
            logger.warn({ durationMs, query: query.slice(0, 200) }, '[slow-query]');
          }
        })
        .catch(() => undefined);

      return result;
    };
  });
}
