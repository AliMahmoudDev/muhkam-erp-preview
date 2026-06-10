import './lib/load-env';
import express, { type Express, type ErrorRequestHandler } from 'express';

import http from 'http';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import router from './routes';
import zktecoRouter from './routes/zkteco';
import { swaggerSpec } from './lib/swagger-spec';
import { logger } from './lib/logger';
import { sanitizeBody } from './middleware/auth';
import { makeRateLimitStore } from './lib/rate-limit-store';
import {
  recordRequest,
  incrementActiveConnections,
  decrementActiveConnections,
  normalizePath,
} from './lib/request-counter';
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  activeConnectionsGauge,
  requestCountTotal,
  responseTimeSummary,
  errorCountTotal,
  updateLiveGauges,
} from './lib/prom-metrics';
import { alertManager, ALERT_TYPES } from './lib/telegram-alert-manager';
import { captureException } from './lib/sentry';
import { requestTimeout } from './middleware/request-timeout';
import { perTenantRateLimit } from './middleware/per-tenant-rate-limit';
import { requestId } from './middleware/request-id';
import { csrfProtection } from './middleware/csrf';

const app: Express = express();

/* ── Trust proxy (Replit runs behind a reverse proxy) ───────── */
app.set('trust proxy', 1);

/* ── Request ID — first middleware so every log line carries it ── */
app.use(requestId);

/* ── Security headers ──────────────────────────────────────── */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    noSniff: true,
  })
);

/* ── Additional security headers ────────────────────────────── */
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.removeHeader('X-Powered-By');
  next();
});

/* ── CORS — allow same-origin / configured domain only ────── */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (IS_PRODUCTION && allowedOrigins.length === 0) {
  logger.error(
    '[SECURITY] ALLOWED_ORIGINS is not set in production — CORS will reject all cross-origin requests. ' +
      'Set ALLOWED_ORIGINS to your domain(s) to allow legitimate traffic.'
  );
}

app.use(
  cors({
    origin: (origin, cb) => {
      /* allow server-to-server (no Origin header) */
      if (!origin) {
        cb(null, true);
        return;
      }
      /* In production: require explicit whitelist (fail-closed) */
      if (IS_PRODUCTION) {
        if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          logger.warn({ origin }, '[CORS] Blocked request from disallowed origin');
          cb(null, false);
        }
        return;
      }
      /* In development/test: allow all origins for convenience */
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        logger.warn({ origin }, '[CORS] Blocked request from disallowed origin');
        cb(null, false);
      }
    },
    credentials: true,
  })
);

/* ── General rate limiter: 100 req/min per IP ─────────────── */
const IN_TEST = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const LOAD_TEST_MODE =
  process.env.LOAD_TEST_MODE === '1' || (process.env.NODE_ENV !== 'production' && !IN_TEST);
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: LOAD_TEST_MODE ? 1_000_000 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeRateLimitStore('rl:gen:'),
  message: { error: 'تجاوزت حد الطلبات، حاول مجدداً بعد دقيقة' },
});

/* ── Auth rate limiter: 10 req/min per IP ──────────────────── */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: LOAD_TEST_MODE ? 1_000_000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeRateLimitStore('rl:auth:'),
  message: { error: 'تجاوزت محاولات تسجيل الدخول، حاول مجدداً بعد دقيقة' },
});

/* ── Super-admin rate limiter: 30 req/min per IP ───────────── */
const superAdminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: LOAD_TEST_MODE ? 1_000_000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeRateLimitStore('rl:super:'),
  message: {
    error: 'طلبات كثيرة جداً على عمليات المشرف العام — يرجى الانتظار قليلاً ثم المحاولة مرة أخرى',
  },
});

/* ── Compression: gzip responses > 1kb ─────────────────────── */
app.use(compression({ level: 6, threshold: 1024 }));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split('?')[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

/* ── Larger body limit for system restore (must come BEFORE the global parser) ── */
/* Restore accepts EITHER plaintext JSON OR encrypted binary (MUHKAM-encrypted
   backup). Use raw byte parser; route handler will detect format and parse. */
app.use('/api/system/restore', express.raw({ type: '*/*', limit: '60mb' }));

/* ── Body parsing with 10mb limit ──────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
/* ── ZKTeco ADMS pushes plain-text attendance logs ─────────── */
app.use('/iclock', express.text({ type: '*/*', limit: '1mb' }));

/* ── Cookie parser ──────────────────────────────────────────── */
app.use(cookieParser());

/* ── XSS sanitization on all request bodies ────────────────── */
app.use(sanitizeBody);

/* ── HTTP Parameter Pollution prevention ───────────────────── */
app.use(hpp());

/* ── CSRF protection (double-submit cookie) ────────────────── */
app.use(csrfProtection);

/* ── Request timeout: abort after 30 s ─────────────────────── */
app.use(requestTimeout);

/* ── Request metrics collector ──────────────────────────────── */
app.use((req, res, next) => {
  incrementActiveConnections();
  activeConnectionsGauge.inc();
  const start = Date.now();
  res.on('finish', () => {
    decrementActiveConnections();
    activeConnectionsGauge.dec();

    const durationMs = Date.now() - start;
    const routeKey = `${req.method} ${normalizePath(req.path)}`;
    const normalRoute = normalizePath(req.path);

    /* hand-rolled counters (keep for JSON endpoint) */
    recordRequest(res.statusCode, durationMs, routeKey);

    /* prom-client — standard metrics */
    httpRequestsTotal.labels(req.method, normalRoute, String(res.statusCode)).inc();
    httpRequestDurationSeconds.labels(req.method, normalRoute).observe(durationMs / 1000);

    /* prom-client — legacy aliases */
    requestCountTotal.inc();
    responseTimeSummary.observe(durationMs);
    if (res.statusCode >= 400) errorCountTotal.inc();

    updateLiveGauges();
  });
  next();
});

/* ── Slow API response alert (> 3000ms) ─────────────────────── */
const SLOW_THRESHOLD_MS = 3000;
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    if (responseTime > SLOW_THRESHOLD_MS) {
      const companyId = (req.headers['x-company-id'] as string | undefined) ?? 'غير معروف';
      void alertManager.send({
        type: ALERT_TYPES.SERVER_SLOW,
        message: `⚠️ *استجابة بطيئة*\nالمسار: ${req.method} ${req.path}\nالوقت: ${responseTime}ms\nالشركة: ${companyId}`,
        cooldownHours: 4,
      });
    }
  });
  next();
});

/* ── Dev-only reverse proxy: /erp-mobile/* → Metro (8082), /__mockup/* → Vite (8083) ── */
if (process.env.NODE_ENV !== 'production') {
  const DEV_PROXIES: Array<{ prefix: string; target: number; strip: boolean }> = [
    { prefix: '/erp-mobile', target: 8082, strip: true },
    { prefix: '/__mockup', target: 8083, strip: false },
  ];

  for (const { prefix, target, strip } of DEV_PROXIES) {
    app.use(prefix, (req, res) => {
      const targetPath = strip ? req.url || '/' : `${prefix}${req.url || '/'}`;
      const opts: http.RequestOptions = {
        hostname: '127.0.0.1',
        port: target,
        path: targetPath,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${target}` },
      };
      const proxyReq = http.request(opts, (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });
      proxyReq.on('error', () => {
        if (!res.headersSent) res.status(502).end('Dev service not ready — please wait');
      });
      req.pipe(proxyReq, { end: true });
    });
  }
}

/* Apply general limiter to all API routes */
app.use('/api', generalLimiter);

/* ── Swagger UI — accessible at /api/docs ────────────────────── */
app.use('/api/docs', swaggerUi.serve);
app.get(
  '/api/docs',
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'مُحكم - MUHKAM ERP — API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
  })
);
app.get('/api/docs/spec.json', (_req, res) => res.json(swaggerSpec));

/* Apply stricter limiter to auth routes */
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login/email', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/2fa/login', authLimiter);

/* ── Super-admin rate limiting (stricter for privileged operations) ── */
app.use('/api/super', superAdminLimiter);

/* ── Per-tenant rate limiting (after auth routes) ─────────── */
app.use('/api', perTenantRateLimit);

/* ── ZKTeco routes — mounted directly (NOT under /api) so that:
   - /iclock/getrequest and /iclock/cdata are reachable by ZKTeco devices
   - /api/attendance/zkteco resolves at the correct path without double prefix
   Authentication is handled inside the router via per-company API keys. ── */
app.use(zktecoRouter);

app.use('/api', router);

/* ── Production: serve React frontend static files ─────────────────────────
   Single unified frontend served from Express backend:
   • MuhKam ERP → /* (artifacts/erp-system/dist/public)
   Features (accounting, etc.) are controlled per-company via edition field.
   ────────────────────────────────────────────────────────────────────────── */
if (process.env.NODE_ENV === 'production') {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  const frontendDist =
    process.env.FRONTEND_DIST || path.resolve(currentDir, '../../erp-system/dist/public');

  const staticOpts = {
    maxAge: '7d',
    etag: true,
    lastModified: true,
    setHeaders: (res: import('http').ServerResponse, filePath: string) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  };

  app.use(express.static(frontendDist, staticOpts));
  const knownScannerPathPattern =
    /^\/(?:lander(?:\/|$)|sber(?:\/|$)|sberbank(?:[-/]|$)|sberchat|tink_chat(?:\/|$)|fckeditor(?:\/|$)|developmentserver(?:\/|$)|src\/FileUpload\.js$|wp(?:[-/]|$)|wordpress(?:\/|$)|xmlrpc\.php$|phpmyadmin(?:\/|$))/i;

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const probePath = (req.originalUrl || req.url || req.path).split('?')[0].replace(/^\/+/, '/');

    if (
      knownScannerPathPattern.test(probePath) ||
      /\/(?:wp-includes|wp-content|wp-admin)\//i.test(probePath) ||
      /\/xmlrpc\.php$/i.test(probePath)
    ) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }

    next();
  });

  /* SPA fallback */
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) return next();

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(404).type('text/plain').send('Not found');
      return;
    }

    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  logger.info({ frontendDist }, 'Serving MuhKam ERP frontend at /');
}

/* ── Global error handler — no stack traces in responses ───── */
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error({ err }, 'Unhandled route error');

  /* Zod validation errors (thrown via schema.parse()) */
  if (err?.name === 'ZodError') {
    res.status(400).json({
      error: 'بيانات غير صحيحة',
      details: (err.errors as Array<{ message: string }>).map((e) => e.message),
    });
    return;
  }

  /* JWT errors */
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' });
    return;
  }

  /* PostgreSQL unique-constraint / FK violation */
  if (typeof err?.code === 'string' && err.code.startsWith('23')) {
    res.status(409).json({ error: 'البيانات موجودة مسبقاً أو يوجد تعارض في البيانات' });
    return;
  }

  /* Fallback: generic error — hide internals in production */
  const status: number =
    typeof (err as Record<string, unknown>).status === 'number'
      ? ((err as Record<string, unknown>).status as number)
      : typeof (err as Record<string, unknown>).statusCode === 'number'
        ? ((err as Record<string, unknown>).statusCode as number)
        : 500;
  if (status >= 500) {
    captureException(err, {
      method: _req.method,
      path: _req.originalUrl,
      status,
    });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const message: string =
    status < 500 && err instanceof Error ? err.message : 'خطأ داخلي في الخادم';
  res.status(status).json({
    error: message,
    ...(isDev && status >= 500 && err instanceof Error ? { details: err.message } : {}),
  });
};

app.use(errorHandler);

export default app;
