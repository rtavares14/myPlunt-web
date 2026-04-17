import crypto from 'crypto';
import type { Request, Response } from 'express';
import { getPrisma } from './prisma';
import { generateToken } from '../middleware/auth';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const IS_PROD = process.env.NODE_ENV === 'production';

export const REFRESH_COOKIE_NAME = 'plunt_refresh';

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function requestMeta(req: Request) {
  return {
    userAgent: req.get('user-agent') ?? null,
    ip: req.ip ?? null,
  };
}

async function createSession(req: Request, userId: string): Promise<string> {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const { userAgent, ip } = requestMeta(req);
  await getPrisma().session.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(token),
      userAgent,
      ip,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return token;
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

export async function issueTokens(
  req: Request,
  res: Response,
  user: { id: string; email: string },
): Promise<string> {
  const refreshToken = await createSession(req, user.id);
  setRefreshCookie(res, refreshToken);
  return generateToken({ userId: user.id, email: user.email });
}

/**
 * Rotate the current refresh token: revoke the old session row and issue a new one.
 * Returns a fresh access token. Returns null if the refresh token is unknown,
 * revoked, or expired (caller should clear the cookie and 401).
 */
export async function rotateSession(
  req: Request,
  res: Response,
  presentedToken: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashRefreshToken(presentedToken) },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(req, res, session.user);
}

export async function revokeSessionByToken(presentedToken: string): Promise<void> {
  await getPrisma().session.updateMany({
    where: { refreshTokenHash: hashRefreshToken(presentedToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
