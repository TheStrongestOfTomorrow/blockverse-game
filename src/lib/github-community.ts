/**
 * GitHub Community Hub API Utilities
 * Server-side helper for proxying GitHub Issues API with optional auth token.
 * This avoids client-side rate limits and hides tokens from the browser.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'TheStrongestOfTomorrow';
const REPO_NAME = 'blockverse-community';

// Content type labels — game-share is intentionally excluded
const CONTENT_TYPE_LABELS: Record<string, string> = {
  'node-pack': 'node-pack',
  'tutorial': 'tutorial',
};

// In-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}

// ─── GitHub Fetch Helper ─────────────────────────────────────────────

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  token?: string;
}

/**
 * Make an authenticated request to the GitHub API.
 * Uses the server-side GITHUB_COMMUNITY_TOKEN env var for higher rate limits,
 * or falls back to the user-provided token for write operations.
 */
export async function githubFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    ...options.headers,
  };

  // Prefer user token (for write ops / identity), then fall back to server token
  const token = options.token || process.env.GITHUB_COMMUNITY_TOKEN || '';
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  // Handle rate limiting
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    if (data.message && String(data.message).includes('rate limit')) {
      throw new Error(
        'GitHub API rate limit reached. Please wait a few minutes and try again, or authenticate for 5000 requests/hour.'
      );
    }
    throw new Error(data.message || `GitHub API error: 403`);
  }

  if (response.status === 401) {
    throw new Error('Authentication failed. Your token may have expired.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `GitHub API error: ${response.status}`);
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) return {} as T;

  return response.json() as Promise<T>;
}

// ─── Issue → Content Parser ──────────────────────────────────────────

export interface ContentItem {
  id: number;
  name: string;
  type: string;
  description: string;
  author: string;
  version: string;
  category: string;
  categories: string[];
  nodes: unknown[] | null;
  nodeCount: number;
  shareCode: string | null;
  ratings: RatingsSummary;
  comments: number;
  verified: boolean;
  breaking: boolean;
  createdAt: string;
  updatedAt: string;
  url: string;
  avatarUrl: string;
  labels: string[];
}

export interface RatingsSummary {
  total: number;
  '+1': number;
  '-1': number;
  heart: number;
  rocket: number;
  eyes: number;
  hooray: number;
  userReactions?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseIssueToContent(issue: any, ratings?: RatingsSummary): ContentItem {
  const labels: string[] = (issue.labels || []).map((l: { name: string }) => l.name);

  let type = 'unknown';
  if (labels.includes('node-pack')) type = 'node-pack';
  else if (labels.includes('tutorial')) type = 'tutorial';

  // Extract metadata from the issue body
  const body = issue.body || '';
  let metadata: {
    author?: string;
    version?: string;
    category?: string;
    nodeCount?: number;
    shareCode?: string | null;
    description?: string;
    nodes?: unknown[];
  } = {};

  try {
    const authorMatch = body.match(/\*\*Author:\*\*\s*@?(\S+)/i);
    const versionMatch = body.match(/\*\*Version:\*\*\s*([\d.]+)/i);
    const categoryMatch = body.match(/\*\*Category:\*\*\s*(.+)/i);
    const nodeCountMatch = body.match(/\*\*Nodes?:\*\*\s*(\d+)/i);
    const shareCodeMatch = body.match(/`([A-Za-z0-9+/=]{20,})`/);

    metadata = {
      author: authorMatch ? authorMatch[1] : issue.user?.login || 'Unknown',
      version: versionMatch ? versionMatch[1] : '1.0',
      category: categoryMatch ? categoryMatch[1].trim() : 'General',
      nodeCount: nodeCountMatch ? parseInt(nodeCountMatch[1]) : 0,
      shareCode: shareCodeMatch ? shareCodeMatch[1] : null,
    };

    // Extract description section
    const descMatch = body.match(/###\s*Description\s*\n([\s\S]*?)(?=\n###|\n```|$)/i);
    if (descMatch) {
      metadata.description = descMatch[1].trim();
    }

    // Extract JSON nodes if present
    const jsonMatch = body.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        metadata.nodes = JSON.parse(jsonMatch[1].trim());
        metadata.nodeCount = (metadata.nodes as unknown[]).length;
      } catch {
        /* invalid JSON, skip */
      }
    }
  } catch {
    /* parse error, use defaults */
  }

  // Determine the name from the title
  let name = issue.title;
  const prefixMatch = issue.title.match(/^\[(NODE PACK|GAME|TUTORIAL)\]\s*(.+)/i);
  if (prefixMatch) {
    name = prefixMatch[2].trim();
  }

  // Extract categories from labels (non-type labels)
  const typeLabelSet = new Set(Object.values(CONTENT_TYPE_LABELS));
  const extraLabelSet = new Set(['verified', 'breaking', 'bug-report', 'feature-request']);
  const categories = labels.filter((l) => !typeLabelSet.has(l) && !extraLabelSet.has(l));

  return {
    id: issue.number,
    name,
    type,
    description: metadata.description || '',
    author: metadata.author || issue.user?.login || 'Unknown',
    version: metadata.version || '1.0',
    category: metadata.category || 'General',
    categories,
    nodes: metadata.nodes || null,
    nodeCount: metadata.nodeCount || 0,
    shareCode: metadata.shareCode || null,
    ratings: ratings || { total: 0, '+1': 0, '-1': 0, heart: 0, rocket: 0, eyes: 0, hooray: 0 },
    comments: issue.comments || 0,
    verified: labels.includes('verified'),
    breaking: labels.includes('breaking'),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
    avatarUrl: issue.user?.avatar_url || '',
    labels,
  };
}

// ─── Content → Issue Body ─────────────────────────────────────────────

export function contentToIssueBody(content: {
  type: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  nodes?: unknown[];
  shareCode?: string;
}): string {
  const { type, name, description, author, version, category, nodes, shareCode } = content;
  const typeLabel = type === 'node-pack' ? 'Node Pack' : 'Tutorial';
  const nodeCount = nodes ? nodes.length : 0;

  let body = `## ${typeLabel}: ${name}\n\n`;
  body += `**Author:** @${author}\n`;
  body += `**Version:** ${version}\n`;
  body += `**Category:** ${category}\n`;

  if (type === 'node-pack') {
    body += `**Nodes:** ${nodeCount}\n`;
  }

  body += `\n### Description\n${description}\n`;

  if (type === 'node-pack' && nodes && nodes.length > 0) {
    body += `\n### Nodes\n\`\`\`json\n${JSON.stringify(nodes, null, 2)}\n\`\`\`\n`;
  }

  if (shareCode) {
    body += `\n### Installation\n`;
    body += `Copy the share code below and paste it in BlockVerse Creator → My Blocks → Import:\n`;
    body += `\`${shareCode}\`\n`;
  }

  body += `\n---\n*Published via BlockVerse Community Hub*`;
  return body;
}

// ─── Ratings ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface GitHubReaction {
  id: number;
  content: string;
  user?: { login: string };
}

export async function getRatings(
  issueNumber: number,
  userToken?: string
): Promise<RatingsSummary> {
  try {
    const reactions = await githubFetch<GitHubReaction[]>(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/reactions`,
      {
        token: userToken,
        headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' },
      }
    );

    const summary: RatingsSummary = {
      total: reactions.length,
      '+1': 0,
      '-1': 0,
      heart: 0,
      rocket: 0,
      eyes: 0,
      hooray: 0,
    };

    for (const r of reactions) {
      const key = r.content as keyof RatingsSummary;
      if (typeof summary[key] === 'number') {
        (summary[key] as number) += 1;
      }
    }

    return summary;
  } catch {
    return { total: 0, '+1': 0, '-1': 0, heart: 0, rocket: 0, eyes: 0, hooray: 0 };
  }
}

// ─── Browse helper ────────────────────────────────────────────────────

export { GITHUB_API_BASE, REPO_OWNER, REPO_NAME, CONTENT_TYPE_LABELS, getCached, setCache };
