import Dexie from "dexie";
import type { Table } from "dexie";
import type {
  LocalAccount,
  LocalCachedView,
  LocalCategory,
  LocalExpenseSplit,
  LocalPerson,
  LocalSettlement,
  LocalSettlementAllocation,
  LocalSyncMetadata,
  LocalSyncOperation,
  LocalTransaction,
} from "./schema";
import { LOCAL_DB_NAME, applyMigrations } from "./migrations";

/**
 * The local database.
 *
 * Dexie is used rather than raw IndexedDB because the raw API is callback-driven and
 * would spread transaction plumbing across the app; the folder structure requires the
 * abstraction stay behind this layer (docs/05-FOLDER-STRUCTURE.md section 12,
 * docs/08-OFFLINE-SYNC.md section 4).
 *
 * Only `offline/repositories/*` should import this. Components go through a repository
 * so no React code ever holds a database handle.
 */

export class LocalDatabase extends Dexie {
  declare accounts: Table<LocalAccount, string>;
  declare people: Table<LocalPerson, string>;
  declare categories: Table<LocalCategory, string>;
  declare transactions: Table<LocalTransaction, string>;
  declare expenseSplits: Table<LocalExpenseSplit, string>;
  declare settlements: Table<LocalSettlement, string>;
  declare settlementAllocations: Table<LocalSettlementAllocation, string>;
  declare syncOperations: Table<LocalSyncOperation, string>;
  declare syncMetadata: Table<LocalSyncMetadata, string>;
  declare cachedViews: Table<LocalCachedView, string>;

  constructor(name: string = LOCAL_DB_NAME) {
    super(name);
    applyMigrations(this);
  }
}

/**
 * Whether IndexedDB can be used at all.
 *
 * False during server rendering, and false in a browser where storage is blocked -
 * Safari private browsing, and some embedded webviews. Callers must degrade to
 * server-only operation rather than crashing: an app that white-screens because it
 * cannot cache is worse than one that simply requires a connection
 * (docs/08-OFFLINE-SYNC.md section 49).
 */
export function isOfflineStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

let instance: LocalDatabase | null = null;

/**
 * The shared database handle.
 *
 * Throws when storage is unavailable, so a caller that has not checked
 * `isOfflineStorageAvailable()` fails loudly here rather than at an arbitrary later
 * query.
 */
export function localDb(): LocalDatabase {
  if (!isOfflineStorageAvailable()) {
    throw new Error(
      "IndexedDB is not available in this environment. " +
        "Check isOfflineStorageAvailable() before using local storage.",
    );
  }

  instance ??= new LocalDatabase();
  return instance;
}

/** Test and teardown helper. Closes the handle and forgets it. */
export async function closeLocalDb(): Promise<void> {
  const open = instance;
  instance = null;
  open?.close();
  return Promise.resolve();
}

/**
 * Replaces the shared handle. Tests only.
 *
 * Lets a test point the repositories at a uniquely named database so cases cannot see
 * each other's rows.
 */
export function setLocalDbForTesting(db: LocalDatabase | null): void {
  instance = db;
}

/**
 * Asks the browser to keep this data.
 *
 * Without a persistence grant, IndexedDB is "best effort" and the browser may evict it
 * under storage pressure - which for this app could mean discarding expenses that were
 * never synced. Returns whether storage is now persistent; a refusal is not an error,
 * it just raises the stakes on syncing promptly.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;

  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Rough storage usage, for a diagnostics screen. */
export async function estimateStorageUsage(): Promise<{
  usedBytes: number | null;
  quotaBytes: number | null;
}> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usedBytes: null, quotaBytes: null };
  }

  try {
    const estimate = await navigator.storage.estimate();
    return { usedBytes: estimate.usage ?? null, quotaBytes: estimate.quota ?? null };
  } catch {
    return { usedBytes: null, quotaBytes: null };
  }
}
