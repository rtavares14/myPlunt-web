import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPrisma } from '../lib/prisma';
import { Prisma } from '../generated/prisma/client';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const waitlistLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many signups — please try again in a minute' },
});

router.post('/', waitlistLimiter, async (req, res) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
  const email = rawEmail.trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    await getPrisma().waitlistEntry.create({ data: { email } });
    return res.status(201).json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(200).json({ ok: true, alreadyRegistered: true });
    }
    req.log.error({ err }, 'waitlist signup failed');
    return res.status(500).json({ error: 'Could not save signup' });
  }
});

export default router;
