/**
 * Retry scheduling.
 *
 * Two properties matter.
 *
 * **Exponential growth**, so a server that is down is not hammered by a client that
 * cannot tell the difference between "down" and "slow".
 *
 * **Jitter**, which is the part that is easy to leave out and expensive to omit. Every
 * device that lost connectivity during an outage reconnects at roughly the same moment.
 * Without jitter they all retry on the same schedule and arrive together, producing a
 * thundering herd exactly when the server is least able to absorb it
 * (docs/08-OFFLINE-SYNC.md section 19).
 */

export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 5 * 60 * 1000;

/**
 * Attempts before an operation is given up on.
 *
 * Only applies to *retryable* failures. A permanent rejection fails on the first
 * attempt, and this cap exists for the case that keeps looking temporary but never
 * resolves - so the user is eventually told rather than left with a silently stuck
 * queue.
 */
export const MAX_RETRY_ATTEMPTS = 8;

/**
 * Delay before attempt number `retryCount + 1`.
 *
 * `random` is injectable so tests can assert the schedule instead of tolerating it.
 */
export function backoffDelayMs(retryCount: number, random: () => number = Math.random): number {
  const exponential = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, retryCount), BACKOFF_MAX_MS);

  // Full jitter: anywhere in [50%, 100%] of the window. Keeps the growth curve while
  // spreading a reconnecting fleet across the interval.
  const jittered = exponential * (0.5 + random() * 0.5);

  return Math.round(jittered);
}

export function nextRetryAt(
  retryCount: number,
  now: Date = new Date(),
  random: () => number = Math.random,
): Date {
  return new Date(now.getTime() + backoffDelayMs(retryCount, random));
}

/** Whether an operation has exhausted its retries. */
export function hasExhaustedRetries(retryCount: number): boolean {
  return retryCount >= MAX_RETRY_ATTEMPTS;
}
