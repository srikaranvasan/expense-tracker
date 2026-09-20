import { ERROR_CODES, isAppError, isRetryableErrorCode, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import type { User } from "@/domain/users/entities";
import { syncOperationRepository } from "@/server/repositories/mongo/sync-operation-repository";
import type { SyncEntityType, SyncOperationResult, SyncPushOperation } from "@/types/sync";
import { dispatchSyncOperation } from "./operation-dispatch";

/**
 * Processes a batch of queued client operations.
 *
 * Three properties matter more than anything else here.
 *
 * **Operations are independent.** One failing must not abort the rest: a user who
 * queued eight expenses offline and got one wrong should have seven of them land
 * (docs/10-API-CONTRACT.md section 26). So each is wrapped individually and the batch
 * always returns a result per operation.
 *
 * **Idempotency is enforced by the database, not by a check.** `claim()` inserts into
 * the ledger and relies on the unique `(userId, operationId)` index, so two devices
 * pushing the same operation at the same moment cannot both proceed
 * (docs/08-OFFLINE-SYNC.md section 18).
 *
 * **The user comes from the session, never the payload.** `userId` is taken from the
 * authenticated request and passed down; a `userId` in a sync payload is ignored
 * entirely (docs/08-OFFLINE-SYNC.md section 38).
 */

export async function processSyncPush(
  user: User,
  operations: readonly SyncPushOperation[],
): Promise<SyncOperationResult[]> {
  const results: SyncOperationResult[] = [];

  // Sequential on purpose. The client queues in dependency order - a person before the
  // expense that references them - and running the batch concurrently would break that
  // ordering (docs/08-OFFLINE-SYNC.md section 43).
  for (const operation of operations) {
    results.push(await processOne(user, operation));
  }

  return results;
}

async function processOne(user: User, operation: SyncPushOperation): Promise<SyncOperationResult> {
  const operations = syncOperationRepository();

  const claim = await operations.claim(user.id, {
    operationId: operation.operationId,
    operationType: operation.type,
    clientId: operation.clientId,
  });

  if (claim.status === "duplicate") {
    return replayResult(operation, claim.record);
  }

  try {
    const outcome = await dispatchSyncOperation(user, operation);

    await operations.complete(user.id, operation.operationId, {
      entityId: outcome.entityId,
      entityType: outcome.entityType,
    });

    logger.info("sync operation applied", {
      operation: "sync.push",
      userId: user.id,
      entityType: outcome.entityType,
      entityId: outcome.entityId,
      detail: operation.type,
    });

    return {
      operationId: operation.operationId,
      status: "completed",
      entityId: outcome.entityId,
      entityType: outcome.entityType,
    };
  } catch (error) {
    return handleFailure(user.id, operation, error);
  }
}

/**
 * Returns the stored outcome of an operation the server already processed.
 *
 * This is what makes a retry safe. The client resends because it never saw the first
 * response, not because it wants a second expense.
 */
function replayResult(
  operation: SyncPushOperation,
  record: {
    status: string;
    result: { entityId: string; entityType: string } | null;
    errorCode: string | null;
  },
): SyncOperationResult {
  if (record.status === "completed" && record.result) {
    return {
      operationId: operation.operationId,
      status: "duplicate",
      entityId: record.result.entityId,
      entityType: record.result.entityType as SyncEntityType,
    };
  }

  if (record.status === "failed") {
    return {
      operationId: operation.operationId,
      status: "failed",
      error: {
        code: record.errorCode ?? ERROR_CODES.INTERNAL_ERROR,
        message: "This operation was already rejected.",
        retryable: false,
      },
    };
  }

  // Still `processing`: a previous attempt claimed it and died before finishing. Telling
  // the client to retry is safe and is the only way the operation ever completes.
  return {
    operationId: operation.operationId,
    status: "failed",
    error: {
      code: ERROR_CODES.SYNC_RETRYABLE_ERROR,
      message: "This operation is still being processed. Try again shortly.",
      retryable: true,
    },
  };
}

/**
 * Turns a thrown error into a per-operation result.
 *
 * The retryable/permanent split is the important judgement. A retryable failure
 * **releases** the claim so the next attempt can run; a permanent one records the
 * rejection so a replay returns the same answer instead of re-running a doomed
 * operation (docs/08-OFFLINE-SYNC.md sections 19-20).
 */
async function handleFailure(
  userId: string,
  operation: SyncPushOperation,
  error: unknown,
): Promise<SyncOperationResult> {
  const operations = syncOperationRepository();
  const appError = toAppError(error);
  const conflict = appError.code === ERROR_CODES.SYNC_CONFLICT;
  const retryable = isRetryableErrorCode(appError.code);

  if (retryable) {
    await operations.release(userId, operation.operationId);
  } else {
    await operations.fail(userId, operation.operationId, appError.code);
  }

  if (!isAppError(error)) {
    logger.error("sync operation failed unexpectedly", {
      operation: "sync.push",
      userId,
      errorCode: appError.code,
      detail: operation.type,
    });
  }

  return {
    operationId: operation.operationId,
    status: conflict ? "conflict" : "failed",
    error: {
      code: appError.code,
      message: appError.userMessage,
      retryable,
      ...(appError.details ? { details: appError.details } : {}),
    },
  };
}
