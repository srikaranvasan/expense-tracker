import { describe, expect, it } from "vitest";
import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  MAX_RETRY_ATTEMPTS,
  backoffDelayMs,
  hasExhaustedRetries,
  nextRetryAt,
} from "./backoff";

describe("backoffDelayMs", () => {
  it("grows exponentially", () => {
    // Fixed randomness so the schedule itself is asserted, not tolerated.
    const noJitter = () => 1;

    expect(backoffDelayMs(0, noJitter)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelayMs(1, noJitter)).toBe(BACKOFF_BASE_MS * 2);
    expect(backoffDelayMs(2, noJitter)).toBe(BACKOFF_BASE_MS * 4);
    expect(backoffDelayMs(3, noJitter)).toBe(BACKOFF_BASE_MS * 8);
  });

  it("caps the delay so a retry is never scheduled absurdly far out", () => {
    expect(backoffDelayMs(50, () => 1)).toBe(BACKOFF_MAX_MS);
  });

  it("applies jitter so reconnecting clients do not retry in lockstep", () => {
    // The whole point: two devices at the same retry count get different delays.
    const low = backoffDelayMs(3, () => 0);
    const high = backoffDelayMs(3, () => 1);

    expect(low).toBeLessThan(high);
    // Full jitter spans [50%, 100%] of the window.
    expect(low).toBe(Math.round(BACKOFF_BASE_MS * 8 * 0.5));
    expect(high).toBe(BACKOFF_BASE_MS * 8);
  });

  it("never returns a negative or zero delay", () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(backoffDelayMs(attempt, () => 0)).toBeGreaterThan(0);
    }
  });

  it("treats a negative retry count as the first attempt", () => {
    expect(backoffDelayMs(-5, () => 1)).toBe(BACKOFF_BASE_MS);
  });
});

describe("nextRetryAt", () => {
  it("is always in the future", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    const at = nextRetryAt(0, now, () => 0);

    expect(at.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("hasExhaustedRetries", () => {
  it("allows retries below the cap", () => {
    expect(hasExhaustedRetries(0)).toBe(false);
    expect(hasExhaustedRetries(MAX_RETRY_ATTEMPTS - 1)).toBe(false);
  });

  it("gives up at the cap, so a stuck operation eventually reaches the user", () => {
    expect(hasExhaustedRetries(MAX_RETRY_ATTEMPTS)).toBe(true);
    expect(hasExhaustedRetries(MAX_RETRY_ATTEMPTS + 5)).toBe(true);
  });
});
