import type { SyncStatus } from "../db/schema";

/**
 * Shared repository shapes.
 *
 * Every local repository is scoped to a `userId`, mirroring the server repositories.
 * A browser profile can be shared, and one user's expenses must never appear under
 * another's - the same rule as on the server, enforced the same way: the user id is a
 * required first argument, not an optional filter.
 */

/** Reads exclude soft-deleted rows unless asked otherwise. */
export type LocalListOptions = {
  includeDeleted?: boolean;
  includeArchived?: boolean;
};

export type LocalTransactionQuery = LocalListOptions & {
  types?: readonly string[];
  accountId?: string;
  categoryId?: string;
  personId?: string;
  from?: Date;
  to?: Date;
  search?: string;
  limit?: number;
};

export type SyncStatusCounts = Record<SyncStatus, number>;
