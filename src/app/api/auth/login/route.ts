import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { checkRateLimit, getClientIp, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: Request) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`login:${ip}`, AUTH_RATE_LIMIT);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.issues?.[0]?.message || result.error.message || 'Invalid input';
      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }

    const { username, password } = result.data;

    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastSeen: new Date() },
    });

    const response = NextResponse.json({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      settings: user.settings,
    });

    // Set signed session cookie
    const token = createSessionToken(user.id);
    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
