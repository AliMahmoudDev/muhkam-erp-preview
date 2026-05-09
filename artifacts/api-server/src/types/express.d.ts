/**
 * express.d.ts — Global Express Request type augmentation (single source of truth).
 *
 * Centralises every property that middleware attaches to req so TypeScript
 * knows about them throughout the codebase without !-assertions.
 *
 * Rules:
 *  - Add req properties HERE, never in individual middleware files.
 *  - Locals that reference local types (e.g. PinnedClient) stay in auth.ts.
 */

import type { AuthUser } from '../middleware/auth';
import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user — set by `authenticate` middleware */
      user?: AuthUser;
      /** Convenience alias for user.role — set by `authenticate` */
      role?: string;
      /** Tenant company ID — set by `authenticate`; use getTenant(req) to read it */
      companyId?: number | null;
      /** Server-generated UUID v4 echoed in X-Request-Id — set by requestId middleware */
      requestId?: string;
      /** Pino child logger bound to { requestId } — set by requestId middleware */
      log?: Logger;
    }
  }
}

export {};
