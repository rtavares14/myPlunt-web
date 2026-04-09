import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../lib/prisma';
import { generateToken } from '../middleware/auth';

const router = Router();

// ─── Register (email + password) ─────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      res.status(400).json({ error: 'Email, name, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await getPrisma().user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await getPrisma().user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        authProvider: 'LOCAL',
      },
    });

    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Login (email + password) ────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await getPrisma().user.findUnique({ where: { email } });

    if (!user || !user.password) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── OAuth login/register (Google, Apple) ────────────────

router.post('/oauth', async (req: Request, res: Response) => {
  try {
    const { email, name, provider, providerId, avatarUrl } = req.body;

    if (!email || !name || !provider || !providerId) {
      res.status(400).json({ error: 'Email, name, provider, and providerId are required' });
      return;
    }

    if (!['GOOGLE', 'APPLE'].includes(provider)) {
      res.status(400).json({ error: 'Provider must be GOOGLE or APPLE' });
      return;
    }

    // Find existing user by email or create new one
    let user = await getPrisma().user.findUnique({ where: { email } });

    if (user) {
      // Update provider info if not already set
      if (!user.providerId) {
        user = await getPrisma().user.update({
          where: { id: user.id },
          data: { authProvider: provider, providerId, avatarUrl: avatarUrl || user.avatarUrl },
        });
      }
    } else {
      user = await getPrisma().user.create({
        data: {
          email,
          name,
          authProvider: provider,
          providerId,
          avatarUrl,
        },
      });
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    });
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
