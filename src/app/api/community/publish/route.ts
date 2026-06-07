import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  githubFetch,
  contentToIssueBody,
  clearCache,
  REPO_OWNER,
  REPO_NAME,
} from '@/lib/github-community';
import { checkRateLimit, getClientIp, API_RATE_LIMIT } from '@/lib/rate-limit';

const publishNodePackSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(2000).default(''),
  nodes: z.array(z.unknown()).min(1, 'At least one node is required'),
  category: z.string().max(50).default('General'),
  token: z.string().min(1, 'GitHub token is required for publishing'),
});

export async function POST(request: Request) {
  try {
    // Rate limit check
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`community-publish:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 5,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many publish requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const result = publishNodePackSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || result.error.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { name, description, nodes, category, token } = result.data;

    // Validate token by fetching user info
    let username = 'Unknown';
    try {
      const user = await githubFetch<{ login: string } & Record<string, unknown>>('/user', { token });
      username = user.login;
    } catch {
      return NextResponse.json(
        { error: 'Invalid GitHub token. Please check your credentials.' },
        { status: 401 }
      );
    }

    // Generate a share code (base64 of the nodes JSON)
    const shareCode = Buffer.from(JSON.stringify(nodes)).toString('base64');

    const labels = ['node-pack'];
    if (category && category.toLowerCase() !== 'general') {
      labels.push(category.toLowerCase());
    }

    const title = `[NODE PACK] ${name.trim()}`;
    const issueBody = contentToIssueBody({
      type: 'node-pack',
      name: name.trim(),
      description: description || '',
      author: username,
      version: '1.0',
      category: category || 'General',
      nodes,
      shareCode,
    });

    // Create the GitHub issue
    const issue = await githubFetch<{ number: number; html_url: string } & Record<string, unknown>>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: issueBody, labels }),
      }
    );

    // Clear browse cache so new content shows up
    clearCache();

    return NextResponse.json(
      {
        success: true,
        issueNumber: issue.number,
        url: issue.html_url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Community publish error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
