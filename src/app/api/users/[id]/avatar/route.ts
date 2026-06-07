import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, username: true, avatar: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ avatar: user.avatar });
  } catch (error) {
    console.error('Avatar get error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateAvatarSchema = z.object({
  avatar: z.string().min(1).max(10000), // 10KB max for JSON avatar data
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    if (id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const result = updateAvatarSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid avatar data' }, { status: 400 });
    }

    // Validate that avatar is valid JSON
    try {
      JSON.parse(result.data.avatar);
    } catch {
      return NextResponse.json({ error: 'Avatar must be valid JSON' }, { status: 400 });
    }

    await db.user.update({
      where: { id },
      data: { avatar: result.data.avatar },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Avatar update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
