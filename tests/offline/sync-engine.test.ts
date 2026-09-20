import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/lib/errors";
import type { LocalDatabase } from "@/offline/db/client";
import { localStore } from "@/offline/local-store";
import { MAX_RETRY_ATTEMPTS } from "@/offline/sync/backoff";
import { pullServerChanges } from "@/offline/sync/pull";
import type { PullTransportResult } from "@/offline/sync/pull";
import { pushPendingOperations } from "@/offline/sync/push";
import type { PushTransportResult } from "@/offline/sync/push";
import { SyncEngine } from "@/offline/sync/sync-engine";
import type { SyncOperationResult, SyncPushOperation } from "@/types/sync";
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

const NOW = new Date("2026-09-01T12:00:00.000Z");
const now = () => NOW;
/** Fixed so backoff delays are deterministic. */
const random = () => 1;

beforeEach(async () => {
  db = await freshLocalDb();
});

afterEach(async () => {
  await destroyLocalDb(db);
});

/** Queues an expense plus the operation that would push it. */
async function queueExpense(overrides: Record<string, unknown> = {}) {
  const transaction = buildLocalTransaction();
  await localStore.transactions.put(transaction, [buildLocalSplit(transaction.clientId)]);

  const operation = await localStore.syncQueue.enqueue({
    userId: TEST_USER_ID,
    type: "CREATE_EXPENSE",
    clientId: transaction.clientId,
    payload: { amount: "450", description: "Groceries", ...overrides },
    deviceId: TEST_DEVICE_ID,
  });

  return { transaction, operation };
}

function respondWith(results: SyncOperationResult[]): PushTransportResult {
  return { kind: "ok", results };
}

describe("push: success", () => {
  it("records the server id on the local record and clears the queue", async () => {
    const { transaction, operation } = await queueExpense();

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () =>
        respondWith([
          {
            operationId: operation.operationId,
            status: "completed",
            entityId: "server-txn-1",
            entityType: "transaction",
          },
        ]),
      now,
      random,
    });

    expect(outcome.completed).toBe(1);

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);
    // The round trip is only complete once the server id is stored.
    expect(local?.transaction.serverId).toBe("server-txn-1");
    expect(local?.transaction.syncStatus).toBe("synced");
    expect(local?.splits[0]?.transactionId).toBe("server-txn-1");

    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);
  });

  it("treats a duplicate as success, because the server already has it", async () => {
    const { transaction, operation } = await queueExpense();

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () =>
        respondWith([
          {
            operationId: operation.operationId,
            status: "duplicate",
            entityId: "server-txn-1",
            entityType: "transaction",
          },
        ]),
      now,
      random,
    });

    expect(outcome.completed).toBe(1);
    const local = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);
    expect(local?.transaction.serverId).toBe("server-txn-1");
  });

  it("sends the operation exactly as queued", async () => {
    const { operation } = await queueExpense();
    let sent: SyncPushOperation[] = [];

    await pushPendingOperations(TEST_USER_ID, {
      send: async (operations) => {
        sent = operations;
        return respondWith([
          {
            operationId: operation.operationId,
            status: "completed",
            entityId: "server-1",
            entityType: "transaction",
          },
        ]);
      },
      now,
      random,
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.operationId).toBe(operation.operationId);
    expect(sent[0]?.clientId).toBe(operation.clientId);
    // Amounts remain strings the whole way.
    expect(sent[0]?.payload).toMatchObject({ amount: "450" });
  });
});

describe("push: temporary failure", () => {
  it("returns operations to the queue with a backoff when the network is gone", async () => {
    const { transaction, operation } = await queueExpense();

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () => ({ kind: "transport-error", message: "Failed to fetch" }),
      now,
      random,
    });

    expect(outcome.offline).toBe(true);
    expect(outcome.retryScheduled).toBe(1);

    // Withheld now...
    expect(await localStore.syncQueue.listPending(TEST_USER_ID, NOW)).toHaveLength(0);
    // ...but available later.
    const later = new Date(NOW.getTime() + 60_000);
    const pending = await localStore.syncQueue.listPending(TEST_USER_ID, later);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.retryCount).toBe(1);

    // And the user's expense is untouched.
    const local = await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId);
    expect(local).not.toBeNull();
    expect(local?.transaction.serverId).toBeNull();
    expect(operation.operationId).toBe(pending[0]?.operationId);
  });

  it("retries a 503 rather than giving up", async () => {
    await queueExpense();

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () => ({
        kind: "http-error",
        status: 503,
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message: "Unavailable",
      }),
      now,
      random,
    });

    expect(outcome.retryScheduled).toBe(1);
    expect(outcome.failed).toBe(0);
  });

  it("does not retry a 400, because the batch itself was malformed", async () => {
    await queueExpense();

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () => ({
        kind: "http-error",
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Bad request",
      }),
      now,
      random,
    });

    expect(outcome.failed).toBe(1);
    expect(await localStore.syncQueue.listByStatus(TEST_USER_ID, "failed")).toHaveLength(1);
  });

  it("retries when the server answers but says nothing about an operation", async () => {
    await queueExpense();

    // Never assume success from silence: that could drop the record entirely.
    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () => respondWith([]),
      now,
      random,
    });

    expect(outcome.retryScheduled).toBe(1);
  });

  it("gives up once retries are exhausted, so the user is told", async () => {
    const { operation } = await queueExpense();

    await db.syncOperations.update(operation.operationId, { retryCount: MAX_RETRY_ATTEMPTS });

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () => ({ kind: "transport-error", message: "Failed to fetch" }),
      now,
      random,
    });

    expect(outcome.retryScheduled).toBe(1);
    const failed = await localStore.syncQueue.listByStatus(TEST_USER_ID, "failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.lastError).toContain("gave up");
  });
});

describe("push: permanent failure", () => {
  it("stops retrying a business-rule rejection and keeps the local record", async () => {
    const { transaction, operation } = await queueExpense();

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () =>
        respondWith([
          {
            operationId: operation.operationId,
            status: "failed",
            error: {
              code: ERROR_CODES.INVALID_SPLIT_TOTAL,
              message: "Split amounts must add up to the expense total.",
              retryable: false,
            },
          },
        ]),
      now,
      random,
    });

    expect(outcome.failed).toBe(1);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);

    const failed = await localStore.syncQueue.listByStatus(TEST_USER_ID, "failed");
    expect(failed[0]?.lastErrorCode).toBe(ERROR_CODES.INVALID_SPLIT_TOTAL);

    // The rejection must never cost the user their record.
    expect(
      await localStore.transactions.findByClientId(TEST_USER_ID, transaction.clientId),
    ).not.toBeNull();
  });

  it("counts a conflict separately from a plain rejection", async () => {
    const { operation } = await queueExpense();

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () =>
        respondWith([
          {
            operationId: operation.operationId,
            status: "conflict",
            error: {
              code: ERROR_CODES.SYNC_CONFLICT,
              message: "This expense was modified elsewhere.",
              retryable: false,
              details: { serverVersion: 5 },
            },
          },
        ]),
      now,
      random,
    });

    expect(outcome.conflicted).toBe(1);
    expect(outcome.failed).toBe(0);
    // A conflict needs a person, so it stops retrying too.
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);
  });
});

describe("pull", () => {
  function page(changes: unknown[], nextCursor: string | null): PullTransportResult {
    return {
      kind: "ok",
      page: {
        changes: changes as never,
        nextCursor,
        hasMore: false,
        serverTime: NOW.toISOString(),
      },
    };
  }

  it("applies a server transaction and stores the cursor", async () => {
    const outcome = await pullServerChanges(TEST_USER_ID, {
      fetchPage: async () =>
        page(
          [
            {
              entityType: "transaction",
              entityId: "server-1",
              clientId: "client-1",
              syncVersion: 3,
              updatedAt: NOW.toISOString(),
              deleted: false,
              record: {
                type: "expense",
                amount: { amount: "450", currency: "INR" },
                description: "Groceries",
                date: NOW.toISOString(),
                accountId: "acc-1",
                paidByType: "user",
              },
            },
          ],
          "cursor-1",
        ),
      now,
    });

    expect(outcome.applied).toBe(1);
    expect(outcome.error).toBeNull();

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, "client-1");
    expect(local?.transaction.description).toBe("Groceries");
    expect(local?.transaction.amount.amount).toBe("450");
    expect(local?.transaction.syncStatus).toBe("synced");
    expect(local?.transaction.syncVersion).toBe(3);

    const metadata = await localStore.syncMetadata.get(TEST_USER_ID);
    expect(metadata?.lastPulledCursor).toBe("cursor-1");
  });

  it("does not advance the cursor when the request fails", async () => {
    await localStore.syncMetadata.setCursor(TEST_USER_ID, "cursor-original");

    const outcome = await pullServerChanges(TEST_USER_ID, {
      fetchPage: async () => ({ kind: "error", message: "Failed to fetch" }),
      now,
    });

    expect(outcome.error).toBe("Failed to fetch");

    // Advancing here would skip those changes permanently.
    const metadata = await localStore.syncMetadata.get(TEST_USER_ID);
    expect(metadata?.lastPulledCursor).toBe("cursor-original");
  });

  it("does not overwrite a local record that has unsynced edits", async () => {
    const local = buildLocalTransaction({
      clientId: "client-1",
      description: "My local edit",
      syncStatus: "pending",
    });
    await localStore.transactions.put(local, []);

    const outcome = await pullServerChanges(TEST_USER_ID, {
      fetchPage: async () =>
        page(
          [
            {
              entityType: "transaction",
              entityId: "server-1",
              clientId: "client-1",
              syncVersion: 9,
              updatedAt: NOW.toISOString(),
              deleted: false,
              record: {
                type: "expense",
                amount: { amount: "999", currency: "INR" },
                description: "Server version",
                date: NOW.toISOString(),
                accountId: "acc-1",
                paidByType: "user",
              },
            },
          ],
          "cursor-1",
        ),
      now,
    });

    expect(outcome.applied).toBe(0);

    // Silently discarding what the user typed is exactly what must not happen.
    const kept = await localStore.transactions.findByClientId(TEST_USER_ID, "client-1");
    expect(kept?.transaction.description).toBe("My local edit");
  });

  it("marks a record deleted without needing a body", async () => {
    const local = buildLocalTransaction({
      clientId: "client-1",
      serverId: "server-1",
      syncStatus: "synced",
    });
    await localStore.transactions.put(local, []);

    await pullServerChanges(TEST_USER_ID, {
      fetchPage: async () =>
        page(
          [
            {
              entityType: "transaction",
              entityId: "server-1",
              clientId: "client-1",
              syncVersion: 4,
              updatedAt: NOW.toISOString(),
              deleted: true,
            },
          ],
          "cursor-1",
        ),
      now,
    });

    const kept = await localStore.transactions.findByClientId(TEST_USER_ID, "client-1");
    expect(kept?.transaction.deletedAt).not.toBeNull();
    // The original fields survive; only the metadata changed.
    expect(kept?.transaction.description).toBe("Groceries");
  });

  it("links a split arriving in the same page as its transaction", async () => {
    await pullServerChanges(TEST_USER_ID, {
      fetchPage: async () =>
        page(
          [
            {
              entityType: "transaction",
              entityId: "server-txn",
              clientId: "client-txn",
              syncVersion: 1,
              updatedAt: NOW.toISOString(),
              deleted: false,
              record: {
                type: "expense",
                amount: { amount: "1000", currency: "INR" },
                description: "Dinner",
                date: NOW.toISOString(),
                accountId: "acc-1",
                paidByType: "user",
              },
            },
            {
              entityType: "expenseSplit",
              entityId: "server-split",
              clientId: "client-split",
              syncVersion: 1,
              updatedAt: NOW.toISOString(),
              deleted: false,
              record: {
                transactionId: "server-txn",
                participantType: "person",
                personId: "person-1",
                shareAmount: { amount: "500", currency: "INR" },
              },
            },
          ],
          "cursor-1",
        ),
      now,
    });

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, "client-txn");
    expect(local?.splits).toHaveLength(1);
    expect(local?.splits[0]?.shareAmount.amount).toBe("500");
  });

  it("records the cursor even when the page is empty", async () => {
    const outcome = await pullServerChanges(TEST_USER_ID, {
      fetchPage: async () => page([], "cursor-empty"),
      now,
    });

    expect(outcome.applied).toBe(0);
    expect((await localStore.syncMetadata.get(TEST_USER_ID))?.lastPulledCursor).toBe(
      "cursor-empty",
    );
  });
});

describe("sync engine", () => {
  it("pushes before pulling, so the server has local work first", async () => {
    const order: string[] = [];
    const { operation } = await queueExpense();

    const engine = new SyncEngine(TEST_USER_ID, {
      isOnline: () => true,
      push: {
        send: async () => {
          order.push("push");
          return respondWith([
            {
              operationId: operation.operationId,
              status: "completed",
              entityId: "server-1",
              entityType: "transaction",
            },
          ]);
        },
        now,
        random,
      },
      pull: {
        fetchPage: async () => {
          order.push("pull");
          return {
            kind: "ok",
            page: { changes: [], nextCursor: null, hasMore: false, serverTime: NOW.toISOString() },
          };
        },
        now,
      },
    });

    const result = await engine.run("manual");

    expect(order).toEqual(["push", "pull"]);
    expect(result.pushed).toBe(1);
  });

  it("skips entirely when offline", async () => {
    await queueExpense();
    let sent = false;

    const engine = new SyncEngine(TEST_USER_ID, {
      isOnline: () => false,
      push: {
        send: async () => {
          sent = true;
          return respondWith([]);
        },
      },
    });

    const result = await engine.run("manual");

    expect(result.skipped).toBe(true);
    expect(sent).toBe(false);
    // And the status says offline, not broken.
    expect(engine.getStatus().state).toBe("offline");
  });

  it("does not pull after a transport failure, since the network is gone", async () => {
    await queueExpense();
    let pulled = false;

    const engine = new SyncEngine(TEST_USER_ID, {
      isOnline: () => true,
      push: {
        send: async () => ({ kind: "transport-error", message: "Failed to fetch" }),
        now,
        random,
      },
      pull: {
        fetchPage: async () => {
          pulled = true;
          return { kind: "error", message: "unused" };
        },
        now,
      },
    });

    await engine.run("manual");
    expect(pulled).toBe(false);
  });

  it("reports attention once an operation is permanently rejected", async () => {
    const { operation } = await queueExpense();

    const engine = new SyncEngine(TEST_USER_ID, {
      isOnline: () => true,
      push: {
        send: async () =>
          respondWith([
            {
              operationId: operation.operationId,
              status: "failed",
              error: {
                code: ERROR_CODES.INVALID_ACCOUNT,
                message: "No such account",
                retryable: false,
              },
            },
          ]),
        now,
        random,
      },
      pull: {
        fetchPage: async () => ({
          kind: "ok",
          page: { changes: [], nextCursor: null, hasMore: false, serverTime: NOW.toISOString() },
        }),
        now,
      },
    });

    await engine.run("manual");

    const status = engine.getStatus();
    expect(status.state).toBe("attention");
    expect(status.failed).toBe(1);
  });

  it("reports synced when the queue drains", async () => {
    const { operation } = await queueExpense();

    const engine = new SyncEngine(TEST_USER_ID, {
      isOnline: () => true,
      push: {
        send: async () =>
          respondWith([
            {
              operationId: operation.operationId,
              status: "completed",
              entityId: "server-1",
              entityType: "transaction",
            },
          ]),
        now,
        random,
      },
      pull: {
        fetchPage: async () => ({
          kind: "ok",
          page: { changes: [], nextCursor: null, hasMore: false, serverTime: NOW.toISOString() },
        }),
        now,
      },
    });

    await engine.run("manual");

    expect(engine.getStatus().state).toBe("synced");
    expect(engine.getStatus().pending).toBe(0);
  });

  it("lets the user retry a rejected operation", async () => {
    const { operation } = await queueExpense();
    let attempt = 0;

    const engine = new SyncEngine(TEST_USER_ID, {
      isOnline: () => true,
      push: {
        send: async () => {
          attempt += 1;
          return attempt === 1
            ? respondWith([
                {
                  operationId: operation.operationId,
                  status: "failed",
                  error: { code: ERROR_CODES.INVALID_ACCOUNT, message: "No", retryable: false },
                },
              ])
            : respondWith([
                {
                  operationId: operation.operationId,
                  status: "completed",
                  entityId: "server-1",
                  entityType: "transaction",
                },
              ]);
        },
        now,
        random,
      },
      pull: {
        fetchPage: async () => ({
          kind: "ok",
          page: { changes: [], nextCursor: null, hasMore: false, serverTime: NOW.toISOString() },
        }),
        now,
      },
    });

    await engine.run("manual");
    expect(engine.getStatus().state).toBe("attention");

    // The user fixed whatever was wrong and asked to try again.
    await engine.retryFailed();

    expect(engine.getStatus().state).toBe("synced");
    expect(attempt).toBe(2);
  });

  it("notifies subscribers as the status changes", async () => {
    const seen: string[] = [];
    const { operation } = await queueExpense();

    const engine = new SyncEngine(TEST_USER_ID, {
      isOnline: () => true,
      push: {
        send: async () =>
          respondWith([
            {
              operationId: operation.operationId,
              status: "completed",
              entityId: "server-1",
              entityType: "transaction",
            },
          ]),
        now,
        random,
      },
      pull: {
        fetchPage: async () => ({
          kind: "ok",
          page: { changes: [], nextCursor: null, hasMore: false, serverTime: NOW.toISOString() },
        }),
        now,
      },
    });

    const unsubscribe = engine.subscribe((status) => seen.push(status.state));
    await engine.run("manual");
    unsubscribe();

    expect(seen).toContain("syncing");
    expect(seen.at(-1)).toBe("synced");
  });
});

describe("create then delete offline", () => {
  it("sends nothing for a record the server never saw", async () => {
    const transaction = buildLocalTransaction();
    await localStore.transactions.put(transaction, [buildLocalSplit(transaction.clientId)]);
    await localStore.syncQueue.enqueue({
      userId: TEST_USER_ID,
      type: "CREATE_EXPENSE",
      clientId: transaction.clientId,
      payload: { amount: "450" },
      deviceId: TEST_DEVICE_ID,
    });

    // The user changed their mind before reconnecting.
    await localStore.syncQueue.discardForEntity(TEST_USER_ID, transaction.clientId);
    const purged = await localStore.transactions.purgeUnsynced(TEST_USER_ID, transaction.clientId);

    expect(purged).toBe(true);

    let sent = false;
    await pushPendingOperations(TEST_USER_ID, {
      send: async () => {
        sent = true;
        return respondWith([]);
      },
      now,
      random,
    });

    // Nothing to tell the server about.
    expect(sent).toBe(false);
  });
});

describe("settlement push", () => {
  it("stamps the server id onto the settlement and its allocations", async () => {
    const local = buildLocalSettlement({ amount: inrDto("600") });
    await localStore.settlements.put(local, [buildLocalAllocation(local.clientId)]);

    const operation = await localStore.syncQueue.enqueue({
      userId: TEST_USER_ID,
      type: "CREATE_SETTLEMENT",
      clientId: local.clientId,
      payload: { amount: "600", personId: local.personId },
      deviceId: TEST_DEVICE_ID,
    });

    await pushPendingOperations(TEST_USER_ID, {
      send: async () =>
        respondWith([
          {
            operationId: operation.operationId,
            status: "completed",
            entityId: "server-stl-1",
            entityType: "settlement",
          },
        ]),
      now,
      random,
    });

    const stored = await localStore.settlements.findByClientId(TEST_USER_ID, local.clientId);
    expect(stored?.settlement.serverId).toBe("server-stl-1");
    expect(stored?.settlement.syncStatus).toBe("synced");
    expect(stored?.allocations[0]?.settlementId).toBe("server-stl-1");
  });
});
