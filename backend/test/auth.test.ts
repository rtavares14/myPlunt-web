import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '../src/app';
import { getPrisma } from '../src/lib/prisma';

let app: Express;

beforeAll(() => {
  app = createApp();
});

async function register(overrides: Partial<{ email: string; username: string; password: string; name: string }> = {}) {
  const body = {
    email: overrides.email ?? `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`,
    username: overrides.username ?? `u${Math.random().toString(36).slice(2, 10)}`,
    name: overrides.name ?? 'Test User',
    password: overrides.password ?? 'correct-horse-battery-staple',
  };
  const res = await request(app).post('/api/auth/register').send(body);
  return { res, body };
}

describe('POST /api/auth/register', () => {
  it('creates a user, sets a refresh cookie, and returns an access token', async () => {
    const { res, body } = await register();

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({
      email: body.email,
      name: body.name,
      hasPassword: true,
      hasGoogleLink: false,
      emailVerified: false,
    });

    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    expect(cookies.some((c) => c && c.startsWith('plunt_refresh='))).toBe(true);
  });

  it('rejects duplicate emails with 409', async () => {
    const email = `dup_${Date.now()}@example.com`;
    const first = await register({ email });
    expect(first.res.status).toBe(201);
    const second = await register({ email });
    expect(second.res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 for a wrong password', async () => {
    const { body } = await register();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: body.email, password: 'not-the-right-one' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns the same 401 shape for an unknown email (no enumeration leak)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `ghost_${Date.now()}@example.com`, password: 'whatever-1234' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('succeeds with the correct password and issues a new refresh cookie', async () => {
    const { body } = await register();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: body.email, password: body.password });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith('plunt_refresh='))).toBe(true);
  });

  it('rate-limits after 5 failed attempts for the same email', async () => {
    const { body } = await register({ email: `limit_${Date.now()}@example.com` });
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ email: body.email, password: 'wrong-password' });
      expect(r.status).toBe(401);
    }
    const sixth = await request(app)
      .post('/api/auth/login')
      .send({ email: body.email, password: 'wrong-password' });
    expect(sixth.status).toBe(429);
  });
});

function extractRefreshCookie(res: request.Response): string {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = raw.find((c) => c.startsWith('plunt_refresh='));
  if (!cookie) throw new Error('No refresh cookie on response');
  return cookie.split(';')[0];
}

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and returns a new access token', async () => {
    const reg = await register();
    const oldCookie = extractRefreshCookie(reg.res);

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(refreshed.status).toBe(200);
    expect(typeof refreshed.body.token).toBe('string');

    const newCookie = extractRefreshCookie(refreshed);
    expect(newCookie).not.toBe(oldCookie);

    // Presenting the original (now-revoked) cookie must fail.
    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(reuse.status).toBe(401);
  });

  it('reuse detection revokes all live sessions for the user', async () => {
    const reg = await register();
    const userId = reg.res.body.user.id;
    const originalCookie = extractRefreshCookie(reg.res);

    // Log in a second time to create a second live session.
    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: reg.body.email, password: reg.body.password });
    expect(second.status).toBe(200);

    // Rotate the original session once — this revokes it cleanly.
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(rotated.status).toBe(200);

    // Present the already-revoked original cookie → should trip reuse detection
    // and nuke every live session for this user.
    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(reuse.status).toBe(401);

    const live = await getPrisma().session.count({
      where: { userId, revokedAt: null },
    });
    expect(live).toBe(0);
  });
});

describe('GET /api/auth/sessions', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/auth/sessions');
    expect(res.status).toBe(401);
  });

  it('lists the current user\'s live sessions and flags the current one', async () => {
    const reg = await register();
    const token: string = reg.res.body.token;

    const res = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBe(1);
    expect(res.body.sessions[0].isCurrent).toBe(true);
  });
});
