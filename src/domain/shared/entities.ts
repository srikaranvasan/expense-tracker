/**
 * Shape conventions shared by every domain entity.
 *
 * Ids are always strings here: MongoDB's ObjectId is an infrastructure detail and
 * must not leak into the domain (docs/05-FOLDER-STRUCTURE.md section 19).
 */

export type EntityBase = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Entities that take part in offline synchronisation. */
export type SyncMeta = {
  /** Stable client-generated id, unique per user. */
  clientId: string;
  /** Incremented on every server-side write; used for conflict detection. */
  syncVersion: number;
};

/** Financial records are soft-deleted so offline devices can converge. */
export type SoftDeleteMeta = {
  deletedAt: Date | null;
};

/** Reference data uses archiving rather than deletion. */
export type ArchiveMeta = {
  archivedAt: Date | null;
};

export type OwnedEntity = EntityBase & {
  userId: string;
};
