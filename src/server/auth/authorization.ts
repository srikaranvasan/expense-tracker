import { ForbiddenError, NotFoundError } from "@/lib/errors";

/**
 * Ownership checks.
 *
 * Possessing an id grants nothing: every reference is verified against the
 * authenticated user (docs/12-SECURITY-AND-ERROR-HANDLING.md sections 5-7).
 *
 * Note that repository reads already scope queries by `userId`, so these helpers
 * are the second layer for values that arrive as plain references.
 */

/**
 * Asserts that a fetched record belongs to the user.
 *
 * Reports "not found" rather than "forbidden" so the API never confirms that
 * another user's record exists.
 */
export function assertOwned<T extends { userId: string }>(
  record: T | null | undefined,
  userId: string,
  resource: string,
): T {
  if (!record || record.userId !== userId) throw new NotFoundError(resource);
  return record;
}

/** Asserts a record exists, for repository reads already scoped by userId. */
export function assertFound<T>(record: T | null | undefined, resource: string): T {
  if (record === null || record === undefined) throw new NotFoundError(resource);
  return record;
}

/**
 * Rejects a client-supplied `userId`.
 *
 * A request that tries to name its own user is either a bug or an attack; either
 * way it must not be silently ignored.
 */
export function rejectClientUserId(payload: unknown): void {
  if (payload && typeof payload === "object" && "userId" in payload) {
    throw new ForbiddenError("userId must not be supplied by the client.");
  }
}
