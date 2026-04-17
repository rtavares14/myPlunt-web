import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const IS_PROD = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  if (IS_PROD) {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('[auth] JWT_SECRET not set — using insecure dev fallback');
}

const JWT_SECRET = process.env.JWT_SECRET || 'plunt-dev-secret';

export interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
