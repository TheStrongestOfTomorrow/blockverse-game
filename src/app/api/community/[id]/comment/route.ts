import { NextResponse } from 'next/server';
import { z } from 'zod';
import { githubFetch, REPO_OWNER, REPO_NAME } from '@/lib/github-community';
import { checkRateLimit, getClientIp, API_RATE_LIMIT } from '@/lib/rate-limit';

const commentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(65000, 'Comment is too long'),
  token: z.string().min(1, 'GitHub token is required for commenting'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit check
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`community-comment:${ip}`, API_RATE_LIMIT);
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

    const reqBody = await request.json();
    const result = commentSchema.safeParse(reqBody);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || result.error.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { body: commentBody, token } = result.data;

    // Create comment on the GitHub issue
    const comment = await githubFetch<{
      id: number;
      user?: { login: string; avatar_url: string };
      body: string;
      created_at: string;
      html_url: string;
    } & Record<string, unknown>>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody.trim() }),
      }
    );

    return NextResponse.json(
      {
        success: true,
        comment: {
          id: comment.id,
          author: comment.user?.login || 'Unknown',
          avatarUrl: comment.user?.avatar_url || '',
          body: comment.body,
          createdAt: comment.created_at,
          url: comment.html_url,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Community comment error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
