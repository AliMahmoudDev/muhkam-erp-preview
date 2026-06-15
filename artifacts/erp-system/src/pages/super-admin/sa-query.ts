/**
 * Shared React Query utilities for the Super Admin module.
 *
 * Why this file exists:
 * The SA page fires 6+ queries on mount.  With React Query's default
 * 3-retry behaviour and no HTTP-status awareness, a single 429 response
 * triggers a self-perpetuating storm (3 retries × ~4 failing queries = 12
 * extra requests) that immediately blows past the `superAdminLimiter` cap
 * and produces more 429s.
 *
 * All super-admin hooks import { saRetry, StatusError } from here so the
 * retry policy is applied consistently in one place.
 */

/**
 * Error that carries the HTTP status code from the response.
 * Lets saRetry (and any UI code) distinguish 429 from 500 from a network error.
 */
export class StatusError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'StatusError';
    this.status = status;
  }
}

/**
 * React Query `retry` callback for super-admin queries.
 *
 * Rules:
 * - 401  expired session — no retry, let auth context handle redirect.
 * - 403  forbidden        — no retry, role mismatch.
 * - 429  rate-limited     — no retry; retrying makes the storm worse.
 * - everything else       — at most ONE retry to handle transient DB/network blips.
 *
 * Usage:  `retry: saRetry` in any useQuery inside the super-admin module.
 */
export function saRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: number }).status;
  if (status === 401 || status === 403 || status === 429) return false;
  return failureCount < 1;
}
