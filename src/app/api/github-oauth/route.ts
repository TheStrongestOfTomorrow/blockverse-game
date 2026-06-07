import { NextResponse } from 'next/server';

/**
 * GET /api/github-oauth
 * Returns the GitHub OAuth App client_id for Device Flow authentication.
 * The client_id is safe to expose publicly — it's not a secret.
 * The client_secret is ONLY used server-side and never exposed.
 */
export async function GET() {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID || 'Ov23ligIlHtTGVeIIfoC';

  return NextResponse.json({
    clientId,
    deviceFlowUrl: 'https://github.com/login/device',
    available: !!clientId,
  });
}
