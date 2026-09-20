/** Shared vocabulary for the offline sync protocol. */

export type SyncEntityType =
  | "account"
  | "person"
  | "category"
  | "transaction"
  | "expenseSplit"
  | "settlement"
  | "settlementAllocation";

/**
 * Sync units are business operations, not raw row mutations, so the server has a
 * meaningful command to validate (docs/08-OFFLINE-SYNC.md section 12).
 */
export type SyncOperationType =
  | "CREATE_ACCOUNT"
  | "UPDATE_ACCOUNT"
  | "ARCHIVE_ACCOUNT"
  | "CREATE_PERSON"
  | "UPDATE_PERSON"
  | "ARCHIVE_PERSON"
  | "CREATE_CATEGORY"
  | "UPDATE_CATEGORY"
  | "ARCHIVE_CATEGORY"
  | "CREATE_EXPENSE"
  | "CREATE_SHARED_EXPENSE"
  | "UPDATE_EXPENSE"
  | "DELETE_EXPENSE"
  | "CREATE_TRANSFER"
  | "UPDATE_TRANSFER"
  | "DELETE_TRANSFER"
  | "CREATE_CREDIT_CARD_PAYMENT"
  | "DELETE_CREDIT_CARD_PAYMENT"
  | "CREATE_SETTLEMENT"
  | "DELETE_SETTLEMENT";

export type SyncOperationStatus = "pending" | "processing" | "completed" | "failed";

export type LocalSyncStatus = "synced" | "pending" | "failed";

export type SyncPushOperation = {
  operationId: string;
  type: SyncOperationType;
  clientId: string;
  payload: unknown;
  /** Version the client based its update on, for conflict detection. */
  baseSyncVersion?: number;
};

export type SyncPushRequest = {
  operations: SyncPushOperation[];
};

export type SyncOperationResult =
  | { operationId: string; status: "completed"; entityId: string; entityType: SyncEntityType }
  | { operationId: string; status: "duplicate"; entityId: string; entityType: SyncEntityType }
  | {
      operationId: string;
      status: "failed" | "conflict";
      error: {
        code: string;
        message: string;
        retryable: boolean;
        details?: Record<string, unknown>;
      };
    };

export type SyncPushResponse = {
  results: SyncOperationResult[];
};

/** One changed record in a pull response. */
export type SyncChange = {
  entityType: SyncEntityType;
  entityId: string;
  clientId: string;
  syncVersion: number;
  updatedAt: string;
  deleted: boolean;
  /** Absent when `deleted` is true. */
  record?: Record<string, unknown>;
};

export type SyncPullResponse = {
  changes: SyncChange[];
  nextCursor: string | null;
  hasMore: boolean;
  serverTime: string;
};
