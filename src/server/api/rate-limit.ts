import { RATE_LIMITS } from "@/config/constants";
import { getServerEnv } from "@/config/env";
import { RateLimitedError } from "@/lib/errors";

/**
 * In-process fixed-window rate limiter.
 *
 * Deliberately simple: the MVP does not need a distributed limiter
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 17). On a multi-instance
 * deployment this becomes per-instance, which is still a useful brake, and the
 * hosting platform is expected to provide the outer limit.
 */

export type RateLimitBucket = keyof typeof RATE_LIMITS;

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
};

export function checkRateLimit(bucket: RateLimitBucket, identity: string): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const now = Date.now();
  sweep(now);

  const key = `${bucket}:${identity}`;
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0, limit };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      limit,
    };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0, limit };
}

/**
 * Whether limiting is switched on.
 *
 * `RATE_LIMIT_ENABLED` was declared in `.env.example` and validated by `getServerEnv()`
 * from group 1 onwards, but nothing read it — the switch existed in configuration and was
 * ignored at runtime. It is honoured here so a staging environment can be load-tested, or
 * an E2E run can hammer an endpoint, without editing code.
 *
 * A configuration error resolves to *enabled*. Failing open would turn one missing variable
 * into an unprotected sign-in endpoint.
 */
function rateLimitingEnabled(): boolean {
  try {
    return getServerEnv().RATE_LIMIT_ENABLED;
  } catch {
    return true;
  }
}

export function enforceRateLimit(bucket: RateLimitBucket, identity: string): RateLimitResult {
  if (!rateLimitingEnabled()) {
    return {
      allowed: true,
      remaining: RATE_LIMITS[bucket].limit,
      retryAfterSeconds: 0,
      limit: RATE_LIMITS[bucket].limit,
    };
  }

  const result = checkRateLimit(bucket, identity);
  if (!result.allowed) throw new RateLimitedError(result.retryAfterSeconds);
  return result;
}

/**
 * Best-effort caller identity for anonymous endpoints.
 * Falls back to a constant so a missing proxy header cannot disable limiting.
 */
export function clientIdentity(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}

/** Test helper. */
export function resetRateLimits(): void {
  windows.clear();
  lastSweep = 0;
}
