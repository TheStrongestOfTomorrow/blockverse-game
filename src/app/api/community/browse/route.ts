import { NextResponse } from 'next/server';
import {
  githubFetch,
  parseIssueToContent,
  getRatings,
  getCached,
  setCache,
  REPO_OWNER,
  REPO_NAME,
  CONTENT_TYPE_LABELS,
} from '@/lib/github-community';
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
}

export async function GET(request: Request) {
  try {
    // Rate limit check
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`community-browse:${ip}`, API_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // node-pack | tutorial | all
    const category = searchParams.get('category') || 'all';
    const sort = searchParams.get('sort') || 'newest'; // newest | popular | updated
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const perPage = 12;

    // Validate type param — only allow node-pack, tutorial, or all
    const validTypes = ['node-pack', 'tutorial', 'all'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Allowed: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate sort param
    const validSorts = ['newest', 'popular', 'updated'];
    if (!validSorts.includes(sort)) {
      return NextResponse.json(
        { error: `Invalid sort. Allowed: ${validSorts.join(', ')}` },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `browse_${type}_${category}_${sort}_${page}`;
    const cached = getCached<{ items: unknown[]; page: number; perPage: number }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Build GitHub API query params
    const params = new URLSearchParams({
      state: 'open',
      per_page: String(perPage),
      page: String(page),
    });

    // Set label filter based on type
    if (type !== 'all') {
      const label = CONTENT_TYPE_LABELS[type];
      if (label) params.set('labels', label);
    }

    // Set sort direction
    if (sort === 'newest') params.set('sort', 'created');
    else if (sort === 'updated') params.set('sort', 'updated');
    else if (sort === 'popular') params.set('sort', 'comments'); // comments as popularity proxy
    params.set('direction', 'desc');

    // Fetch issues from GitHub (server-side, uses GITHUB_COMMUNITY_TOKEN if available)
    const issues = await githubFetch<GitHubIssue[]>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues?${params}`
    );

    // Parse each issue into a clean content object
    const items = await Promise.all(
      issues.map(async (issue) => {
        const ratings = await getRatings(issue.number);
        return parseIssueToContent(issue, ratings);
      })
    );

    // Client-side category filter (GitHub doesn't support multi-label OR queries easily)
    let filtered = items;
    if (category && category !== 'all') {
      filtered = items.filter((item) => {
        const itemCats = (item.categories || []).map((c) => c.toLowerCase());
        return itemCats.includes(category.toLowerCase());
      });
    }

    // Exclude game-share labeled content
    filtered = filtered.filter((item) => item.type !== 'game');

    const result = { items: filtered, page, perPage };
    setCache(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Community browse error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
