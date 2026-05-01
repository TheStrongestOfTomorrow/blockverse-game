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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const friendRequest = await db.friendRequest.findUnique({ where: { id } });
    if (!friendRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (friendRequest.toId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await db.friendRequest.update({ where: { id }, data: { status: 'declined' } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Decline friend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
