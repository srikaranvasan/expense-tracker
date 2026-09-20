import type { Filter, ObjectId } from "mongodb";
import { toObjectId } from "./object-id";

/**
 * Shared persistence conventions.
 *
 * Timestamps, sync versioning, soft deletion and ownership scoping are applied
 * the same way by every repository, so a new collection cannot accidentally opt
 * out of them.
 */

/** Every synced entity starts at version 1; the version increases on each write. */
export const INITIAL_SYNC_VERSION = 1;

export type CreationMeta = {
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
};

export function creationMeta(now: Date = new Date()): CreationMeta {
  return { createdAt: now, updatedAt: now, syncVersion: INITIAL_SYNC_VERSION };
}

/** Timestamps to merge into a `$set` on update. */
export function updateMeta(now: Date = new Date()): { updatedAt: Date } {
  return { updatedAt: now };
}

/**
 * Ownership filter.
 *
 * Every query is scoped by `userId`. A lookup by `_id` alone would let one user
 * read another's record (docs/06-CODING-PRACTICES.md section 14).
 */
export function owned(userId: string): { userId: ObjectId } {
  return { userId: toObjectId(userId) };
}

export function ownedById(userId: string, id: string): { _id: ObjectId; userId: ObjectId } {
  return { _id: toObjectId(id), userId: toObjectId(userId) };
}

/** Soft-deleted financial records are excluded from normal reads. */
export function notDeleted(): { deletedAt: null } {
  return { deletedAt: null };
}

/** Archived reference data is excluded from normal reads. */
export function notArchived(): { archivedAt: null } {
  return { archivedAt: null };
}

export function ownedAndLive<T extends { userId?: unknown; deletedAt?: unknown }>(
  userId: string,
  id?: string,
): Filter<T> {
  return {
    ...(id ? ownedById(userId, id) : owned(userId)),
    ...notDeleted(),
  } as Filter<T>;
}

export function ownedAndActive<T extends { userId?: unknown; archivedAt?: unknown }>(
  userId: string,
  id?: string,
): Filter<T> {
  return {
    ...(id ? ownedById(userId, id) : owned(userId)),
    ...notArchived(),
  } as Filter<T>;
}

/**
 * Marks a record deleted rather than removing it.
 *
 * Physical deletion would let an offline device resurrect the record on its next
 * sync, and would destroy settlement history
 * (docs/09-DATABASE-SCHEMA.md section 25).
 */
export function softDeleteUpdate(now: Date = new Date()) {
  return {
    $set: { deletedAt: now, updatedAt: now },
    $inc: { syncVersion: 1 },
  } as const;
}

export function archiveUpdate(now: Date = new Date()) {
  return {
    $set: { archivedAt: now, updatedAt: now },
    $inc: { syncVersion: 1 },
  } as const;
}

export function restoreUpdate(now: Date = new Date()) {
  return {
    $set: { archivedAt: null, updatedAt: now },
    $inc: { syncVersion: 1 },
  } as const;
}
