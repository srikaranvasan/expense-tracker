import { closeLocalDb, isOfflineStorageAvailable, localDb } from "./db/client";
import { localSyncOperationRepository } from "./repositories/sync-operation-repository";
import {
  getDeviceId,
  localCachedViewRepository,
  localSyncMetadataRepository,
} from "./repositories/sync-metadata-repository";
import { localSettlementRepository } from "./repositories/settlement-repository";
import { localTransactionRepository } from "./repositories/transaction-repository";
import {
  localAccountRepository,
  localCategoryRepository,
  localPersonRepository,
} from "./repositories/reference-repository";

/**
 * Entry point for the offline layer.
 *
 * Features import from here rather than reaching for a repository or the Dexie handle
 * directly, so there is one place to see what local storage can do
 * (docs/05-FOLDER-STRUCTURE.md section 12).
 */

export const localStore = {
  accounts: localAccountRepository,
  people: localPersonRepository,
  categories: localCategoryRepository,
  transactions: localTransactionRepository,
  settlements: localSettlementRepository,
  syncQueue: localSyncOperationRepository,
  syncMetadata: localSyncMetadataRepository,
  cachedViews: localCachedViewRepository,
} as const;

export type OfflineReadiness = {
  available: boolean;
  deviceId: string;
  /** Operations returned to `pending` after an interrupted send. */
  recoveredOperations: number;
  pendingOperations: number;
  failedOperations: number;
};

/**
 * Prepares local storage for a signed-in user.
 *
 * Call once per session, after sign-in. Two things happen that must happen at startup
 * and nowhere else:
 *
 * 1. **Interrupted operations are recovered.** An operation left in `processing` because
 *    the browser closed mid-send would otherwise never be retried. Resending is safe
 *    because every operation is idempotent (docs/08-OFFLINE-SYNC.md section 42).
 * 2. **Persistent storage is requested.** Without it the browser may evict IndexedDB
 *    under pressure, which for this app can mean discarding expenses that never reached
 *    the server.
 */
export async function initialiseOfflineStorage(userId: string): Promise<OfflineReadiness> {
  const deviceId = getDeviceId();

  if (!isOfflineStorageAvailable()) {
    return {
      available: false,
      deviceId,
      recoveredOperations: 0,
      pendingOperations: 0,
      failedOperations: 0,
    };
  }

  await localSyncMetadataRepository.ensure(userId, deviceId);

  const recoveredOperations = await localSyncOperationRepository.recoverInterrupted(userId);
  const counts = await localSyncOperationRepository.countByStatus(userId);

  return {
    available: true,
    deviceId,
    recoveredOperations,
    pendingOperations: counts.pending,
    failedOperations: counts.failed,
  };
}

/**
 * Removes everything belonging to one user.
 *
 * For sign-out on a shared device. **Destroys unsynced local records**, so it must only
 * run on an explicit user action — never as error recovery, and never automatically on a
 * failed sync (docs/08-OFFLINE-SYNC.md section 50, rule 8).
 */
export async function clearLocalDataForUser(userId: string): Promise<void> {
  if (!isOfflineStorageAvailable()) return;

  const db = localDb();

  await db.transaction(
    "rw",
    [
      db.accounts,
      db.people,
      db.categories,
      db.transactions,
      db.expenseSplits,
      db.settlements,
      db.settlementAllocations,
      db.syncOperations,
      db.syncMetadata,
      db.cachedViews,
    ],
    async () => {
      await localAccountRepository
        .raw(userId)
        .then((records) => db.accounts.bulkDelete(records.map((r) => r.clientId)));
      await localPersonRepository
        .raw(userId)
        .then((records) => db.people.bulkDelete(records.map((r) => r.clientId)));
      await localCategoryRepository
        .raw(userId)
        .then((records) => db.categories.bulkDelete(records.map((r) => r.clientId)));

      await localTransactionRepository.clearForUser(userId);
      await localSettlementRepository.clearForUser(userId);
      await localSyncOperationRepository.clearForUser(userId);
      await localCachedViewRepository.clearForUser(userId);
      await localSyncMetadataRepository.clearForUser(userId);
    },
  );
}

/** How much is waiting to reach the server, for the status indicator. */
export async function getPendingWorkSummary(userId: string): Promise<{
  pending: number;
  failed: number;
  processing: number;
}> {
  if (!isOfflineStorageAvailable()) return { pending: 0, failed: 0, processing: 0 };

  const counts = await localSyncOperationRepository.countByStatus(userId);
  return { pending: counts.pending, failed: counts.failed, processing: counts.processing };
}

export { isOfflineStorageAvailable, closeLocalDb, getDeviceId };
