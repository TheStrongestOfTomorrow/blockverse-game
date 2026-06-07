import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

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
