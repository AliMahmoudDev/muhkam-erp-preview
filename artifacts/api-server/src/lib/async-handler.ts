import type { RequestHandler } from "express";

export function wrap(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    (fn(req, res, next) as unknown as Promise<void>).catch((err) => {
      const status = (err as { status?: number })?.status;
      if (!status || status >= 500) {
        // eslint-disable-next-line no-console
        console.error(
          `[route-error] ${req.method} ${req.originalUrl} →`,
          err instanceof Error ? `${err.message}\n${err.stack}` : err,
        );
      }
      next(err);
    });
  };
}

export function httpError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}
