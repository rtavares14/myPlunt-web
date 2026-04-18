import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPrisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const IS_PROD = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  if (IS_PROD) {
    throw new Error('JWT_SECRET must be set in production');
  }
  logger.warn('JWT_SECRET not set — using insecure dev fallback');
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

/**
 * Stacks after authMiddleware. Rejects with 403 if the authenticated user hasn't
 * verified their email yet. Does a fresh DB read so a user who just clicked the
 * verification link doesn't have to wait for their access token to rotate.
 */
export async function requireVerified(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = await getPrisma().user.findUnique({
    where: { id: req.user.userId },
    select: { emailVerifiedAt: true },
  });
  if (!user?.emailVerifiedAt) {
    res.status(403).json({ error: 'Email not verified' });
    return;
  }
  next();
}
