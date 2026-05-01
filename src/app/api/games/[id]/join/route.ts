import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const game = await db.game.findUnique({ where: { id } });
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const updated = await db.game.update({
      where: { id },
      data: { visits: { increment: 1 } },
    });

    return NextResponse.json({ game: updated });
  } catch (error) {
    console.error('Game join error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
