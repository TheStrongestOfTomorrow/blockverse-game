import { NextResponse } from 'next/server';
import {
  githubFetch,
  parseIssueToContent,
  getRatings,
} from '@/lib/github-community';
import { REPO_OWNER, REPO_NAME } from '@/lib/github-community';
import { checkRateLimit, getClientIp, API_RATE_LIMIT } from '@/lib/rate-limit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: { name: string }[];
  user?: { login: string; avatar_url: string };
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  state: string;
}

interface GitHubComment {
  id: number;
  user?: { login: string; avatar_url: string };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit check
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`community-detail:${ip}`, API_RATE_LIMIT);
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

    // Fetch the issue
    const issue = await githubFetch<GitHubIssue>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`
    );

    if (issue.state !== 'open') {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Get user token from query param for authenticated ratings
    const { searchParams } = new URL(request.url);
    const userToken = searchParams.get('token') || undefined;

    // Fetch ratings and comments in parallel
    const [ratings, comments] = await Promise.all([
      getRatings(issueNumber, userToken),
      fetchComments(issueNumber),
    ]);

    const content = parseIssueToContent(issue, ratings);

    // Exclude game-share content
    if (content.type === 'game') {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json({ content, comments });
  } catch (error) {
    console.error('Community detail error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    // If GitHub returns 404, return our own 404
    if (message.includes('404') || message.includes('Not Found')) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function fetchComments(issueNumber: number): Promise<GitHubComment[]> {
  try {
    const comments = await githubFetch<GitHubComment[]>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments?per_page=50&sort=created&direction=desc`
    );
    return comments;
  } catch {
    return [];
  }
}
