import crypto from 'crypto';
import { NextResponse } from 'next/server';

// Session token format: userId.timestamp.hmac
// Uses HMAC-SHA256 with a server secret to prevent forgery

const SESSION_COOKIE_NAME = 'bv_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production');
    }
    // Dev-only fallback — DO NOT use in production
    console.warn('[AUTH] WARNING: Using default SESSION_SECRET. Set SESSION_SECRET env var for production!');
    return 'dev-only-secret-change-me-in-prod';
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }
  return secret;
}

function hmacSign(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
}

export function createSessionToken(userId: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${userId}.${timestamp}`;
  const signature = hmacSign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [userId, timestamp, signature] = parts;
  if (!userId || !timestamp || !signature) return null;

  // Verify signature
  const payload = `${userId}.${timestamp}`;
  const expectedSig = hmacSign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  // Check expiration
  const created = parseInt(timestamp, 36);
  if (isNaN(created)) return null;
  const age = Date.now() - created;
  if (age > SESSION_MAX_AGE * 1000) return null;

  return userId;
}

export function getUserIdFromRequest(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return verifySessionToken(match[1]);
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE };
