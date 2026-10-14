import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { sanitize, notFound, errorHandler, asyncHandler } from './middleware/core.js';
import { ensureSeeded } from './seed/seed.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import swapRoutes from './routes/swaps.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/users.js';
import imageRoutes from './routes/images.js';
import adminRoutes from './routes/admin.js';
import miscRoutes from './routes/misc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(sanitize);

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'rethread-api', time: new Date().toISOString() }));

  // Lazily connect (and seed demo data on an empty database) — works for long-lived and serverless runtimes.
  app.use(
    '/api',
    asyncHandler(async (_req, _res, next) => {
      await connectDB();
      if (env.autoSeed) await ensureSeeded();
      next();
    })
  );

  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/swaps', swapRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/images', imageRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', miscRoutes);
  app.use('/api', notFound);

  // Single-service deployments (Render / local prod): serve the built React app.
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '7d', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

export default createApp();
