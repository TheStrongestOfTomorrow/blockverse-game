import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

function getUserIdFromRequest(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/bv_session=([^;]+)/);
  if (!match) return null;
  try {
    const token = Buffer.from(match[1], 'base64').toString();
    return token.split(':')[0] || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const requests = await db.friendRequest.findMany({
      where: { toId: userId, status: 'pending' },
      include: {
        from: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Friend requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
