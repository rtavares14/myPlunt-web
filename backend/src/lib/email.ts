import { Resend } from 'resend';
import { logger } from './logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Plunt <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function send(to: string, subject: string, html: string, text: string) {
  if (!resend) {
    logger.info({ to, subject, text }, 'Email stubbed — RESEND_API_KEY not set');
    return;
  }
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await send(
    to,
    'Verify your Plunt email',
    `<p>Welcome to Plunt! Please confirm your email:</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    `Welcome to Plunt! Verify your email: ${link}\n\nThis link expires in 24 hours.`,
  );
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await send(
    to,
    'Reset your Plunt password',
    `<p>Someone (hopefully you) asked to reset your Plunt password.</p><p><a href="${link}">Set a new password</a></p><p>Link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    `Reset your Plunt password: ${link}\n\nLink expires in 1 hour. If you didn't request this, ignore this email.`,
  );
}

export async function sendPasswordChangedEmail(to: string) {
  const resetLink = `${FRONTEND_URL}/forgot-password`;
  const when = new Date().toUTCString();
  await send(
    to,
    'Your Plunt password was changed',
    `<p>Your Plunt password was just changed (${when}).</p><p>If this wasn't you, <a href="${resetLink}">reset your password immediately</a> — your other sessions have already been signed out as a precaution.</p>`,
    `Your Plunt password was just changed (${when}).\n\nIf this wasn't you, reset your password immediately at ${resetLink}. Your other sessions have already been signed out as a precaution.`,
  );
}
