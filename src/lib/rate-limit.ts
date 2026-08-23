import "server-only";

/**
 * Fixed-window rate limiter for auth endpoints (brute-force / credential-
 * stuffing protection).
 *
 * NOTE: state is per-process and in-memory. That is sufficient for a single
 * instance (the SQLite deployment this app targets), but a multi-instance
 * deployment needs a shared store (Redis) — swap `hits` for that and keep this
 * interface.
 */

interface Window {
  count: number;
  resetAt: number;
}

const hits = new Map<string, Window>();
let lastSweep = 0;

/** Drop expired windows occasionally so the map cannot grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of hits) if (w.resetAt <= now) hits.delete(key);
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
  remaining: number;
}

/**
 * Consume one unit against `key`. Returns ok:false once `limit` is exceeded
 * within `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = hits.get(key);
  if (!existing || existing.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0, remaining: limit - 1 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  return { ok: true, retryAfter: 0, remaining: limit - existing.count };
}

/** Clear a key's window — call after a successful login so honest users reset. */
export function resetRateLimit(key: string): void {
  hits.delete(key);
}

/**
 * Extract the client IP from forwarding headers, resistant to header spoofing.
 *
 * `x-forwarded-for` is a comma-separated list where each proxy APPENDS the
 * address it saw, so a client-supplied prefix is attacker-controlled: taking
 * the FIRST (leftmost) value lets anyone forge a fresh IP per request and get
 * a new rate-limit bucket every time. We instead count hops from the RIGHT —
 * the rightmost entries are the ones our own infrastructure appended and the
 * client cannot forge past our trusted hop(s).
 *
 * `TRUSTED_PROXY_COUNT` = the number of trusted proxies in front of the app
 * (default 1). We use the entry inserted by the outermost trusted proxy, i.e.
 * `list[list.length - TRUSTED_PROXY_COUNT]`. Any values the client injected
 * sit further left and are ignored. `x-real-ip` (set and overwritten by the
 * proxy, not appended) is preferred when present.
 *
 * A direct-to-internet deployment with no proxy has no trustworthy header —
 * that case surfaces via `isUnknownClient` so callers can decline IP-wide
 * enforcement instead of keying off a forgeable value.
 */
function trustedProxyCount(): number {
  const n = Number(process.env.TRUSTED_PROXY_COUNT);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

function clientIp(req: Request): string | null {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return null;
  const list = fwd.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  const idx = Math.max(0, list.length - trustedProxyCount());
  return list[idx] ?? null;
}

/**
 * Best-effort client identifier. Behind a correctly-configured proxy this
 * trusts the hop appended by that proxy (see `clientIp`); a direct-to-internet
 * deployment has no trustworthy IP and falls back to a single shared bucket.
 */
export function clientKey(req: Request, scope: string): string {
  return `${scope}:${clientIp(req) ?? "local"}`;
}

/** True when no real per-client IP could be determined (see clientKey). */
export function isUnknownClient(req: Request): boolean {
  return clientIp(req) === null;
}
