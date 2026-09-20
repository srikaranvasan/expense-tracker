import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/config/constants";
import { resetServerEnvCache } from "@/config/env";
import { RateLimitedError } from "@/lib/errors";
import { checkRateLimit, clientIdentity, enforceRateLimit, resetRateLimits } from "./rate-limit";

/**
 * The limiter is the only brake on credential stuffing against the sign-in endpoint
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 16), so its edges are worth pinning
 * down: budgets are per identity and per bucket, the window actually resets, and the
 * configuration switch cannot accidentally leave it off.
 */

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimits();
  });

  it("allows requests up to the bucket limit and then refuses", () => {
    const { limit } = RATE_LIMITS.auth;

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const result = checkRateLimit("auth", "1.2.3.4");
      expect(result.allowed, `attempt ${attempt} should be allowed`).toBe(true);
      expect(result.remaining).toBe(limit - attempt);
    }

    const refused = checkRateLimit("auth", "1.2.3.4");
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps budgets separate per identity", () => {
    for (let i = 0; i < RATE_LIMITS.auth.limit; i += 1) checkRateLimit("auth", "attacker");

    // One caller exhausting their allowance must not lock anyone else out.
    expect(checkRateLimit("auth", "attacker").allowed).toBe(false);
    expect(checkRateLimit("auth", "someone-else").allowed).toBe(true);
  });

  it("keeps budgets separate per bucket", () => {
    for (let i = 0; i < RATE_LIMITS.auth.limit; i += 1) checkRateLimit("auth", "same-caller");

    expect(checkRateLimit("auth", "same-caller").allowed).toBe(false);
    // This is why sync moved off the write bucket: a background task must not be able to
    // spend the budget the user needs to save an expense by hand.
    expect(checkRateLimit("sync", "same-caller").allowed).toBe(true);
    expect(checkRateLimit("write", "same-caller").allowed).toBe(true);
  });

  it("gives a fresh allowance once the window passes", () => {
    for (let i = 0; i < RATE_LIMITS.auth.limit; i += 1) checkRateLimit("auth", "caller");
    expect(checkRateLimit("auth", "caller").allowed).toBe(false);

    vi.advanceTimersByTime(RATE_LIMITS.auth.windowMs + 1);

    expect(checkRateLimit("auth", "caller").allowed).toBe(true);
  });

  it("reports a retry delay no longer than the window", () => {
    for (let i = 0; i < RATE_LIMITS.auth.limit; i += 1) checkRateLimit("auth", "caller");

    const { retryAfterSeconds } = checkRateLimit("auth", "caller");
    expect(retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMITS.auth.windowMs / 1000);
  });
});

/**
 * `enforceRateLimit` now honours `RATE_LIMIT_ENABLED`, and the test environment sets it to
 * `false` (tests/setup/test-env.ts) so suites can hammer endpoints freely. These tests
 * therefore have to switch it back on for themselves — which is also the cleanest proof that
 * the switch works in both directions.
 */
describe("enforceRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    resetServerEnvCache();
  });

  afterEach(() => {
    resetRateLimits();
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it("throws RateLimitedError with a retry delay once the budget is gone", () => {
    for (let i = 0; i < RATE_LIMITS.auth.limit; i += 1) enforceRateLimit("auth", "caller");

    expect(() => enforceRateLimit("auth", "caller")).toThrow(RateLimitedError);

    // The delay drives the Retry-After header, so it has to be a usable number.
    const error = (() => {
      try {
        enforceRateLimit("auth", "caller");
        return null;
      } catch (thrown) {
        return thrown as RateLimitedError;
      }
    })();

    expect(error?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("can be switched off by configuration", () => {
    vi.stubEnv("RATE_LIMIT_ENABLED", "false");
    // The flag is read through getServerEnv(), which caches, so the cache must be dropped
    // for the stub to take effect.
    resetServerEnvCache();

    for (let i = 0; i < RATE_LIMITS.auth.limit * 3; i += 1) {
      expect(enforceRateLimit("auth", "caller").allowed).toBe(true);
    }
  });

  it("stays on when the environment cannot be read", () => {
    // Failing open would turn one missing variable into an unprotected sign-in endpoint, so
    // a configuration error must resolve to "enabled".
    vi.stubEnv("AUTH_SECRET", "too-short");
    vi.stubEnv("RATE_LIMIT_ENABLED", "false");
    resetServerEnvCache();

    for (let i = 0; i < RATE_LIMITS.auth.limit; i += 1) enforceRateLimit("auth", "caller");
    expect(() => enforceRateLimit("auth", "caller")).toThrow(RateLimitedError);
  });
});

describe("clientIdentity", () => {
  const requestWith = (headers: Record<string, string>) =>
    new Request("http://localhost/api/auth/callback/credentials", { headers });

  it("uses the first hop of x-forwarded-for", () => {
    // The left-most entry is the original client; later entries are proxies.
    expect(clientIdentity(requestWith({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe(
      "203.0.113.9",
    );
  });

  it("falls back through the other proxy headers", () => {
    expect(clientIdentity(requestWith({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIdentity(requestWith({ "cf-connecting-ip": "198.51.100.8" }))).toBe(
      "198.51.100.8",
    );
  });

  it("still returns an identity when no proxy header is present", () => {
    // A shared bucket is a worse experience but a safe one. Returning nothing would
    // disable limiting altogether, which is the failure that matters.
    expect(clientIdentity(requestWith({}))).toBe("unknown");
  });
});
