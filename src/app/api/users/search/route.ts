import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    if (q.length < 1) {
      return NextResponse.json({ users: [] });
    }

    const users = await db.user.findMany({
      where: { username: { startsWith: q } },
      select: { id: true, username: true, avatar: true, lastSeen: true },
      take: 10,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('User search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
