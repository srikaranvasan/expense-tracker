import type { SyncOperationRecord } from "@/server/db/models/sync-operation";
import type { SyncOperationType } from "@/types/sync";
import type { RepositoryContext } from "./common";

export type ClaimOperationInput = {
  operationId: string;
  operationType: SyncOperationType;
  clientId: string;
};

export type ClaimOperationResult =
  | { status: "claimed" }
  /** Already processed: replay the stored result instead of re-running it. */
  | { status: "duplicate"; record: SyncOperationRecord };

/**
 * The idempotency ledger.
 *
 * `claim` inserts the operation and relies on the unique `(userId, operationId)`
 * index to detect a retry, which makes the check atomic even when two devices
 * push the same operation at the same moment
 * (docs/08-OFFLINE-SYNC.md section 18).
 */
export interface SyncOperationRepository {
  claim(
    userId: string,
    input: ClaimOperationInput,
    context?: RepositoryContext,
  ): Promise<ClaimOperationResult>;
  complete(
    userId: string,
    operationId: string,
    result: { entityId: string; entityType: string },
    context?: RepositoryContext,
  ): Promise<void>;
  fail(userId: string, operationId: string, errorCode: string): Promise<void>;
  /** Removes a claim so a retryable failure can be attempted again. */
  release(userId: string, operationId: string): Promise<void>;
  find(userId: string, operationId: string): Promise<SyncOperationRecord | null>;
}
