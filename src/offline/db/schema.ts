import type {
  AccountType,
  MoneyDto,
  ParticipantType,
  SettlementDirection,
  TransactionType,
} from "@/types/common";
import type { SyncOperationType } from "@/types/sync";

/**
 * Shape of the local IndexedDB database.
 *
 * Two rules govern every type in this file.
 *
 * **Money is a string, never a number.** Records go through IndexedDB's structured
 * clone, which would happily store a JavaScript float and hand back a value that no
 * longer sums exactly. Every amount is a `MoneyDto` - a decimal string plus a
 * currency - exactly as it travels over the wire
 * (docs/06-CODING-PRACTICES.md section 55).
 *
 * **A `Money` instance must never be stored.** Structured clone drops the prototype,
 * so a stored `Money` comes back as a bare object with no methods. Conversion happens
 * at the repository boundary in `record-mapping.ts`.
 *
 * `Date` is safe: structured clone preserves it.
 */

/**
 * Whether a local record has reached the server.
 *
 * `pending` means the record exists locally and an operation is queued for it.
 * `failed` means the server rejected it permanently and the user must act - the local
 * record is kept regardless, because losing it would lose the user's data
 * (docs/08-OFFLINE-SYNC.md sections 20 and 50, rule 8).
 */
export type SyncStatus = "synced" | "pending" | "failed";

/**
 * Metadata every locally stored entity carries.
 *
 * `clientId` is the primary key, not the server id: a record created offline has no
 * server id yet, and the client must still be able to read, edit and delete it
 * (docs/08-OFFLINE-SYNC.md section 7).
 */
export type LocalRecordMeta = {
  /** Stable client-generated UUID. Primary key. */
  clientId: string;
  /** Server id once the record has been created there. */
  serverId: string | null;
  /** Owning user, so a shared browser profile cannot mix two users' data. */
  userId: string;
  syncStatus: SyncStatus;
  /** Server's `updatedAt`, used to detect that the server copy moved on. */
  serverUpdatedAt: Date | null;
  /** Local clock. Only ever compared with other local values. */
  localUpdatedAt: Date;
  /** Server's optimistic-concurrency counter, absent until first sync. */
  syncVersion: number | null;
  deletedAt: Date | null;
};

export type LocalAccount = LocalRecordMeta & {
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: MoneyDto;
  institutionName: string | null;
  creditLimit: MoneyDto | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  archivedAt: Date | null;
};

export type LocalPerson = LocalRecordMeta & {
  name: string;
  notes: string | null;
  archivedAt: Date | null;
};

export type LocalCategory = LocalRecordMeta & {
  name: string;
  icon: string | null;
  parentId: string | null;
  kind: "expense" | "income";
  archivedAt: Date | null;
};

/**
 * A financial event, local copy.
 *
 * `paidByType` and `paidByPersonId` are flattened rather than nested because Dexie
 * can only index top-level properties, and "everything involving Arun" is a query the
 * app makes constantly.
 */
export type LocalTransaction = LocalRecordMeta & {
  type: TransactionType;
  amount: MoneyDto;
  description: string;
  date: Date;
  categoryId: string | null;
  accountId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  paidByType: ParticipantType | null;
  paidByPersonId: string | null;
  notes: string | null;
};

export type LocalExpenseSplit = LocalRecordMeta & {
  /** `clientId` of the owning transaction, so the link survives before sync. */
  transactionClientId: string;
  /** Server id of the transaction, once known. */
  transactionId: string | null;
  participantType: ParticipantType;
  personId: string | null;
  shareAmount: MoneyDto;
};

export type LocalSettlement = LocalRecordMeta & {
  personId: string;
  direction: SettlementDirection;
  amount: MoneyDto;
  accountId: string | null;
  date: Date;
  notes: string | null;
};

export type LocalSettlementAllocation = LocalRecordMeta & {
  settlementClientId: string;
  settlementId: string | null;
  expenseSplitId: string;
  amount: MoneyDto;
};

/**
 * The queue stores the **same** operation vocabulary the server accepts.
 *
 * Re-exported from `types/sync.ts` rather than redeclared. A local copy would drift,
 * and the first symptom would be a queued command the push endpoint rejects as unknown -
 * with the user's expense stuck in the queue and no obvious reason why.
 *
 * These are domain commands, not row mutations: `CREATE_SHARED_EXPENSE` carries the
 * transaction and all its splits so the server can validate and persist the whole
 * business event atomically (docs/08-OFFLINE-SYNC.md sections 11-12).
 */
export type { SyncOperationType } from "@/types/sync";

/**
 * Local queue status.
 *
 * `completed` exists in the type but is never stored - a completed operation is deleted.
 * It is kept so the local and server status vocabularies line up.
 */
export type SyncOperationStatus = "pending" | "processing" | "failed" | "completed";

export type LocalSyncOperation = {
  /** Unique per attempt-set, and the primary key. */
  operationId: string;
  userId: string;
  type: SyncOperationType;
  /** `clientId` of the entity this command is about. */
  clientId: string;
  /**
   * The command body, already in the shape the API expects.
   *
   * Stored built rather than reconstructed at send time: the record it came from may
   * have been edited or deleted since, and the queued command must describe what the
   * user did at the time.
   */
  payload: Record<string, unknown>;
  status: SyncOperationStatus;
  retryCount: number;
  /** Earliest time a retry may be attempted, for exponential backoff. */
  nextRetryAt: Date | null;
  lastError: string | null;
  lastErrorCode: string | null;
  lastAttemptAt: Date | null;
  /** Which install produced this, for diagnosing sync problems. */
  deviceId: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Per-user sync bookkeeping.
 *
 * One row per user, keyed by `userId`, so switching accounts in the same browser does
 * not inherit the previous user's cursor.
 */
export type LocalSyncMetadata = {
  userId: string;
  deviceId: string;
  /** Opaque server cursor; only advanced after changes are applied locally. */
  lastPulledCursor: string | null;
  lastPulledAt: Date | null;
  lastPushedAt: Date | null;
  /** Set when the last attempt failed, so the UI can explain itself. */
  lastError: string | null;
};

/**
 * Cached read models, so the app opens with something to show.
 *
 * Keyed by a caller-defined string (e.g. `"dashboard"`). Deliberately separate from
 * the entity tables: this is a convenience copy of a server response and may be
 * discarded at any time, whereas the entity tables can hold the only copy of the
 * user's unsynced data (docs/08-OFFLINE-SYNC.md section 47).
 */
export type LocalCachedView = {
  key: string;
  userId: string;
  payload: unknown;
  cachedAt: Date;
};

/**
 * Dexie index declarations.
 *
 * `&clientId` marks a unique primary key. Compound indexes exist for the queries the
 * app actually runs - the lists are always scoped to one user, so `userId` leads.
 */
export const TABLE_SCHEMA_V1 = {
  accounts: "&clientId, userId, serverId, syncStatus, [userId+archivedAt], [userId+deletedAt]",
  people: "&clientId, userId, serverId, syncStatus, [userId+archivedAt], [userId+deletedAt]",
  categories:
    "&clientId, userId, serverId, syncStatus, kind, [userId+kind], [userId+deletedAt], parentId",
  transactions:
    "&clientId, userId, serverId, syncStatus, date, type, accountId, categoryId, paidByPersonId, [userId+date], [userId+type], [userId+deletedAt]",
  expenseSplits:
    "&clientId, userId, serverId, syncStatus, transactionClientId, transactionId, personId, [userId+transactionClientId], [userId+personId]",
  settlements:
    "&clientId, userId, serverId, syncStatus, personId, date, [userId+personId], [userId+date], [userId+deletedAt]",
  settlementAllocations:
    "&clientId, userId, serverId, syncStatus, settlementClientId, settlementId, expenseSplitId, [userId+settlementClientId]",
  syncOperations:
    "&operationId, userId, clientId, status, type, nextRetryAt, [userId+status], [userId+clientId]",
  syncMetadata: "&userId",
  cachedViews: "&key, userId, [userId+key]",
} as const;

export type TableName = keyof typeof TABLE_SCHEMA_V1;
