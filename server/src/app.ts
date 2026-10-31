import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { prisma } from './config/prisma';
import { env } from './config/env';
import { attachAuth } from './middleware/auth';
import { csrfProtect } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/error';
import { limits } from './middleware/rateLimit';
import { LOCAL_UPLOAD_DIR, storageAvailable } from './services/storage.service';
import { clearOutbox, getOutbox } from './services/email.service';
import { logger } from './utils/logger';
import { ok } from './utils/http';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';
import { itemRouter } from './modules/items/item.routes';
import { categoryRouter } from './modules/categories/category.routes';
import { favoriteRouter } from './modules/favorites/favorite.routes';
import { requestRouter } from './modules/requests/request.routes';
import { transactionRouter } from './modules/transactions/transaction.routes';
import { conversationRouter } from './modules/conversations/conversation.routes';
import { notificationRouter } from './modules/notifications/notification.routes';
import { adminRouter, reportRouter } from './modules/reports/report.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Render/Vercel sit behind a proxy: needed for correct client IPs (rate limiting) and secure cookies.
  app.set('trust proxy', (env.TRUST_PROXY ?? env.isProd) ? 1 : false);

  app.use(pinoHttp({ logger, autoLogging: !env.isTest, redact: ['req.headers.cookie', 'req.headers.authorization'] }));
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // images served to the SPA on another origin
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin/non-browser requests send no Origin. Browsers must match the single configured client.
        if (!origin || origin === new URL(env.CLIENT_URL).origin) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(limits.global);

  if (env.STORAGE_PROVIDER === 'local' && !env.isProd) {
    app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { fallthrough: true, index: false }));
  }

  const api = Router();
  api.get('/health', (_req, res) => ok(res, { status: 'ok', uptime: Math.round(process.uptime()) }));
  api.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      ok(res, { status: 'ready', database: 'up', storage: storageAvailable() ? 'configured' : 'not_configured', email: env.smtpConfigured ? 'configured' : 'not_configured' });
    } catch {
      res.status(503).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Service is not ready.' } });
    }
  });

  api.use(attachAuth);
  api.use(csrfProtect);

  // Test-only email outbox (never mounted in production).
  if (!env.isProd && (env.isTest || process.env.ENABLE_TEST_ENDPOINTS === 'true')) {
    api.get('/__test/outbox', (req, res) => {
      const to = typeof req.query.to === 'string' ? req.query.to.toLowerCase() : null;
      ok(res, getOutbox().filter((m) => !to || m.to.toLowerCase() === to));
    });
    api.post('/__test/outbox/clear', (_req, res) => {
      clearOutbox();
      res.status(204).end();
    });
  }

  api.use('/auth', authRouter);
  api.use('/users', userRouter);
  api.use('/items', itemRouter);
  api.use('/categories', categoryRouter);
  api.use('/favorites', favoriteRouter);
  api.use('/requests', requestRouter);
  api.use('/transactions', transactionRouter);
  api.use('/conversations', conversationRouter);
  api.use('/notifications', notificationRouter);
  api.use('/reports', reportRouter);
  api.use('/admin', adminRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
