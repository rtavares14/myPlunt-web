import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { getPrisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  issueTokens,
  revokeSessionByToken,
  rotateSession,
} from '../lib/session';
import { createAuthToken, consumeAuthToken } from '../lib/authTokens';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email';

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
const byIp = (req: Request, res: Response) => ipKeyGenerator(req.ip ?? '', 56);
const byIpAndEmail = (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email) ?? '';
  return `${ipKeyGenerator(req.ip ?? '', 56)}|${email}`;
};

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
  message: { error: 'Too many accounts from this address, try again later.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIpAndEmail,
  message: { error: 'Too many requests, try again later.' },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIp,
  message: { error: 'Too many requests, try again later.' },
});

const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIp,
  message: { error: 'Too many requests, try again later.' },
});

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byIp,
  message: { error: 'Too many requests, try again later.' },
});

class OauthLinkError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

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
  if (byGoogleId) return byGoogleId;

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    // Refuse to auto-link onto a password account — without email verification
    // on our side, anyone could pre-register a victim's email and hijack the account
    // the moment the real owner first uses Google sign-in. The legitimate owner
    // can log in with their password and link Google from their profile.
    if (byEmail.password) {
      throw new OauthLinkError(
        'An account with this email already exists. Please sign in with your password first, then link your Google account.',
      );
    }
    // Email exists without password or Google link (e.g. an Apple-only user).
    // Safe to attach Google here since the only way to have reached this row
    // is by already controlling its previously-verified provider.
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId, avatarUrl: avatarUrl ?? byEmail.avatarUrl },
    });
  }

  return prisma.user.create({
    data: {
      email,
      name,
      username: email.split('@')[0] + '_' + Date.now().toString(36),
      googleId,
      avatarUrl: avatarUrl ?? null,
      emailVerifiedAt: new Date(),
    },
  });
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

    const existing = await getPrisma().user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const existingUsername = await getPrisma().user.findUnique({
      where: { username: normalizedUsername },
    });
    if (existingUsername) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await getPrisma().user.create({
      data: {
        email: normalizedEmail,
        name: trimmedName,
        username: normalizedUsername,
        password: hashedPassword,
      },
    });

    const verificationToken = await createAuthToken(user.id, 'EMAIL_VERIFICATION');
    sendVerificationEmail(user.email, verificationToken).catch((err) =>
      console.error('Failed to send verification email:', err),
    );

    const token = await issueTokens(req, res, user);

    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    console.error('Register error:', error);
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
  } catch (error) {
    console.error('Login error:', error);
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

    const user = await upsertGoogleUser({
      email: normalizedEmail,
      name: payload.name || normalizedEmail.split('@')[0],
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
    });

    const token = await issueTokens(req, res, user);
    res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    if (error instanceof OauthLinkError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Google sign-in error:', error);
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
  } catch (error) {
    console.error('Refresh error:', error);
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
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
        console.error('Failed to send password reset email:', err),
      );
    }

    res.status(204).end();
  } catch (error) {
    console.error('Forgot password error:', error);
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
    await getPrisma().user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke every existing session — if the reset was triggered by an attacker
    // with access to the user's inbox, we don't want their old session to survive.
    await getPrisma().session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.status(204).end();
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Link Google to the currently signed-in account ──────

router.post('/link-google', oauthLimiter, authMiddleware, async (req: Request, res: Response) => {
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
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      res.status(401).json({ error: 'Invalid or unverified Google account' });
      return;
    }

    const currentUserId = req.user!.userId;
    const prisma = getPrisma();

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
  } catch (error) {
    console.error('Link Google error:', error);
    res.status(500).json({ error: 'Failed to link Google account' });
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
  } catch (error) {
    console.error('Logout error:', error);
    clearRefreshCookie(res);
    res.status(204).end();
  }
});

export default router;
