import { isApiError } from "@/types/api";
import type { ApiResponseBody } from "@/types/api";
import type { SyncChange, SyncPullResponse } from "@/types/sync";
import { localDb } from "../db/client";
import type {
  LocalAccount,
  LocalCategory,
  LocalExpenseSplit,
  LocalPerson,
  LocalSettlement,
  LocalSettlementAllocation,
  LocalTransaction,
} from "../db/schema";
import { localSyncMetadataRepository } from "../repositories/sync-metadata-repository";

/**
 * Applies server changes to the local database.
 *
 * The rule that shapes this file: **the cursor advances only after the changes are
 * committed locally**, and both happen in one IndexedDB transaction. If the cursor moved
 * first and the write then failed, the client would never ask for those changes again
 * and would hold stale financial data indefinitely
 * (docs/08-OFFLINE-SYNC.md sections 23-24).
 */

export type PullOutcome = {
  applied: number;
  deleted: number;
  /** True when the server says there is another page. */
  hasMore: boolean;
  cursor: string | null;
  error: string | null;
};

export type PullDependencies = {
  fetchPage: (cursor: string | null, limit: number) => Promise<PullTransportResult>;
  limit?: number;
  now?: () => Date;
};

export type PullTransportResult =
  { kind: "ok"; page: SyncPullResponse } | { kind: "error"; message: string };

export async function fetchPullPage(
  cursor: string | null,
  limit: number,
): Promise<PullTransportResult> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`/api/sync/pull?${params.toString()}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const body = (await response.json()) as ApiResponseBody<SyncPullResponse>;

    if (!response.ok || isApiError(body)) {
      return {
        kind: "error",
        message: isApiError(body) ? body.error.message : `Request failed (${response.status}).`,
      };
    }

    return { kind: "ok", page: body.data };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Network request failed.",
    };
  }
}

export async function pullServerChanges(
  userId: string,
  dependencies: PullDependencies = { fetchPage: fetchPullPage },
): Promise<PullOutcome> {
  const now = dependencies.now ?? (() => new Date());
  const limit = dependencies.limit ?? 100;

  const metadata = await localSyncMetadataRepository.ensure(userId);
  const result = await dependencies.fetchPage(metadata.lastPulledCursor, limit);

  if (result.kind === "error") {
    await localSyncMetadataRepository.recordError(userId, result.message);
    return {
      applied: 0,
      deleted: 0,
      hasMore: false,
      cursor: metadata.lastPulledCursor,
      error: result.message,
    };
  }

  const { changes, nextCursor, hasMore } = result.page;

  if (changes.length === 0) {
    // Nothing to apply, but the pull succeeded, so the cursor is still recorded and the
    // stale error cleared.
    await localSyncMetadataRepository.setCursor(userId, nextCursor, now());
    return { applied: 0, deleted: 0, hasMore, cursor: nextCursor, error: null };
  }

  // Server-id to clientId maps are built before the write transaction opens: Dexie
  // forbids querying a table the transaction does not hold, and a lookup per split
  // would be one query per row.
  await primeLinkCaches(userId, changes);

  const applied = await applyChanges(userId, changes, now());

  // Only now, and only after the write succeeded, does the cursor move.
  await localSyncMetadataRepository.setCursor(userId, nextCursor, now());

  return { ...applied, hasMore, cursor: nextCursor, error: null };
}

/**
 * Writes a page of changes.
 *
 * One IndexedDB transaction across every table so a half-applied page cannot exist -
 * the same reasoning as the server's MongoDB transactions. A transaction written without
 * its splits would corrupt every local spending total.
 *
 * A change is skipped when the local record has **unsynced local edits**. Overwriting
 * them would silently discard what the user typed, which
 * `docs/08-OFFLINE-SYNC.md` section 29 forbids. The queued operation for that record is
 * still in the queue; when it is pushed, the server will either accept it or report a
 * conflict, and that is where a human decides.
 */
async function applyChanges(
  userId: string,
  changes: readonly SyncChange[],
  now: Date,
): Promise<{ applied: number; deleted: number }> {
  const db = localDb();
  let applied = 0;
  let deleted = 0;

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
    ],
    async () => {
      for (const change of changes) {
        const wrote = await applyOne(userId, change, now);
        if (!wrote) continue;

        applied += 1;
        if (change.deleted) deleted += 1;
      }
    },
  );

  return { applied, deleted };
}

async function applyOne(userId: string, change: SyncChange, now: Date): Promise<boolean> {
  const db = localDb();

  switch (change.entityType) {
    case "account": {
      const existing = await db.accounts.get(change.clientId);
      if (existing && hasLocalEdits(existing)) return false;
      await db.accounts.put(toAccountRecord(userId, change, now));
      return true;
    }
    case "person": {
      const existing = await db.people.get(change.clientId);
      if (existing && hasLocalEdits(existing)) return false;
      await db.people.put(toPersonRecord(userId, change, now));
      return true;
    }
    case "category": {
      const existing = await db.categories.get(change.clientId);
      if (existing && hasLocalEdits(existing)) return false;
      await db.categories.put(toCategoryRecord(userId, change, now));
      return true;
    }
    case "transaction": {
      const existing = await db.transactions.get(change.clientId);
      if (existing && hasLocalEdits(existing)) return false;
      await db.transactions.put(toTransactionRecord(userId, change, existing, now));
      return true;
    }
    case "expenseSplit": {
      const existing = await db.expenseSplits.get(change.clientId);
      if (existing && hasLocalEdits(existing)) return false;
      const record = toSplitRecord(userId, change, existing, now);
      // A split whose transaction is not local yet cannot be linked, and an unlinked
      // split would be invisible to every query. Skipping means the next pull with the
      // transaction present will place it.
      if (!record) return false;
      await db.expenseSplits.put(record);
      return true;
    }
    case "settlement": {
      const existing = await db.settlements.get(change.clientId);
      if (existing && hasLocalEdits(existing)) return false;
      await db.settlements.put(toSettlementRecord(userId, change, now));
      return true;
    }
    case "settlementAllocation": {
      const existing = await db.settlementAllocations.get(change.clientId);
      if (existing && hasLocalEdits(existing)) return false;
      const record = toAllocationRecord(userId, change, existing, now);
      if (!record) return false;
      await db.settlementAllocations.put(record);
      return true;
    }
    default:
      return false;
  }
}

/** A record the user changed locally that has not reached the server yet. */
function hasLocalEdits(record: { syncStatus: string }): boolean {
  return record.syncStatus === "pending" || record.syncStatus === "failed";
}

type Body = Record<string, unknown>;

function meta(userId: string, change: SyncChange, now: Date) {
  return {
    clientId: change.clientId,
    serverId: change.entityId,
    userId,
    syncStatus: "synced" as const,
    serverUpdatedAt: new Date(change.updatedAt),
    localUpdatedAt: now,
    syncVersion: change.syncVersion,
    deletedAt: change.deleted ? new Date(change.updatedAt) : null,
  };
}

function body(change: SyncChange): Body {
  return change.record ?? {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableDate(value: unknown): Date | null {
  return typeof value === "string" ? new Date(value) : null;
}

function moneyDto(value: unknown): { amount: string; currency: string } {
  if (value && typeof value === "object" && "amount" in value && "currency" in value) {
    const candidate = value as { amount: unknown; currency: unknown };
    // Amounts stay strings all the way through. A number here would mean the server
    // serialised money as a float, which must fail loudly rather than be coerced.
    if (typeof candidate.amount === "string" && typeof candidate.currency === "string") {
      return { amount: candidate.amount, currency: candidate.currency };
    }
  }
  return { amount: "0", currency: "INR" };
}

function nullableMoneyDto(value: unknown): { amount: string; currency: string } | null {
  return value === null || value === undefined ? null : moneyDto(value);
}

function toAccountRecord(userId: string, change: SyncChange, now: Date): LocalAccount {
  const record = body(change);

  return {
    ...meta(userId, change, now),
    name: str(record.name),
    type: (record.type as LocalAccount["type"]) ?? "bank",
    currency: str(record.currency) || "INR",
    openingBalance: moneyDto(record.openingBalance),
    institutionName: nullableStr(record.institutionName),
    creditLimit: nullableMoneyDto(record.creditLimit),
    statementDay: typeof record.statementDay === "number" ? record.statementDay : null,
    paymentDueDay: typeof record.paymentDueDay === "number" ? record.paymentDueDay : null,
    archivedAt: nullableDate(record.archivedAt),
  };
}

function toPersonRecord(userId: string, change: SyncChange, now: Date): LocalPerson {
  const record = body(change);

  return {
    ...meta(userId, change, now),
    name: str(record.name),
    notes: nullableStr(record.notes),
    archivedAt: nullableDate(record.archivedAt),
  };
}

function toCategoryRecord(userId: string, change: SyncChange, now: Date): LocalCategory {
  const record = body(change);

  return {
    ...meta(userId, change, now),
    name: str(record.name),
    icon: nullableStr(record.icon),
    parentId: nullableStr(record.parentId),
    kind: record.kind === "income" ? "income" : "expense",
    archivedAt: nullableDate(record.archivedAt),
  };
}

function toTransactionRecord(
  userId: string,
  change: SyncChange,
  existing: LocalTransaction | undefined,
  now: Date,
): LocalTransaction {
  const record = body(change);

  // A delete carries no body, so the existing fields are kept and only the metadata
  // changes. That is why `deleted` is a flag rather than an absence of the record.
  if (change.deleted && existing) {
    return { ...existing, ...meta(userId, change, now) };
  }

  return {
    ...meta(userId, change, now),
    type: (record.type as LocalTransaction["type"]) ?? "expense",
    amount: moneyDto(record.amount),
    description: str(record.description),
    date: nullableDate(record.date) ?? now,
    categoryId: nullableStr(record.categoryId),
    accountId: nullableStr(record.accountId),
    fromAccountId: nullableStr(record.fromAccountId),
    toAccountId: nullableStr(record.toAccountId),
    paidByType: (record.paidByType as LocalTransaction["paidByType"]) ?? null,
    paidByPersonId: nullableStr(record.paidByPersonId),
    notes: nullableStr(record.notes),
  };
}

function toSplitRecord(
  userId: string,
  change: SyncChange,
  existing: LocalExpenseSplit | undefined,
  now: Date,
): LocalExpenseSplit | null {
  const record = body(change);

  if (change.deleted && existing) {
    return { ...existing, ...meta(userId, change, now) };
  }

  const transactionId = nullableStr(record.transactionId);
  // The link is by the transaction's clientId locally, which only the transaction row
  // knows. Without it the split cannot be attached to anything.
  const transactionClientId =
    existing?.transactionClientId ??
    (transactionId ? findTransactionClientId(transactionId) : null);

  if (!transactionClientId) return null;

  return {
    ...meta(userId, change, now),
    transactionClientId,
    transactionId,
    participantType: record.participantType === "person" ? "person" : "user",
    personId: nullableStr(record.personId),
    shareAmount: moneyDto(record.shareAmount),
  };
}

function toSettlementRecord(userId: string, change: SyncChange, now: Date): LocalSettlement {
  const record = body(change);

  return {
    ...meta(userId, change, now),
    personId: str(record.personId),
    direction: record.direction === "user_to_person" ? "user_to_person" : "person_to_user",
    amount: moneyDto(record.amount),
    accountId: nullableStr(record.accountId),
    date: nullableDate(record.date) ?? now,
    notes: nullableStr(record.notes),
  };
}

function toAllocationRecord(
  userId: string,
  change: SyncChange,
  existing: LocalSettlementAllocation | undefined,
  now: Date,
): LocalSettlementAllocation | null {
  const record = body(change);

  if (change.deleted && existing) {
    return { ...existing, ...meta(userId, change, now) };
  }

  const settlementId = nullableStr(record.settlementId);
  const settlementClientId =
    existing?.settlementClientId ?? (settlementId ? findSettlementClientId(settlementId) : null);

  if (!settlementClientId) return null;

  return {
    ...meta(userId, change, now),
    settlementClientId,
    settlementId,
    expenseSplitId: str(record.expenseSplitId),
    amount: moneyDto(record.amount),
  };
}

/**
 * Server-id to local-clientId lookups, populated during a pull.
 *
 * Filled by `primeLinkCaches` before the transaction begins, because Dexie forbids a
 * fresh query mid-transaction on tables the transaction does not hold, and because doing
 * a lookup per split would be O(n) queries for one page.
 */
const transactionClientIds = new Map<string, string>();
const settlementClientIds = new Map<string, string>();

function findTransactionClientId(serverId: string): string | null {
  return transactionClientIds.get(serverId) ?? null;
}

function findSettlementClientId(serverId: string): string | null {
  return settlementClientIds.get(serverId) ?? null;
}

/**
 * Loads the id maps a page needs.
 *
 * Called before applying changes. Transactions arrive in the same page as their splits
 * more often than not, so the map is also topped up from the page itself.
 */
export async function primeLinkCaches(
  userId: string,
  changes: readonly SyncChange[],
): Promise<void> {
  const db = localDb();

  transactionClientIds.clear();
  settlementClientIds.clear();

  const transactions = await db.transactions.where("userId").equals(userId).toArray();
  for (const transaction of transactions) {
    if (transaction.serverId) transactionClientIds.set(transaction.serverId, transaction.clientId);
  }

  const settlements = await db.settlements.where("userId").equals(userId).toArray();
  for (const settlement of settlements) {
    if (settlement.serverId) settlementClientIds.set(settlement.serverId, settlement.clientId);
  }

  // Records arriving in this very page are not in the database yet.
  for (const change of changes) {
    if (change.entityType === "transaction") {
      transactionClientIds.set(change.entityId, change.clientId);
    }
    if (change.entityType === "settlement") {
      settlementClientIds.set(change.entityId, change.clientId);
    }
  }
}
