import { isApiError } from "@/types/api";
import type { ApiResponseBody } from "@/types/api";
import type { SyncOperationResult, SyncPushOperation, SyncPushResponse } from "@/types/sync";
import type { LocalSyncOperation } from "../db/schema";
import { localSyncOperationRepository } from "../repositories/sync-operation-repository";
import { localSyncMetadataRepository } from "../repositories/sync-metadata-repository";
import { localTransactionRepository } from "../repositories/transaction-repository";
import { localSettlementRepository } from "../repositories/settlement-repository";
import { hasExhaustedRetries, nextRetryAt } from "./backoff";
import {
  classifyHttpStatus,
  classifyOperationFailure,
  classifyTransportFailure,
  describeFailure,
} from "./error-classification";
import type { FailureKind } from "./error-classification";

/**
 * Sends queued operations to the server and records what happened.
 *
 * The engine contains **no financial calculations** — that is the server's job, and the
 * domain layer's (docs/08-OFFLINE-SYNC.md section 45). All this does is move commands,
 * interpret the answers, and update local bookkeeping.
 */

/** Batch size. Small enough that a failing batch is cheap to re-send. */
const PUSH_BATCH_SIZE = 20;

export type PushOutcome = {
  attempted: number;
  completed: number;
  failed: number;
  conflicted: number;
  retryScheduled: number;
  /** True when a transport failure means nothing was sent. */
  offline: boolean;
};

const EMPTY_OUTCOME: PushOutcome = {
  attempted: 0,
  completed: 0,
  failed: 0,
  conflicted: 0,
  retryScheduled: 0,
  offline: false,
};

export type PushDependencies = {
  /** Injectable so tests do not need a server. */
  send: (operations: SyncPushOperation[]) => Promise<PushTransportResult>;
  now?: () => Date;
  random?: () => number;
};

export type PushTransportResult =
  | { kind: "ok"; results: SyncOperationResult[] }
  /** The server answered, but rejected the whole batch. */
  | { kind: "http-error"; status: number; code: string | null; message: string }
  /** Nothing reached the server. */
  | { kind: "transport-error"; message: string };

/** Default transport: a POST to the sync endpoint. */
export async function sendPushRequest(
  operations: SyncPushOperation[],
): Promise<PushTransportResult> {
  try {
    const response = await fetch("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({ operations }),
    });

    const body = (await response.json()) as ApiResponseBody<SyncPushResponse>;

    if (!response.ok || isApiError(body)) {
      return {
        kind: "http-error",
        status: response.status,
        code: isApiError(body) ? body.error.code : null,
        message: isApiError(body) ? body.error.message : `Request failed (${response.status}).`,
      };
    }

    return { kind: "ok", results: body.data.results };
  } catch (error) {
    return {
      kind: "transport-error",
      message: error instanceof Error ? error.message : "Network request failed.",
    };
  }
}

export async function pushPendingOperations(
  userId: string,
  dependencies: PushDependencies = { send: sendPushRequest },
): Promise<PushOutcome> {
  const now = dependencies.now ?? (() => new Date());
  const random = dependencies.random ?? Math.random;

  const queued = await localSyncOperationRepository.listPending(userId, now());
  if (queued.length === 0) return EMPTY_OUTCOME;

  const batch = queued.slice(0, PUSH_BATCH_SIZE);

  // Claimed before sending so a second engine run in another tab does not send the same
  // operations. If this process dies now, startup recovery releases them.
  for (const operation of batch) {
    await localSyncOperationRepository.markProcessing(operation.operationId, now());
  }

  const transport = await dependencies.send(batch.map(toPushOperation));

  if (transport.kind === "transport-error") {
    // Nothing was sent, so nothing is judged. Every operation goes back to pending.
    for (const operation of batch) {
      await scheduleRetry(operation, transport.message, null, now(), random);
    }
    await localSyncMetadataRepository.recordError(userId, transport.message);
    return {
      ...EMPTY_OUTCOME,
      attempted: batch.length,
      retryScheduled: batch.length,
      offline: true,
    };
  }

  if (transport.kind === "http-error") {
    const kind = classifyHttpStatus(transport.status);

    for (const operation of batch) {
      if (kind === "retryable") {
        await scheduleRetry(operation, transport.message, transport.code, now(), random);
      } else {
        // A 400 on the envelope means the batch itself was malformed - a client bug.
        // Retrying it forever would never succeed.
        await localSyncOperationRepository.markFailed(
          operation.operationId,
          { error: transport.message, errorCode: transport.code },
          now(),
        );
      }
    }

    await localSyncMetadataRepository.recordError(userId, transport.message);

    return {
      ...EMPTY_OUTCOME,
      attempted: batch.length,
      ...(kind === "retryable" ? { retryScheduled: batch.length } : { failed: batch.length }),
    };
  }

  return applyResults(userId, batch, transport.results, now, random);
}

async function applyResults(
  userId: string,
  batch: readonly LocalSyncOperation[],
  results: readonly SyncOperationResult[],
  now: () => Date,
  random: () => number,
): Promise<PushOutcome> {
  const byOperationId = new Map(results.map((result) => [result.operationId, result]));
  const outcome = { ...EMPTY_OUTCOME, attempted: batch.length };

  for (const operation of batch) {
    const result = byOperationId.get(operation.operationId);

    if (!result) {
      // The server answered but said nothing about this operation. Treat as unknown and
      // retry: the operation is idempotent, so a second attempt is safe, whereas
      // assuming success could silently drop the record.
      await scheduleRetry(operation, "No result returned for this operation.", null, now(), random);
      outcome.retryScheduled += 1;
      continue;
    }

    if (result.status === "completed" || result.status === "duplicate") {
      // `duplicate` is a success: the server had already applied it, and now the client
      // knows the server id.
      await markLocalRecordSynced(userId, operation, result.entityId, now());
      await localSyncOperationRepository.complete(operation.operationId);
      outcome.completed += 1;
      continue;
    }

    const kind: FailureKind = classifyOperationFailure(result.error);

    if (kind === "retryable") {
      await scheduleRetry(operation, result.error.message, result.error.code, now(), random);
      outcome.retryScheduled += 1;
      continue;
    }

    // Conflict and permanent rejection both need the user, so both stop retrying. The
    // local record is left untouched either way.
    await localSyncOperationRepository.markFailed(
      operation.operationId,
      { error: result.error.message, errorCode: result.error.code },
      now(),
    );

    if (kind === "conflict") outcome.conflicted += 1;
    else outcome.failed += 1;
  }

  if (outcome.completed > 0) await localSyncMetadataRepository.recordPush(userId, now());

  return outcome;
}

/**
 * Schedules another attempt, or gives up if the operation has tried too many times.
 *
 * Giving up on a *retryable* failure is a judgement call: something that keeps looking
 * temporary but never resolves is, from the user's point of view, broken. Telling them
 * is better than an invisible queue that never drains.
 */
async function scheduleRetry(
  operation: LocalSyncOperation,
  message: string,
  code: string | null,
  now: Date,
  random: () => number,
): Promise<void> {
  if (hasExhaustedRetries(operation.retryCount)) {
    await localSyncOperationRepository.markFailed(
      operation.operationId,
      { error: `${message} (gave up after ${operation.retryCount} attempts)`, errorCode: code },
      now,
    );
    return;
  }

  await localSyncOperationRepository.markRetryable(
    operation.operationId,
    {
      nextRetryAt: nextRetryAt(operation.retryCount, now, random),
      error: message,
      errorCode: code,
    },
    now,
  );
}

/**
 * Records the server id on the local record and marks it synced.
 *
 * Until this happens the local record has no `serverId`, so it cannot be edited through
 * the REST routes or deleted server-side. Writing it is what completes the round trip.
 */
async function markLocalRecordSynced(
  userId: string,
  operation: LocalSyncOperation,
  entityId: string,
  now: Date,
): Promise<void> {
  if (operation.type === "CREATE_SETTLEMENT") {
    const local = await localSettlementRepository.findByClientId(userId, operation.clientId);
    if (!local) return;

    await localSettlementRepository.put(
      { ...local.settlement, serverId: entityId, syncStatus: "synced", localUpdatedAt: now },
      local.allocations.map((allocation) => ({
        ...allocation,
        settlementId: entityId,
        syncStatus: "synced" as const,
      })),
    );
    return;
  }

  const local = await localTransactionRepository.findByClientId(userId, operation.clientId);
  if (!local) return;

  await localTransactionRepository.put(
    { ...local.transaction, serverId: entityId, syncStatus: "synced", localUpdatedAt: now },
    local.splits.map((split) => ({
      ...split,
      transactionId: entityId,
      syncStatus: "synced" as const,
    })),
  );
}

function toPushOperation(operation: LocalSyncOperation): SyncPushOperation {
  const baseSyncVersion = operation.payload.baseSyncVersion;

  return {
    operationId: operation.operationId,
    type: operation.type,
    clientId: operation.clientId,
    payload: operation.payload,
    ...(typeof baseSyncVersion === "number" ? { baseSyncVersion } : {}),
  };
}

export { describeFailure, classifyTransportFailure };
