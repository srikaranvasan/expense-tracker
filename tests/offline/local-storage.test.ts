import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/offline/db/client";
import { isOfflineStorageAvailable } from "@/offline/db/client";
import { LOCAL_DB_VERSION } from "@/offline/db/migrations";
import { localStore } from "@/offline/local-store";
import { clearLocalDataForUser, initialiseOfflineStorage } from "@/offline/local-store";
import { localSyncOperationRepository } from "@/offline/repositories/sync-operation-repository";
import {
  TEST_DEVICE_ID,
  TEST_USER_ID,
  buildLocalAllocation,
  buildLocalSettlement,
  buildLocalSplit,
  buildLocalTransaction,
  destroyLocalDb,
  freshLocalDb,
  inrDto,
} from "@tests/helpers/offline";

let db: LocalDatabase;

beforeEach(async () => {
  db = await freshLocalDb();
});

afterEach(async () => {
  await destroyLocalDb(db);
});

describe("local database", () => {
  it("is available in this environment", () => {
    expect(isOfflineStorageAvailable()).toBe(true);
  });

  it("creates every table the offline layer needs", () => {
    const tables = db.tables.map((table) => table.name).sort();

    expect(tables).toEqual([
      "accounts",
      "cachedViews",
      "categories",
      "expenseSplits",
      "people",
      "settlementAllocations",
      "settlements",
      "syncMetadata",
      "syncOperations",
      "transactions",
    ]);
  });

  it("opens at the declared version", () => {
    expect(db.verno).toBe(LOCAL_DB_VERSION);
  });
});

describe("transactions and splits", () => {
  it("stores a transaction with its splits and reads them back together", async () => {
    const transaction = buildLocalTransaction({ amount: inrDto("1000") });
    const splits = [
      buildLocalSplit(transaction.clientId, { shareAmount: inrDto("400") }),
      buildLocalSplit(transaction.clientId, {
        participantType: "person",
        personId: "person-1",
        shareAmount: inrDto("600"),
      }),
    ];

    await localStore.transactions.put(transaction, splits);

    const found = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);

    expect(found?.transaction.description).toBe("Groceries");
    expect(found?.splits).toHaveLength(2);
  });

  it("keeps amounts as exact decimal strings", async () => {
    // The value that motivates the rule: 0.1 + 0.2 is not 0.3 in binary floating point.
    const transaction = buildLocalTransaction({ amount: inrDto("1234567.89") });
    await localStore.transactions.put(transaction, []);

    const found = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);

    expect(found?.transaction.amount.amount).toBe("1234567.89");
    expect(typeof found?.transaction.amount.amount).toBe("string");
  });

  it("preserves Date values through storage", async () => {
    const date = new Date("2026-08-15T10:00:00.000Z");
    const transaction = buildLocalTransaction({ date });
    await localStore.transactions.put(transaction, []);

    const found = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);

    expect(found?.transaction.date).toBeInstanceOf(Date);
    expect(found?.transaction.date.toISOString()).toBe(date.toISOString());
  });

  it("replaces splits wholesale rather than accumulating them", async () => {
    const transaction = buildLocalTransaction();
    await localStore.transactions.put(transaction, [
      buildLocalSplit(transaction.clientId),
      buildLocalSplit(transaction.clientId, { participantType: "person", personId: "person-1" }),
    ]);

    // An edit that removes a participant must not leave the old row behind, or the
    // splits would no longer sum to the amount.
    await localStore.transactions.put(transaction, [buildLocalSplit(transaction.clientId)]);

    const found = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);
    expect(found?.splits).toHaveLength(1);
  });

  it("marks an offline-created record as pending with no server id", async () => {
    const transaction = buildLocalTransaction();
    await localStore.transactions.put(transaction, []);

    const found = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);

    expect(found?.transaction.syncStatus).toBe("pending");
    expect(found?.transaction.serverId).toBeNull();
    expect(found?.transaction.syncVersion).toBeNull();
  });

  it("does not return another user's transaction", async () => {
    const transaction = buildLocalTransaction({ userId: "user-2" });
    await localStore.transactions.put(transaction, []);

    expect(
      await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId),
    ).toBeNull();
  });
});

describe("local transaction queries", () => {
  beforeEach(async () => {
    const groceries = buildLocalTransaction({
      description: "Groceries",
      date: new Date("2026-08-05T10:00:00.000Z"),
      categoryId: "cat-food",
      accountId: "account-1",
    });
    const dinner = buildLocalTransaction({
      description: "Dinner with Arun",
      date: new Date("2026-08-20T10:00:00.000Z"),
      accountId: "account-1",
    });
    const transfer = buildLocalTransaction({
      type: "transfer",
      description: "Transfer",
      date: new Date("2026-08-25T10:00:00.000Z"),
      accountId: null,
      fromAccountId: "account-1",
      toAccountId: "account-2",
      paidByType: null,
    });

    await localStore.transactions.put(groceries, [buildLocalSplit(groceries.clientId)]);
    await localStore.transactions.put(dinner, [
      buildLocalSplit(dinner.clientId, { shareAmount: inrDto("500") }),
      buildLocalSplit(dinner.clientId, {
        participantType: "person",
        personId: "person-1",
        shareAmount: inrDto("500"),
      }),
    ]);
    await localStore.transactions.put(transfer, []);
  });

  it("returns newest first", async () => {
    const rows = await localStore.transactions.list(TEST_USER_ID);
    expect(rows.map((row) => row.transaction.description)).toEqual([
      "Transfer",
      "Dinner with Arun",
      "Groceries",
    ]);
  });

  it("filters by type", async () => {
    const rows = await localStore.transactions.list(TEST_USER_ID, { types: ["transfer"] });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.transaction.type).toBe("transfer");
  });

  it("matches an account on either side of a transfer", async () => {
    // account-2 is only ever a transfer destination.
    const rows = await localStore.transactions.list(TEST_USER_ID, { accountId: "account-2" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.transaction.type).toBe("transfer");
  });

  it("filters by person via the splits", async () => {
    const rows = await localStore.transactions.list(TEST_USER_ID, { personId: "person-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.transaction.description).toBe("Dinner with Arun");
  });

  it("filters by date range", async () => {
    const rows = await localStore.transactions.list(TEST_USER_ID, {
      from: new Date("2026-08-10T00:00:00.000Z"),
      to: new Date("2026-08-22T00:00:00.000Z"),
    });

    expect(rows.map((row) => row.transaction.description)).toEqual(["Dinner with Arun"]);
  });

  it("searches the description case-insensitively", async () => {
    const rows = await localStore.transactions.list(TEST_USER_ID, { search: "GROC" });
    expect(rows).toHaveLength(1);
  });

  it("applies a limit after sorting", async () => {
    const rows = await localStore.transactions.list(TEST_USER_ID, { limit: 2 });
    expect(rows.map((row) => row.transaction.description)).toEqual([
      "Transfer",
      "Dinner with Arun",
    ]);
  });
});

describe("local deletion", () => {
  it("soft-deletes so the deletion itself can be synced", async () => {
    const transaction = buildLocalTransaction({ serverId: "server-1", syncStatus: "synced" });
    await localStore.transactions.put(transaction, [buildLocalSplit(transaction.clientId)]);

    await localStore.transactions.softDelete(TEST_USER_ID, transaction.clientId);

    // Hidden from normal reads...
    expect(await localStore.transactions.list(TEST_USER_ID)).toHaveLength(0);

    // ...but still present, and marked pending so the delete gets pushed.
    const kept = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);
    expect(kept?.transaction.deletedAt).not.toBeNull();
    expect(kept?.transaction.syncStatus).toBe("pending");
    expect(kept?.splits[0]?.deletedAt).not.toBeNull();
  });

  it("purges a record the server never saw", async () => {
    const transaction = buildLocalTransaction();
    await localStore.transactions.put(transaction, [buildLocalSplit(transaction.clientId)]);

    const purged = await localStore.transactions.purgeUnsynced(TEST_USER_ID, transaction.clientId);

    expect(purged).toBe(true);
    expect(
      await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId),
    ).toBeNull();
    expect(await db.expenseSplits.count()).toBe(0);
  });

  it("refuses to purge a record the server has, so it cannot reappear on pull", async () => {
    const transaction = buildLocalTransaction({ serverId: "server-1", syncStatus: "synced" });
    await localStore.transactions.put(transaction, []);

    const purged = await localStore.transactions.purgeUnsynced(TEST_USER_ID, transaction.clientId);

    expect(purged).toBe(false);
    expect(
      await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId),
    ).not.toBeNull();
  });
});

describe("settlements", () => {
  it("stores a settlement with its allocations", async () => {
    const settlement = buildLocalSettlement();
    await localStore.settlements.put(settlement, [
      buildLocalAllocation(settlement.clientId, { amount: inrDto("600") }),
    ]);

    const found = await localStore.settlements.findByClientId(TEST_USER_ID, settlement.clientId);

    expect(found?.settlement.amount.amount).toBe("600");
    expect(found?.allocations).toHaveLength(1);
  });

  it("soft-deletes the settlement and its allocations together", async () => {
    const settlement = buildLocalSettlement({ serverId: "server-1", syncStatus: "synced" });
    await localStore.settlements.put(settlement, [buildLocalAllocation(settlement.clientId)]);

    await localStore.settlements.softDelete(TEST_USER_ID, settlement.clientId);

    expect(await localStore.settlements.list(TEST_USER_ID)).toHaveLength(0);
    const kept = await localStore.settlements.findByClientId(TEST_USER_ID, settlement.clientId);
    expect(kept?.settlement.deletedAt).not.toBeNull();
    expect(kept?.allocations[0]?.deletedAt).not.toBeNull();
  });

  it("filters by person", async () => {
    await localStore.settlements.put(buildLocalSettlement({ personId: "person-1" }), []);
    await localStore.settlements.put(buildLocalSettlement({ personId: "person-2" }), []);

    const rows = await localStore.settlements.list(TEST_USER_ID, { personId: "person-2" });
    expect(rows).toHaveLength(1);
  });
});

describe("sync queue", () => {
  const command = {
    userId: TEST_USER_ID,
    type: "CREATE_EXPENSE" as const,
    clientId: "expense-1",
    payload: { amount: "450", description: "Groceries" },
    deviceId: TEST_DEVICE_ID,
  };

  it("queues an operation as pending", async () => {
    const operation = await localStore.syncQueue.enqueue(command);

    expect(operation.status).toBe("pending");
    expect(operation.retryCount).toBe(0);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(1);
  });

  it("keeps the payload intact, including string amounts", async () => {
    await localStore.syncQueue.enqueue(command);

    const [queued] = await localStore.syncQueue.listPending(TEST_USER_ID);
    expect(queued?.payload).toEqual({ amount: "450", description: "Groceries" });
  });

  it("returns operations in creation order so dependencies hold", async () => {
    await localStore.syncQueue.enqueue(
      { ...command, type: "CREATE_PERSON", clientId: "person-1" },
      new Date("2026-08-01T10:00:00.000Z"),
    );
    await localStore.syncQueue.enqueue(
      { ...command, type: "CREATE_SHARED_EXPENSE", clientId: "expense-1" },
      new Date("2026-08-01T10:00:05.000Z"),
    );

    const pending = await localStore.syncQueue.listPending(TEST_USER_ID);
    // The person must reach the server before the expense that references them.
    expect(pending.map((operation) => operation.type)).toEqual([
      "CREATE_PERSON",
      "CREATE_SHARED_EXPENSE",
    ]);
  });

  it("withholds an operation whose backoff has not elapsed", async () => {
    const operation = await localStore.syncQueue.enqueue(command);

    await localStore.syncQueue.markRetryable(operation.operationId, {
      nextRetryAt: new Date("2026-09-01T00:00:00.000Z"),
      error: "Network unreachable",
    });

    expect(
      await localStore.syncQueue.listPending(TEST_USER_ID, new Date("2026-08-31T00:00:00.000Z")),
    ).toHaveLength(0);

    expect(
      await localStore.syncQueue.listPending(TEST_USER_ID, new Date("2026-09-02T00:00:00.000Z")),
    ).toHaveLength(1);
  });

  it("counts retries so the engine can give up eventually", async () => {
    const operation = await localStore.syncQueue.enqueue(command);
    const at = new Date("2026-09-01T00:00:00.000Z");

    await localStore.syncQueue.markRetryable(operation.operationId, {
      nextRetryAt: at,
      error: "timeout",
    });
    await localStore.syncQueue.markRetryable(operation.operationId, {
      nextRetryAt: at,
      error: "timeout",
    });

    const [queued] = await localStore.syncQueue.listPending(TEST_USER_ID, at);
    expect(queued?.retryCount).toBe(2);
    expect(queued?.lastError).toBe("timeout");
  });

  it("removes an operation once it completes", async () => {
    const operation = await localStore.syncQueue.enqueue(command);
    await localStore.syncQueue.complete(operation.operationId);

    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);
    expect((await localStore.syncQueue.countByStatus(TEST_USER_ID)).pending).toBe(0);
  });

  it("keeps a permanently failed operation out of the pending set but on record", async () => {
    const operation = await localStore.syncQueue.enqueue(command);

    await localStore.syncQueue.markFailed(operation.operationId, {
      error: "Split amounts must add up to the expense total.",
      errorCode: "INVALID_SPLIT_TOTAL",
    });

    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);

    const failed = await localStore.syncQueue.listByStatus(TEST_USER_ID, "failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.lastErrorCode).toBe("INVALID_SPLIT_TOTAL");
  });

  it("does not delete the local record when its operation fails permanently", async () => {
    const transaction = buildLocalTransaction();
    await localStore.transactions.put(transaction, []);

    const operation = await localStore.syncQueue.enqueue({
      ...command,
      clientId: transaction.clientId,
    });
    await localStore.syncQueue.markFailed(operation.operationId, { error: "rejected" });

    // Losing the user's expense because the server disagreed would be the worst
    // possible outcome.
    expect(
      await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId),
    ).not.toBeNull();
  });

  it("lets the user retry everything that failed", async () => {
    const operation = await localStore.syncQueue.enqueue(command);
    await localStore.syncQueue.markFailed(operation.operationId, { error: "rejected" });

    const reset = await localStore.syncQueue.retryFailed(TEST_USER_ID);

    expect(reset).toBe(1);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(1);
  });

  it("recovers an operation interrupted mid-send", async () => {
    const operation = await localStore.syncQueue.enqueue(command);
    await localStore.syncQueue.markProcessing(operation.operationId);

    // Simulates the browser closing after the operation was claimed.
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);

    const recovered = await localSyncOperationRepository.recoverInterrupted(TEST_USER_ID);

    expect(recovered).toBe(1);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(1);
  });

  it("discards every operation for an entity that was created then deleted offline", async () => {
    await localStore.syncQueue.enqueue({ ...command, clientId: "expense-1" });
    await localStore.syncQueue.enqueue({
      ...command,
      type: "UPDATE_EXPENSE",
      clientId: "expense-1",
    });

    const discarded = await localStore.syncQueue.discardForEntity(TEST_USER_ID, "expense-1");

    expect(discarded).toBe(2);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);
  });

  it("does not surface another user's queued operations", async () => {
    await localStore.syncQueue.enqueue({ ...command, userId: "user-2" });
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);
  });
});

describe("sync metadata", () => {
  it("creates a row on first use", async () => {
    const metadata = await localStore.syncMetadata.ensure(TEST_USER_ID, TEST_DEVICE_ID);

    expect(metadata.userId).toBe(TEST_USER_ID);
    expect(metadata.lastPulledCursor).toBeNull();
  });

  it("stores the pull cursor", async () => {
    await localStore.syncMetadata.setCursor(TEST_USER_ID, "cursor-abc");

    const metadata = await localStore.syncMetadata.get(TEST_USER_ID);
    expect(metadata?.lastPulledCursor).toBe("cursor-abc");
    expect(metadata?.lastPulledAt).toBeInstanceOf(Date);
  });

  it("keeps each user's cursor separate", async () => {
    await localStore.syncMetadata.setCursor(TEST_USER_ID, "cursor-a");
    await localStore.syncMetadata.setCursor("user-2", "cursor-b");

    expect((await localStore.syncMetadata.get(TEST_USER_ID))?.lastPulledCursor).toBe("cursor-a");
    expect((await localStore.syncMetadata.get("user-2"))?.lastPulledCursor).toBe("cursor-b");
  });

  it("clears the last error when a pull succeeds", async () => {
    await localStore.syncMetadata.recordError(TEST_USER_ID, "boom");
    await localStore.syncMetadata.setCursor(TEST_USER_ID, "cursor-abc");

    expect((await localStore.syncMetadata.get(TEST_USER_ID))?.lastError).toBeNull();
  });
});

describe("cached views", () => {
  it("stores and returns a cached read model", async () => {
    await localStore.cachedViews.put(TEST_USER_ID, "dashboard", { spending: "450" });

    const cached = await localStore.cachedViews.get<{ spending: string }>(
      TEST_USER_ID,
      "dashboard",
    );

    expect(cached?.payload.spending).toBe("450");
    expect(cached?.cachedAt).toBeInstanceOf(Date);
  });

  it("namespaces the cache by user", async () => {
    await localStore.cachedViews.put(TEST_USER_ID, "dashboard", { spending: "450" });
    await localStore.cachedViews.put("user-2", "dashboard", { spending: "999" });

    const mine = await localStore.cachedViews.get<{ spending: string }>(TEST_USER_ID, "dashboard");
    expect(mine?.payload.spending).toBe("450");
  });
});

describe("startup and teardown", () => {
  it("reports what is waiting and recovers interrupted work", async () => {
    const operation = await localStore.syncQueue.enqueue({
      userId: TEST_USER_ID,
      type: "CREATE_EXPENSE",
      clientId: "expense-1",
      payload: {},
      deviceId: TEST_DEVICE_ID,
    });
    await localStore.syncQueue.markProcessing(operation.operationId);

    const readiness = await initialiseOfflineStorage(TEST_USER_ID);

    expect(readiness.available).toBe(true);
    expect(readiness.recoveredOperations).toBe(1);
    expect(readiness.pendingOperations).toBe(1);
    expect(readiness.failedOperations).toBe(0);
  });

  it("persists across a close and reopen, which is what 'durable' means here", async () => {
    const transaction = buildLocalTransaction();
    await localStore.transactions.put(transaction, [buildLocalSplit(transaction.clientId)]);
    await localStore.syncQueue.enqueue({
      userId: TEST_USER_ID,
      type: "CREATE_EXPENSE",
      clientId: transaction.clientId,
      payload: { amount: "450" },
      deviceId: TEST_DEVICE_ID,
    });

    const name = db.name;
    db.close();

    const { LocalDatabase, setLocalDbForTesting } = await import("@/offline/db/client");
    const reopened = new LocalDatabase(name);
    setLocalDbForTesting(reopened);
    await reopened.open();

    // Both the expense and the queued command survived, which is the whole point of
    // using IndexedDB rather than memory.
    expect(
      await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId),
    ).not.toBeNull();
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(1);

    db = reopened;
  });

  it("clears one user's data and leaves the other's alone", async () => {
    await localStore.transactions.put(buildLocalTransaction(), []);
    await localStore.transactions.put(buildLocalTransaction({ userId: "user-2" }), []);
    await localStore.syncQueue.enqueue({
      userId: TEST_USER_ID,
      type: "CREATE_EXPENSE",
      clientId: "expense-1",
      payload: {},
      deviceId: TEST_DEVICE_ID,
    });
    await localStore.cachedViews.put(TEST_USER_ID, "dashboard", {});

    await clearLocalDataForUser(TEST_USER_ID);

    expect(await localStore.transactions.list(TEST_USER_ID)).toHaveLength(0);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);
    expect(await localStore.cachedViews.get(TEST_USER_ID, "dashboard")).toBeNull();

    // The other user in the same browser profile is untouched.
    expect(await localStore.transactions.list("user-2")).toHaveLength(1);
  });
});
