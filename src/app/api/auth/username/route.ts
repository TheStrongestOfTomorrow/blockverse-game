import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, getClientIp, API_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Rate limit to prevent username enumeration
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`username:${ip}`, API_RATE_LIMIT);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const username = request.nextUrl.searchParams.get('username')?.trim() || '';

    // Validate username format before querying
    if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ available: false });
    }

    const existing = await db.user.findUnique({
      where: { username },
      select: { id: true },
    });

    return NextResponse.json({ available: !existing });
  } catch (error) {
    console.error('Username check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
