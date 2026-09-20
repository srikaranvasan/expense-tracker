import { ERROR_CODES, isRetryableErrorCode } from "@/lib/errors";

/**
 * Deciding what to do with a failure.
 *
 * This classification is the most consequential logic in the sync engine, because both
 * mistakes are bad in different ways:
 *
 * - Retrying a **permanent** failure forever means a queue that never drains and a user
 *   who is never told their expense was rejected.
 * - Failing a **temporary** problem permanently means abandoning a perfectly valid
 *   expense because the network blinked.
 *
 * So the rule is explicit rather than inferred (docs/08-OFFLINE-SYNC.md sections 19-20).
 */

export type FailureKind =
  /** Try again later with backoff. */
  | "retryable"
  /** The server will never accept this. Tell the user. */
  | "permanent"
  /** The record changed elsewhere. Needs the conflict path, not a retry. */
  | "conflict";

/**
 * Errors that mean "the server could not answer right now".
 *
 * Note what is **not** here: a validation error, a missing account, an over-settlement.
 * Those are the server saying no, and it will keep saying no.
 */
const RETRYABLE_HTTP_STATUS: ReadonlySet<number> = new Set([408, 425, 429, 500, 502, 503, 504]);

export function classifyHttpStatus(status: number): FailureKind {
  if (status === 409) return "conflict";
  if (RETRYABLE_HTTP_STATUS.has(status)) return "retryable";
  return "permanent";
}

export function classifyErrorCode(code: string | null | undefined): FailureKind {
  if (!code) return "retryable";
  if (code === ERROR_CODES.SYNC_CONFLICT) return "conflict";
  return isRetryableErrorCode(code) ? "retryable" : "permanent";
}

/**
 * Classifies a per-operation result from a push response.
 *
 * The server already states `retryable` on the error it returns, and that flag is
 * authoritative: it knows whether it failed to reach the database or refused the
 * operation. The code is only consulted when the flag is absent.
 */
export function classifyOperationFailure(error: {
  code: string;
  retryable?: boolean;
}): FailureKind {
  if (error.code === ERROR_CODES.SYNC_CONFLICT) return "conflict";
  if (error.retryable === true) return "retryable";
  if (error.retryable === false) return "permanent";
  return classifyErrorCode(error.code);
}

/**
 * A transport failure - `fetch` threw, so nothing reached the server.
 *
 * Always retryable. The request may not even have left the device, and a request that
 * was never answered says nothing about whether the operation is valid.
 */
export function classifyTransportFailure(): FailureKind {
  return "retryable";
}

/** Message shown when the server gives none. */
export function describeFailure(kind: FailureKind): string {
  switch (kind) {
    case "conflict":
      return "This record was changed on another device.";
    case "permanent":
      return "The server rejected this change.";
    default:
      return "Could not reach the server.";
  }
}
