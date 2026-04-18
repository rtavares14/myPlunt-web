import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import { getPrisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// Railway (and any reverse proxy) terminates TLS at the edge and forwards a single
// hop. Trust exactly one hop so req.ip reflects the real client — trusting `true`
// would let clients forge X-Forwarded-For and bypass the rate limiter.
app.set('trust proxy', 1);

let allowedOrigins: string[];
if (process.env.FRONTEND_URL) {
  allowedOrigins = [process.env.FRONTEND_URL];
} else if (IS_PROD) {
  throw new Error('FRONTEND_URL must be set in production');
} else {
  allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Plunt API is running' });
});

app.use('/api/auth', authRoutes);

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Plunt backend running on http://localhost:${PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received — shutting down`);
  server.close(async () => {
    try {
      await getPrisma().$disconnect();
    } catch (err) {
      console.error('Prisma disconnect error:', err);
    }
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced exit after 10s shutdown timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
