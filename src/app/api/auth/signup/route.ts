import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { checkRateLimit, getClientIp, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const signupSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric with underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password too long'),
});

export async function POST(request: Request) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`signup:${ip}`, AUTH_RATE_LIMIT);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.issues?.[0]?.message || result.error.message || 'Invalid input';
      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }

    const { username, password } = result.data;

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { username, passwordHash },
    });

    const response = NextResponse.json({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
    }, { status: 201 });

    // Set signed session cookie
    const token = createSessionToken(user.id);
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
