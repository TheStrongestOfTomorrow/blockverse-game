// Simple in-memory rate limiter for API routes
// For production, consider using Redis-backed rate limiting

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  windowMs: number;   // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

// Default: 10 requests per 15 seconds (for auth endpoints)
export const AUTH_RATE_LIMIT: RateLimitOptions = {
  windowMs: 15 * 1000,
  maxRequests: 10,
};

// Default: 30 requests per 10 seconds (for general API)
export const API_RATE_LIMIT: RateLimitOptions = {
  windowMs: 10 * 1000,
  maxRequests: 30,
};

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = API_RATE_LIMIT
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.maxRequests - 1, resetAt };
  }

  if (entry.count >= options.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: options.maxRequests - entry.count, resetAt: entry.resetAt };
}

// Get client IP from request headers
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

// Periodic cleanup of expired entries (every 60 seconds)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000).unref?.();
}
