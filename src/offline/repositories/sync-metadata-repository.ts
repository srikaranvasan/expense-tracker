import { newClientId } from "@/lib/utils/client-id";
import { localDb } from "../db/client";
import type { LocalCachedView, LocalSyncMetadata } from "../db/schema";

/**
 * Per-user sync bookkeeping and the cached-view store.
 *
 * The cursor is the delicate part. It must only advance **after** the changes it
 * covers have been applied locally, or the client would skip them forever and quietly
 * hold stale financial data (docs/08-OFFLINE-SYNC.md section 23).
 */

const DEVICE_ID_STORAGE_KEY = "expense-tracker.deviceId";

/**
 * A stable id for this installation.
 *
 * Kept in `localStorage` rather than IndexedDB so it is readable synchronously during
 * startup, before the database is open. It is a diagnostic label only and must never
 * be treated as a credential (docs/08-OFFLINE-SYNC.md section 39).
 */
export function getDeviceId(): string {
  if (typeof localStorage === "undefined") return "device_unknown";

  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;

    const created = `device_${newClientId().replace(/-/g, "").slice(0, 16)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    // Storage can be blocked. A per-session id is still useful for diagnostics.
    return "device_unavailable";
  }
}

export const localSyncMetadataRepository = {
  async get(userId: string): Promise<LocalSyncMetadata | null> {
    return (await localDb().syncMetadata.get(userId)) ?? null;
  },

  /** Reads the row, creating it on first use. */
  async ensure(userId: string, deviceId: string = getDeviceId()): Promise<LocalSyncMetadata> {
    const db = localDb();
    const existing = await db.syncMetadata.get(userId);
    if (existing) return existing;

    const created: LocalSyncMetadata = {
      userId,
      deviceId,
      lastPulledCursor: null,
      lastPulledAt: null,
      lastPushedAt: null,
      lastError: null,
    };

    await db.syncMetadata.put(created);
    return created;
  },

  /**
   * Advances the pull cursor.
   *
   * Call this only once the pulled changes are committed locally. The caller should do
   * both inside one IndexedDB transaction where practical
   * (docs/08-OFFLINE-SYNC.md section 24).
   */
  async setCursor(userId: string, cursor: string | null, now: Date = new Date()): Promise<void> {
    const metadata = await this.ensure(userId);
    await localDb().syncMetadata.put({
      ...metadata,
      lastPulledCursor: cursor,
      lastPulledAt: now,
      lastError: null,
    });
  },

  async recordPush(userId: string, now: Date = new Date()): Promise<void> {
    const metadata = await this.ensure(userId);
    await localDb().syncMetadata.put({ ...metadata, lastPushedAt: now, lastError: null });
  },

  async recordError(userId: string, error: string): Promise<void> {
    const metadata = await this.ensure(userId);
    await localDb().syncMetadata.put({ ...metadata, lastError: error });
  },

  async clearForUser(userId: string): Promise<void> {
    await localDb().syncMetadata.delete(userId);
  },
};

/**
 * Cached server read models, so the app opens with something on screen.
 *
 * Explicitly a convenience copy. Anything here can be dropped without losing user
 * data - which is why it is a separate table from the entity stores, where a row may be
 * the only copy of an expense the user recorded on a train
 * (docs/08-OFFLINE-SYNC.md section 47).
 */
export const localCachedViewRepository = {
  async put(userId: string, key: string, payload: unknown, now: Date = new Date()): Promise<void> {
    await localDb().cachedViews.put({ key: cacheKey(userId, key), userId, payload, cachedAt: now });
  },

  async get<T>(userId: string, key: string): Promise<{ payload: T; cachedAt: Date } | null> {
    const record = await localDb().cachedViews.get(cacheKey(userId, key));
    if (!record || record.userId !== userId) return null;
    return { payload: record.payload as T, cachedAt: record.cachedAt };
  },

  async list(userId: string): Promise<LocalCachedView[]> {
    return localDb().cachedViews.where("userId").equals(userId).toArray();
  },

  async clearForUser(userId: string): Promise<void> {
    await localDb().cachedViews.where("userId").equals(userId).delete();
  },
};

/** Namespaced so two users in one browser cannot read each other's cached views. */
function cacheKey(userId: string, key: string): string {
  return `${userId}:${key}`;
}
