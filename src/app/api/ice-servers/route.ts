import { NextResponse } from "next/server";

/**
 * GET /api/ice-servers
 *
 * Returns the ICE server configuration (STUN + TURN) for WebRTC peer connections.
 * TURN credentials are read from environment variables so they never appear in
 * the client-side bundle. This is the standard production pattern — the client
 * fetches ICE config at runtime rather than hardcoding it.
 *
 * Without TURN servers, most users behind NATs/firewalls cannot establish
 * direct WebRTC connections, making multiplayer impossible. This endpoint
 * ensures every client gets working TURN credentials without exposing them
 * in the source code.
 */
export async function GET() {
  const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [];

  // Always include Google STUN servers (public, no auth needed)
  iceServers.push(
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  );

  // Add TURN servers from environment variables (up to 3)
  // These are REQUIRED for users behind symmetric NAT / strict firewalls
  for (let i = 1; i <= 3; i++) {
    const url = process.env[`TURN_SERVER_URL_${i}`];
    const username = process.env[`TURN_SERVER_USERNAME_${i}`];
    const credential = process.env[`TURN_SERVER_CREDENTIAL_${i}`];

    if (url) {
      const server: { urls: string; username?: string; credential?: string } = { urls: url };
      if (username) server.username = username;
      if (credential) server.credential = credential;
      iceServers.push(server);
    }
  }

  // Warn if no TURN servers configured — multiplayer will be broken for many users
  const turnCount = iceServers.filter((s) => s.urls.startsWith("turn")).length;
  if (turnCount === 0) {
    console.warn(
      "[ICE] No TURN servers configured! Multiplayer will fail for users behind NAT/firewalls. " +
        "Set TURN_SERVER_URL_1, TURN_SERVER_USERNAME_1, TURN_SERVER_CREDENTIAL_1 in .env"
    );
  }

  return NextResponse.json({ iceServers }, {
    headers: {
      // Cache for 5 minutes — credentials may rotate
      "Cache-Control": "public, max-age=300",
    },
  });
}
