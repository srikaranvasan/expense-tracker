import { newOperationId } from "@/lib/utils/client-id";
import { localDb } from "../db/client";
import type { LocalSyncOperation, SyncOperationType } from "../db/schema";

/**
 * The durable sync queue.
 *
 * Durable is the point. A queue in React state or memory disappears when the tab
 * closes, and with it the record that the user's expense never reached the server
 * (docs/08-OFFLINE-SYNC.md section 10).
 *
 * Group 14 owns the storage. Group 15 owns the engine that drains it - backoff
 * scheduling, request sending, conflict handling. Everything here is bookkeeping.
 */

export type EnqueueOperation = {
  userId: string;
  type: SyncOperationType;
  /** `clientId` of the entity the command concerns. */
  clientId: string;
  payload: Record<string, unknown>;
  deviceId: string;
  operationId?: string;
};

export const localSyncOperationRepository = {
  /**
   * Adds an operation to the queue.
   *
   * The `operationId` is generated once and never regenerated, so a retry is
   * recognisable as the same operation rather than a second one
   * (docs/08-OFFLINE-SYNC.md section 7).
   */
  build(input: EnqueueOperation, now: Date = new Date()): LocalSyncOperation {
    return {
      operationId: input.operationId ?? newOperationId(),
      userId: input.userId,
      type: input.type,
      clientId: input.clientId,
      payload: input.payload,
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      lastErrorCode: null,
      lastAttemptAt: null,
      deviceId: input.deviceId,
      createdAt: now,
      updatedAt: now,
    };
  },

  async enqueue(input: EnqueueOperation, now: Date = new Date()): Promise<LocalSyncOperation> {
    const operation = this.build(input, now);
    await localDb().syncOperations.put(operation);
    return operation;
  },

  /**
   * Operations ready to send, oldest first.
   *
   * Insertion order is preserved deliberately: a person must exist on the server before
   * an expense can reference them, and creation order is the only ordering that
   * guarantees it (docs/08-OFFLINE-SYNC.md section 43).
   *
   * An operation whose `nextRetryAt` is in the future is skipped, which is how
   * exponential backoff is honoured without a timer.
   */
  async listPending(userId: string, now: Date = new Date()): Promise<LocalSyncOperation[]> {
    const operations = await localDb()
      .syncOperations.where("[userId+status]")
      .equals([userId, "pending"])
      .toArray();

    return operations
      .filter((operation) => operation.nextRetryAt === null || operation.nextRetryAt <= now)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async listByStatus(
    userId: string,
    status: LocalSyncOperation["status"],
  ): Promise<LocalSyncOperation[]> {
    const operations = await localDb()
      .syncOperations.where("[userId+status]")
      .equals([userId, status])
      .toArray();

    return operations.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  /** All operations queued for one entity, oldest first. */
  async listForEntity(userId: string, clientId: string): Promise<LocalSyncOperation[]> {
    const operations = await localDb()
      .syncOperations.where("[userId+clientId]")
      .equals([userId, clientId])
      .toArray();

    return operations.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async countByStatus(userId: string): Promise<Record<LocalSyncOperation["status"], number>> {
    const operations = await localDb().syncOperations.where("userId").equals(userId).toArray();

    const counts = { pending: 0, processing: 0, failed: 0, completed: 0 };
    for (const operation of operations) counts[operation.status] += 1;
    return counts;
  },

  async markProcessing(operationId: string, now: Date = new Date()): Promise<void> {
    await localDb().syncOperations.update(operationId, {
      status: "processing",
      lastAttemptAt: now,
      updatedAt: now,
    });
  },

  /**
   * Records a successful send and removes the operation.
   *
   * Deleted rather than kept as `completed`: the queue is a work list, not an audit
   * log, and an unbounded history of every expense ever created would consume storage
   * that unsynced records may need (docs/08-OFFLINE-SYNC.md section 47).
   */
  async complete(operationId: string): Promise<void> {
    await localDb().syncOperations.delete(operationId);
  },

  /** Schedules a retry after a temporary failure. */
  async markRetryable(
    operationId: string,
    options: { nextRetryAt: Date; error: string; errorCode?: string | null },
    now: Date = new Date(),
  ): Promise<void> {
    const db = localDb();
    const operation = await db.syncOperations.get(operationId);
    if (!operation) return;

    await db.syncOperations.put({
      ...operation,
      status: "pending",
      retryCount: operation.retryCount + 1,
      nextRetryAt: options.nextRetryAt,
      lastError: options.error,
      lastErrorCode: options.errorCode ?? null,
      lastAttemptAt: now,
      updatedAt: now,
    });
  },

  /**
   * Marks an operation permanently failed.
   *
   * The local record it refers to is **not** touched. A rejected operation means the
   * server would not accept the change, not that the user's data should vanish
   * (docs/08-OFFLINE-SYNC.md sections 20 and 50, rule 8).
   */
  async markFailed(
    operationId: string,
    options: { error: string; errorCode?: string | null },
    now: Date = new Date(),
  ): Promise<void> {
    const db = localDb();
    const operation = await db.syncOperations.get(operationId);
    if (!operation) return;

    await db.syncOperations.put({
      ...operation,
      status: "failed",
      retryCount: operation.retryCount + 1,
      nextRetryAt: null,
      lastError: options.error,
      lastErrorCode: options.errorCode ?? null,
      lastAttemptAt: now,
      updatedAt: now,
    });
  },

  /**
   * Returns operations stuck in `processing` to `pending`.
   *
   * Called at startup. If the browser closed mid-send, the operation is left claimed
   * and would never be retried. Resending is safe because every operation is
   * idempotent (docs/08-OFFLINE-SYNC.md section 42).
   */
  async recoverInterrupted(userId: string, now: Date = new Date()): Promise<number> {
    const db = localDb();
    const stuck = await db.syncOperations
      .where("[userId+status]")
      .equals([userId, "processing"])
      .toArray();

    if (stuck.length === 0) return 0;

    await db.syncOperations.bulkPut(
      stuck.map((operation) => ({
        ...operation,
        status: "pending" as const,
        nextRetryAt: null,
        updatedAt: now,
      })),
    );

    return stuck.length;
  },

  /** Lets the user re-attempt something that failed permanently. */
  async retryFailed(userId: string, now: Date = new Date()): Promise<number> {
    const db = localDb();
    const failed = await db.syncOperations
      .where("[userId+status]")
      .equals([userId, "failed"])
      .toArray();

    if (failed.length === 0) return 0;

    await db.syncOperations.bulkPut(
      failed.map((operation) => ({
        ...operation,
        status: "pending" as const,
        nextRetryAt: null,
        retryCount: 0,
        updatedAt: now,
      })),
    );

    return failed.length;
  },

  async discard(operationId: string): Promise<void> {
    await localDb().syncOperations.delete(operationId);
  },

  /** Drops every queued operation for one entity. Used by create-then-delete. */
  async discardForEntity(userId: string, clientId: string): Promise<number> {
    const db = localDb();
    const operations = await db.syncOperations
      .where("[userId+clientId]")
      .equals([userId, clientId])
      .toArray();

    await db.syncOperations.bulkDelete(operations.map((operation) => operation.operationId));
    return operations.length;
  },

  async clearForUser(userId: string): Promise<void> {
    await localDb().syncOperations.where("userId").equals(userId).delete();
  },
};
