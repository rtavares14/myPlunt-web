import crypto from 'crypto';
import { getPrisma } from './prisma';

type TokenPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

const TTL_MS: Record<TokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24h
  PASSWORD_RESET: 60 * 60 * 1000, // 1h
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createAuthToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const prisma = getPrisma();

  // Invalidate any existing unused tokens of the same purpose for this user —
  // a new "forgot password" request should supersede any outstanding one.
  await prisma.authToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.authToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      purpose,
      expiresAt: new Date(Date.now() + TTL_MS[purpose]),
    },
  });

  return token;
}

/**
 * Verify a plaintext token, mark it used, and return the associated userId.
 * Returns null if the token is unknown, already used, or expired.
 */
export async function consumeAuthToken(
  token: string,
  purpose: TokenPurpose,
): Promise<string | null> {
  const prisma = getPrisma();
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) {
    return null;
  }

  await prisma.authToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return row.userId;
}
