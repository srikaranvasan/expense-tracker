import type { ClientSession } from "mongodb";

/**
 * Conventions every repository follows.
 *
 * `userId` is the first argument of every read and write. That is not decoration:
 * it makes an unscoped query impossible to write by accident
 * (docs/02-DATA-MODEL.md section 29).
 */

export type RepositoryContext = {
  session?: ClientSession;
};

export type CursorQuery = {
  cursor?: string;
  limit: number;
};

export type CursorResult<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

/** Values the client supplies for a synced create. */
export type SyncedCreateMeta = {
  /** Stable client-generated id. Re-sending it must not create a duplicate. */
  clientId: string;
};

/** Guards a synced update against a concurrent change on another device. */
export type OptimisticUpdateMeta = {
  expectedSyncVersion?: number;
};

/** Changes since a sync cursor, used by the pull endpoint. */
export type ChangeFeedQuery = {
  since: Date | null;
  sinceId: string | null;
  limit: number;
};
