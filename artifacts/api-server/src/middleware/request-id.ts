import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { logger } from '../lib/logger';

/* Extend Express Request so every handler can read req.requestId and req.log */
declare global {
  namespace Express {
    interface Request {
      /** Server-generated UUID v4 for this request — echoed in X-Request-Id header */
      requestId?: string;
      /** Pino child logger bound to { requestId } — use instead of the root logger */
      log?: Logger;
    }
  }
}

/**
 * requestId middleware — must be the very first app.use() call.
 *
 * For every incoming request it:
 *   1. Generates a server-side UUID v4 via crypto.randomUUID()
 *   2. Attaches it to req.requestId so any downstream handler can read it
 *   3. Creates a pino child logger bound to { requestId } and stores it on
 *      req.log so every log line for this request automatically carries the ID
 *      without manual threading
 *   4. Returns it to the caller as the X-Request-Id response header so errors
 *      can be correlated across client logs and server logs
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = crypto.randomUUID();
  req.requestId = id;
  req.log = logger.child({ requestId: id });
  res.setHeader('X-Request-Id', id);
  next();
}
