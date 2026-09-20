import type { ObjectId } from "mongodb";
import type { SyncOperationType } from "@/types/sync";

/**
 * Record of a processed sync operation.
 *
 * This is the idempotency ledger: a unique index on `(userId, operationId)` means
 * a retried offline write returns the original result instead of creating a second
 * financial record (docs/09-DATABASE-SCHEMA.md section 27).
 */
export type SyncOperationDocument = {
  _id: ObjectId;
  userId: ObjectId;
  /** Client-generated id for this attempt at this operation. */
  operationId: string;
  operationType: SyncOperationType;
  /** Client id of the entity the operation creates or changes. */
  clientId: string;
  status: "processing" | "completed" | "failed";
  /** Response replayed on a duplicate request. */
  result?: { entityId: string; entityType: string } | null;
  errorCode?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
};

export type SyncOperationRecord = {
  id: string;
  operationId: string;
  operationType: SyncOperationType;
  clientId: string;
  status: SyncOperationDocument["status"];
  result: { entityId: string; entityType: string } | null;
  errorCode: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export function toSyncOperationRecord(document: SyncOperationDocument): SyncOperationRecord {
  return {
    id: document._id.toHexString(),
    operationId: document.operationId,
    operationType: document.operationType,
    clientId: document.clientId,
    status: document.status,
    result: document.result ?? null,
    errorCode: document.errorCode ?? null,
    createdAt: document.createdAt,
    completedAt: document.completedAt ?? null,
  };
}
