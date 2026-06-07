import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

const updateGameSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  template: z.string().optional(),
  maxPlayers: z.number().min(1).max(50).optional(),
  isPublic: z.boolean().optional(),
  worldData: z.string().max(5_000_000).optional(), // 5MB limit for world data
  thumbnailColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

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
    const result = updateGameSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    // Only include fields that were actually provided
    const updateData: Record<string, unknown> = {};
    if (result.data.name !== undefined) updateData.name = result.data.name;
    if (result.data.description !== undefined) updateData.description = result.data.description;
    if (result.data.category !== undefined) updateData.category = result.data.category;
    if (result.data.template !== undefined) updateData.template = result.data.template;
    if (result.data.maxPlayers !== undefined) updateData.maxPlayers = result.data.maxPlayers;
    if (result.data.isPublic !== undefined) updateData.isPublic = result.data.isPublic;
    if (result.data.worldData !== undefined) updateData.worldData = result.data.worldData;
    if (result.data.thumbnailColor !== undefined) updateData.thumbnailColor = result.data.thumbnailColor;

    const updated = await db.game.update({
      where: { id },
      data: updateData,
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
