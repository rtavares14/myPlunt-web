import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Skip benign endpoints that fire on every page load or during normal app use.
// The limiter is really meant to throttle credential guessing + email spam.
const RATE_LIMITED_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/google',
  '/apple',
  '/verify-email',
  '/link-google',
]);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => !RATE_LIMITED_PATHS.has(req.path),
  message: { error: 'Too many requests, please try again later.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Plunt API is running' });
});

app.use('/api/auth', authLimiter, authRoutes);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Plunt backend running on http://localhost:${PORT}`);
});
