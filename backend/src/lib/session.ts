import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { UserModel } from '../generated/prisma/models';
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

async function createSession(
  req: Request,
  userId: string,
): Promise<{ token: string; sessionId: string }> {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const { userAgent, ip } = requestMeta(req);
  const row = await getPrisma().session.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(token),
      userAgent,
      ip,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return { token, sessionId: row.id };
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
  const { token: refreshToken, sessionId } = await createSession(req, user.id);
  setRefreshCookie(res, refreshToken);
  return generateToken({ userId: user.id, email: user.email, sessionId });
}

/**
 * Rotate the current refresh token: revoke the old session row and issue a new one.
 * Returns { accessToken, user } on success, or null if the refresh token is unknown,
 * revoked, or expired (caller should clear the cookie and 401).
 *
 * If the presented token exists but was already revoked, treat it as a theft signal
 * and revoke every live session for that user.
 */
export async function rotateSession(
  req: Request,
  res: Response,
  presentedToken: string,
): Promise<{ accessToken: string; user: UserModel } | null> {
  const prisma = getPrisma();
  const tokenHash = hashRefreshToken(presentedToken);

  // Atomic-revoke gate: only one concurrent /refresh with the same cookie wins.
  // If two requests race, exactly one updateMany affects 1 row; the other gets 0
  // and is treated like reuse of an already-revoked token.
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) return { kind: 'unknown' as const };

    if (session.revokedAt) {
      await tx.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { kind: 'reuse' as const };
    }

    if (session.expiresAt < new Date()) return { kind: 'expired' as const };

    const revoke = await tx.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoke.count !== 1) return { kind: 'raced' as const };

    return { kind: 'ok' as const, user: session.user };
  });

  if (result.kind !== 'ok') return null;

  const accessToken = await issueTokens(req, res, result.user);
  return { accessToken, user: result.user };
}

export async function revokeSessionByToken(presentedToken: string): Promise<void> {
  await getPrisma().session.updateMany({
    where: { refreshTokenHash: hashRefreshToken(presentedToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
