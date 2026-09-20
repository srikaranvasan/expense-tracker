import { isApiError } from "@/types/api";
import type { ApiResponseBody } from "@/types/api";
import type { SyncChange } from "@/types/sync";
import type { LocalSyncOperation } from "../db/schema";
import { localSyncOperationRepository } from "../repositories/sync-operation-repository";

/**
 * What happens when the server says a record changed elsewhere.
 *
 * The one absolute rule: **financial values are never merged automatically.** Combining
 * a local ₹500 with a server ₹700 into ₹1,200 is the specific outcome
 * `docs/08-OFFLINE-SYNC.md` section 29 forbids, and no amount of cleverness makes it
 * acceptable. The server wins by default on *stored* state; the user's local edit is
 * preserved and surfaced so a person decides what it should become.
 *
 * The MVP deliberately builds no merge engine (section 28). This module's job is to
 * describe the conflict clearly enough that the user can resolve it.
 */

export type ConflictResolution =
  /** Discard the local edit and accept the server's version. */
  | "keep-server"
  /** Re-send the local edit, based on the server's current version. */
  | "keep-local";

export type SyncConflict = {
  operationId: string;
  operationType: LocalSyncOperation["type"];
  clientId: string;
  /** Version the client based its edit on. */
  clientVersion: number | null;
  /** Version the server holds now. */
  serverVersion: number | null;
  message: string;
};

/** Reads the conflict details the server attached to its error. */
export function toSyncConflict(
  operation: LocalSyncOperation,
  error: { message: string; details?: Record<string, unknown> },
): SyncConflict {
  const serverVersion = error.details?.serverVersion;
  const clientVersion = error.details?.clientVersion;

  return {
    operationId: operation.operationId,
    operationType: operation.type,
    clientId: operation.clientId,
    clientVersion: typeof clientVersion === "number" ? clientVersion : null,
    serverVersion: typeof serverVersion === "number" ? serverVersion : null,
    message: error.message,
  };
}

/** Every operation currently blocked on a conflict or a rejection. */
export async function listUnresolvedOperations(userId: string): Promise<LocalSyncOperation[]> {
  return localSyncOperationRepository.listByStatus(userId, "failed");
}

/**
 * Fetches the server's current copy of a record.
 *
 * The user cannot decide between their edit and the server's without seeing both
 * (docs/08-OFFLINE-SYNC.md section 28).
 */
export async function fetchCanonicalRecord(
  entityType: SyncChange["entityType"],
  entityId: string,
): Promise<SyncChange | null> {
  try {
    const params = new URLSearchParams({ entityType, entityId });

    const response = await fetch(`/api/sync/record?${params.toString()}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const paylod = (await response.json()) as ApiResponseBody<{ change: SyncChange }>;
    if (!response.ok || isApiError(paylod)) return null;

    return paylod.data.change;
  } catch {
    return null;
  }
}

/**
 * Applies the user's decision.
 *
 * `keep-server` discards the queued operation. The **local record is not deleted** — the
 * next pull overwrites it with the server's version, which is the same outcome by a route
 * that cannot lose data if the pull fails.
 *
 * `keep-local` re-queues the operation. The caller must first update its
 * `baseSyncVersion` to the server's current version, or the server will reject it again
 * for exactly the same reason.
 */
export async function resolveConflict(
  userId: string,
  operationId: string,
  resolution: ConflictResolution,
  options: { serverVersion?: number } = {},
): Promise<void> {
  if (resolution === "keep-server") {
    await localSyncOperationRepository.discard(operationId);
    return;
  }

  const operations = await localSyncOperationRepository.listByStatus(userId, "failed");
  const operation = operations.find((candidate) => candidate.operationId === operationId);
  if (!operation) return;

  const payload =
    options.serverVersion === undefined
      ? operation.payload
      : { ...operation.payload, baseSyncVersion: options.serverVersion };

  // Re-queued under the same operationId. The server's ledger recorded the first attempt
  // as failed, so it will process this one rather than replaying the rejection... which
  // is why `retryFailed` clears the retry count too.
  await localSyncOperationRepository.discard(operationId);
  await localSyncOperationRepository.enqueue({
    userId,
    type: operation.type,
    clientId: operation.clientId,
    payload,
    deviceId: operation.deviceId,
  });
}
