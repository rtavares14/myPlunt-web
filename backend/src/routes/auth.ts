import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { getPrisma } from '../lib/prisma';
import { Prisma } from '../generated/prisma/client';
import { authMiddleware, requireVerified } from '../middleware/auth';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  issueTokens,
  revokeSessionByToken,
  rotateSession,
} from '../lib/session';
import { createAuthToken, consumeAuthToken } from '../lib/authTokens';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendWelcomeEmail,
} from '../lib/email';
const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const APPLE_SIGNIN_ENABLED = process.env.APPLE_SIGNIN_ENABLED === 'true';

// Consumed on failed login so response time doesn't reveal account existence.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('plunt-timing-placeholder', 12);

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'api', 'www',
  'mail', 'plunt', 'official', 'moderator', 'staff', 'team', 'me',
]);

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 254 || !trimmed.includes('@')) return null;
  return trimmed;
}

function normalizeUsername(username: unknown): string | null {
  if (typeof username !== 'string') return null;
  const trimmed = username.trim().toLowerCase();
  if (!USERNAME_RE.test(trimmed) || RESERVED_USERNAMES.has(trimmed)) return null;
  return trimmed;
}

// Per-route rate limiters. keyed by IP, or IP+email for credential/email flows.
const byIp = (req: Request, _res: Response) => ipKeyGenerator(req.ip ?? '', 56);
const byIpAndEmail = (req: Request, _res: Response) => {
  const email = normalizeEmail(req.body?.email) ?? '';
  return `${ipKeyGenerator(req.ip ?? '', 56)}|${email}`;
};
// Bypass IP-keyed limiters under test — otherwise register/etc. limits accumulate
// across tests (same localhost IP) and mask real failures. The login limiter is
// excluded below since we explicitly verify the limit behavior.
const skipInTest = () => process.env.NODE_ENV === 'test';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIpAndEmail,
  message: { error: 'Too many login attempts, try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIp,
  skip: skipInTest,
  message: { error: 'Too many accounts from this address, try again later.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIpAndEmail,
  skip: skipInTest,
  message: { error: 'Too many requests, try again later.' },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIp,
  skip: skipInTest,
  message: { error: 'Too many requests, try again later.' },
});

const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIp,
  skip: skipInTest,
  message: { error: 'Too many requests, try again later.' },
});

const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIp,
  skip: skipInTest,
  message: { error: 'Too many requests, try again later.' },
});

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIp,
  skip: skipInTest,
  message: { error: 'Too many requests, try again later.' },
});

function toPublicUser(u: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  password: string | null;
  googleId: string | null;
  appleId: string | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    emailVerified: u.emailVerifiedAt !== null,
    hasPassword: u.password !== null,
    hasGoogleLink: u.googleId !== null,
    hasAppleLink: u.appleId !== null,
  };
}

async function upsertGoogleUser(params: {
  email: string;
  name: string;
  googleId: string;
  avatarUrl?: string | null;
}) {
  const prisma = getPrisma();
  const { email, name, googleId, avatarUrl } = params;

  // Does anyone already own this Google account? If so, that's the user.
  const byGoogleId = await prisma.user.findUnique({ where: { googleId } });
  if (byGoogleId) return { user: byGoogleId, created: false };

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    // Google's `email_verified` already proved the current caller controls this
    // inbox, so attaching Google to the matching row is safe. If the row has a
    // password but was never email-verified, we can't trust that password was
    // set by the real owner (pre-registration hijack vector) — drop it.
    const shouldClearPassword = byEmail.password !== null && byEmail.emailVerifiedAt === null;
    const updated = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId,
        avatarUrl: avatarUrl ?? byEmail.avatarUrl,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        ...(shouldClearPassword ? { password: null } : {}),
      },
    });
    return { user: updated, created: false };
  }

  const created = await prisma.user.create({
    data: {
      email,
      name,
      username: await generateUniqueUsername(email),
      googleId,
      avatarUrl: avatarUrl ?? null,
      emailVerifiedAt: new Date(),
    },
  });
  return { user: created, created: true };
}

async function generateUniqueUsername(email: string): Promise<string> {
  const prisma = getPrisma();
  const localPart = email.split('@')[0] ?? 'user';
  const base = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 12) || 'user';

  // Try the bare base first, then append short random suffixes until a free slot
  // appears. Bounded retries since the namespace is huge and collisions are rare.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      attempt === 0
        ? (base.length >= 3 ? base : `${base}_user`).slice(0, 20)
        : `${base.slice(0, 14)}_${crypto.randomBytes(3).toString('hex')}`;
    if (!USERNAME_RE.test(candidate) || RESERVED_USERNAMES.has(candidate)) continue;
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }
  // Fall back to a fully-random username — vanishingly unlikely to collide.
  return `user_${crypto.randomBytes(6).toString('hex')}`;
}

// ─── Register (email + password) ─────────────────────────

router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const { email, name, username, password } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username);
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedEmail) {
      res.status(400).json({ error: 'A valid email is required' });
      return;
    }
    if (!normalizedUsername) {
      res.status(400).json({
        error: 'Username must be 3–20 characters (letters, numbers, underscore) and not reserved',
      });
      return;
    }
    if (!trimmedName || trimmedName.length > 80) {
      res.status(400).json({ error: 'Name is required (max 80 characters)' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      res.status(400).json({ error: 'Password must be between 8 and 72 characters' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    let user;
    try {
      user = await getPrisma().user.create({
        data: {
          email: normalizedEmail,
          name: trimmedName,
          username: normalizedUsername,
          password: hashedPassword,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target as string[] | undefined) ?? [];
        const field = target.includes('username') ? 'Username already taken' : 'Email already in use';
        res.status(409).json({ error: field });
        return;
      }
      throw err;
    }

    const verificationToken = await createAuthToken(user.id, 'EMAIL_VERIFICATION');
    sendVerificationEmail(user.email, verificationToken).catch((err) =>
      req.log.error({ err }, 'Failed to send verification email'),
    );

    const token = await issueTokens(req, res, user);

    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    req.log.error({ err }, 'Register error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Login (email + password) ────────────────────────────

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const presentedPassword = typeof password === 'string' ? password : '';

    // Always run bcrypt — against the real hash if the user exists, otherwise against
    // a constant dummy hash — so response time doesn't reveal account existence.
    const user = normalizedEmail
      ? await getPrisma().user.findUnique({ where: { email: normalizedEmail } })
      : null;
    const storedHash = user?.password ?? DUMMY_PASSWORD_HASH;
    const valid = await bcrypt.compare(presentedPassword, storedHash);

    if (!normalizedEmail || !presentedPassword) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    if (!user || !user.password || !valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = await issueTokens(req, res, user);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    req.log.error({ err }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Google sign-in ──────────────────────────────────────

router.post('/google', oauthLimiter, async (req: Request, res: Response) => {
  try {
    if (!googleClient) {
      res.status(503).json({ error: 'Google sign-in is not configured on the server' });
      return;
    }

    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ error: 'credential is required' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      res.status(401).json({ error: 'Invalid Google token' });
      return;
    }
    if (!payload.email_verified) {
      res.status(401).json({ error: 'Google account email is not verified' });
      return;
    }

    const normalizedEmail = normalizeEmail(payload.email);
    if (!normalizedEmail) {
      res.status(401).json({ error: 'Google account returned an invalid email' });
      return;
    }

    const { user, created } = await upsertGoogleUser({
      email: normalizedEmail,
      name: payload.name || normalizedEmail.split('@')[0],
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
    });

    if (created) {
      sendWelcomeEmail(user.email, user.name).catch((err) =>
        req.log.error({ err }, 'Failed to send welcome email'),
      );
    }

    const token = await issueTokens(req, res, user);
    res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    req.log.error({ err: error }, 'Google sign-in error');
    res.status(401).json({ error: 'Google sign-in failed' });
  }
});

// ─── Apple sign-in (feature-flagged) ─────────────────────

router.post('/apple', oauthLimiter, async (_req: Request, res: Response) => {
  if (!APPLE_SIGNIN_ENABLED) {
    res.status(501).json({
      error: 'Apple sign-in is not available yet. Requires a paid Apple Developer Program membership.',
    });
    return;
  }
  // Not yet implemented: verify req.body.identityToken against Apple's JWKS
  // (e.g. via `apple-signin-auth` or `jose`), then call upsertOauthUser with provider 'APPLE'.
  res.status(501).json({ error: 'Apple sign-in verification not yet implemented' });
});

// ─── Refresh access token ────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!presented) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rotated = await rotateSession(req, res, presented);
    if (!rotated) {
      clearRefreshCookie(res);
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    res.json({ token: rotated.accessToken, user: toPublicUser(rotated.user) });
  } catch (err) {
    req.log.error({ err }, 'Refresh error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Email verification ──────────────────────────────────

router.post('/verify-email', verifyEmailLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    const userId = await consumeAuthToken(token, 'EMAIL_VERIFICATION');
    if (!userId) {
      res.status(400).json({ error: 'Invalid or expired verification link' });
      return;
    }

    await getPrisma().user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, 'Verify email error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Resend verification email ───────────────────────────

router.post(
  '/resend-verification',
  resendVerificationLimiter,
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const user = await getPrisma().user.findUnique({
        where: { id: req.user!.userId },
      });

      // Silently no-op if already verified — a button on the profile shouldn't
      // leak timing differences based on current state.
      if (!user || user.emailVerifiedAt) {
        res.status(204).end();
        return;
      }

      const token = await createAuthToken(user.id, 'EMAIL_VERIFICATION');
      sendVerificationEmail(user.email, token).catch((err) =>
        req.log.error({ err }, 'Failed to send verification email'),
      );

      res.status(204).end();
    } catch (err) {
      req.log.error({ err }, 'Resend verification error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ─── Password reset ──────────────────────────────────────

router.post('/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail) {
      // Same 204 as the success path to preserve enumeration-safety.
      res.status(204).end();
      return;
    }

    const user = await getPrisma().user.findUnique({ where: { email: normalizedEmail } });
    // Only send the email if the user exists and has a password to reset.
    // Always return 204 either way to prevent user enumeration.
    if (user?.password) {
      const token = await createAuthToken(user.id, 'PASSWORD_RESET');
      sendPasswordResetEmail(user.email, token).catch((err) =>
        req.log.error({ err }, 'Failed to send password reset email'),
      );
    }

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, 'Forgot password error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password', resetPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({ error: 'token and password are required' });
      return;
    }
    if (password.length < 8 || password.length > 72) {
      res.status(400).json({ error: 'Password must be between 8 and 72 characters' });
      return;
    }

    const userId = await consumeAuthToken(token, 'PASSWORD_RESET');
    if (!userId) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const updated = await getPrisma().user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke every existing session — if the reset was triggered by an attacker
    // with access to the user's inbox, we don't want their old session to survive.
    await getPrisma().session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Let the legitimate owner notice if they didn't trigger this.
    sendPasswordChangedEmail(updated.email).catch((err) =>
      req.log.error({ err }, 'Failed to send password-changed email'),
    );

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, 'Reset password error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Link Google to the currently signed-in account ──────

router.post('/link-google', oauthLimiter, authMiddleware, requireVerified, async (req: Request, res: Response) => {
  try {
    if (!googleClient) {
      res.status(503).json({ error: 'Google sign-in is not configured on the server' });
      return;
    }

    const { credential, currentPassword } = req.body;
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ error: 'credential is required' });
      return;
    }
    if (typeof currentPassword !== 'string' || !currentPassword) {
      res.status(400).json({ error: 'currentPassword is required' });
      return;
    }

    const currentUserId = req.user!.userId;
    const prisma = getPrisma();
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });

    // Step-up: a stolen access token shouldn't be enough to attach an attacker's
    // Google account onto the victim. Require the password to re-verify intent.
    // Run bcrypt against DUMMY_PASSWORD_HASH when no password is set so response
    // time doesn't distinguish "no password" from "wrong password".
    const storedHash = currentUser?.password ?? DUMMY_PASSWORD_HASH;
    const passwordValid = await bcrypt.compare(currentPassword, storedHash);
    if (!currentUser || !currentUser.password || !passwordValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      res.status(401).json({ error: 'Invalid or unverified Google account' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (existing && existing.id !== currentUserId) {
      res.status(409).json({ error: 'This Google account is already linked to another user' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: currentUserId },
      data: {
        googleId: payload.sub,
        avatarUrl: payload.picture ?? undefined,
      },
    });

    res.json({ user: toPublicUser(updated) });
  } catch (err) {
    req.log.error({ err }, 'Link Google error');
    res.status(500).json({ error: 'Failed to link Google account' });
  }
});

// ─── Sessions management ─────────────────────────────────

router.get('/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = await getPrisma().session.findMany({
      where: {
        userId: req.user!.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });
    const currentId = req.user!.sessionId;
    res.json({
      sessions: rows.map((r) => ({ ...r, isCurrent: r.id === currentId })),
    });
  } catch (err) {
    req.log.error({ err }, 'List sessions error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/sessions/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.user!.userId;
    if (typeof id !== 'string' || !id) {
      res.status(400).json({ error: 'Invalid session id' });
      return;
    }

    const result = await getPrisma().session.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // If the user revoked the session they're currently on, also clear the cookie.
    if (id === req.user!.sessionId) {
      clearRefreshCookie(res);
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, 'Revoke session error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const keepCurrent = req.body?.keepCurrent !== false; // default true
    const userId = req.user!.userId;
    const currentId = req.user!.sessionId;

    await getPrisma().session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepCurrent ? { NOT: { id: currentId } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    if (!keepCurrent) clearRefreshCookie(res);
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, 'Logout-all error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Logout ──────────────────────────────────────────────

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME];
    if (presented) {
      await revokeSessionByToken(presented);
    }
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, 'Logout error');
    clearRefreshCookie(res);
    res.status(204).end();
  }
});

export default router;
