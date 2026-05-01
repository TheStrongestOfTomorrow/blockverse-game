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

    const friends = await db.friend.findMany({
      where: { userId },
      include: { friend: { select: { id: true, username: true, avatar: true, lastSeen: true } } },
    });

    const friendOf = await db.friend.findMany({
      where: { friendId: userId },
      include: { user: { select: { id: true, username: true, avatar: true, lastSeen: true } } },
    });

    const allFriends = [
      ...friends.map(f => f.friend),
      ...friendOf.map(f => f.user),
    ];

    return NextResponse.json({ friends: allFriends });
  } catch (error) {
    console.error('Friends list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { toId } = body;
    if (!toId) {
      return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });
    }

    if (toId === userId) {
      return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 });
    }

    // Check if already friends
    const existingFriend = await db.friend.findFirst({
      where: {
        OR: [
          { userId, friendId: toId },
          { userId: toId, friendId: userId },
        ],
      },
    });
    if (existingFriend) {
      return NextResponse.json({ error: 'Already friends' }, { status: 409 });
    }

    // Check for existing request
    const existingRequest = await db.friendRequest.findFirst({
      where: {
        OR: [
          { fromId: userId, toId: toId },
          { fromId: toId, toId: userId },
        ],
        status: 'pending',
      },
    });
    if (existingRequest) {
      return NextResponse.json({ error: 'Request already exists' }, { status: 409 });
    }

    const friendRequest = await db.friendRequest.create({
      data: { fromId: userId, toId },
      include: {
        from: { select: { id: true, username: true, avatar: true } },
        to: { select: { id: true, username: true, avatar: true } },
      },
    });

    return NextResponse.json({ request: friendRequest }, { status: 201 });
  } catch (error) {
    console.error('Friend request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
