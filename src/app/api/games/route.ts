import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { Utils } from '@/lib/constants';

const createGameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(500).optional(),
  category: z.string().default('sandbox'),
  template: z.string().default('flat'),
  maxPlayers: z.number().min(1).max(50).default(12),
  isPublic: z.boolean().default(true),
});

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
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = { isPublic: true };
    if (category !== 'all') where.category = category;
    if (search) where.name = { contains: search };

    const games = await db.game.findMany({
      where,
      include: { creator: { select: { username: true } } },
      orderBy: { visits: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await db.game.count({ where });

    return NextResponse.json({ games, total, page, limit });
  } catch (error) {
    console.error('Games list error:', error);
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
    const result = createGameSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || result.error.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const code = Utils.generateCode();
    const game = await db.game.create({
      data: {
        ...result.data,
        description: result.data.description || '',
        code,
        creatorId: userId,
      },
      include: { creator: { select: { username: true } } },
    });

    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    console.error('Game create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
