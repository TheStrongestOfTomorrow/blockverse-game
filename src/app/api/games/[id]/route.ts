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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const game = await db.game.findUnique({
      where: { id },
      include: { creator: { select: { username: true } } },
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({ game });
  } catch (error) {
    console.error('Game get error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const game = await db.game.findUnique({ where: { id } });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.creatorId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const updated = await db.game.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        template: body.template,
        maxPlayers: body.maxPlayers,
        isPublic: body.isPublic,
        worldData: body.worldData,
        thumbnailColor: body.thumbnailColor,
      },
      include: { creator: { select: { username: true } } },
    });

    return NextResponse.json({ game: updated });
  } catch (error) {
    console.error('Game update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const game = await db.game.findUnique({ where: { id } });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.creatorId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await db.game.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Game delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
