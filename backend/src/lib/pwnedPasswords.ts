import crypto from 'crypto';
import { logger } from './logger';

/**
 * Check a password against the Have I Been Pwned breach database using the
 * k-anonymity API: we send the first 5 chars of its SHA-1, they return every
 * full hash with that prefix, we match locally. The password itself never
 * leaves the server.
 *
 * Returns true only when we have a confident "pwned" answer. Network/HTTP
 * failures fail open (return false) — a temporary HIBP outage shouldn't block
 * real registrations. The tradeoff is worth it for a friend-scale beta.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Plunt-Auth' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'HIBP range lookup returned non-2xx');
      return false;
    }
    const text = await res.text();
    for (const line of text.split('\n')) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix && hashSuffix.trim().toUpperCase() === suffix) return true;
    }
    return false;
  } catch (err) {
    logger.warn({ err }, 'HIBP range lookup failed');
    return false;
  }
}
