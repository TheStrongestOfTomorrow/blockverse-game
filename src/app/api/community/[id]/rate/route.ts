import { NextResponse } from 'next/server';
import { z } from 'zod';
import { githubFetch, REPO_OWNER, REPO_NAME } from '@/lib/github-community';
import { checkRateLimit, getClientIp, API_RATE_LIMIT } from '@/lib/rate-limit';

const ALLOWED_REACTIONS = ['+1', '-1', 'heart', 'rocket', 'eyes', 'hooray'] as const;

const rateSchema = z.object({
  reaction: z.enum(ALLOWED_REACTIONS, {
    message: `Invalid reaction type. Allowed: ${ALLOWED_REACTIONS.join(', ')}`,
  }),
  token: z.string().min(1, 'GitHub token is required for rating'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit check
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`community-rate:${ip}`, API_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;
    const issueNumber = parseInt(id, 10);
    if (isNaN(issueNumber) || issueNumber <= 0) {
      return NextResponse.json({ error: 'Invalid content ID' }, { status: 400 });
    }

    const body = await request.json();
    const result = rateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || result.error.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { reaction, token } = result.data;

    // Create reaction on the GitHub issue
    const reactionResult = await githubFetch<{ id: number; content: string } & Record<string, unknown>>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/reactions`,
      {
        method: 'POST',
        token,
        headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' },
        body: JSON.stringify({ content: reaction }),
      }
    );

    return NextResponse.json({ success: true, reaction: reactionResult }, { status: 201 });
  } catch (error) {
    console.error('Community rate error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('already exists')) {
      return NextResponse.json(
        { error: 'You have already reacted with this.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
