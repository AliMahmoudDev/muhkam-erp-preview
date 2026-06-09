import * as Sentry from '@sentry/node';
import { logger } from './logger';

const dsn = process.env.SENTRY_DSN?.trim();

export const sentryEnabled = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  });

  logger.info('[Sentry] backend error tracking enabled');
}

export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  Sentry.captureException(err, { extra });
}

export { Sentry };
