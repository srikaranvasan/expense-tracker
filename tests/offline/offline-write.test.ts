import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/offline/db/client";
import { localStore } from "@/offline/local-store";
import { pushPendingOperations } from "@/offline/sync/push";
import { queueExpenseOffline } from "@/offline/writes/queue-expense";
import { newClientId } from "@/lib/utils/client-id";
import { TEST_USER_ID, destroyLocalDb, freshLocalDb } from "@tests/helpers/offline";

let db: LocalDatabase;

const NOW = new Date("2026-09-01T12:00:00.000Z");

beforeEach(async () => {
  db = await freshLocalDb();
});

afterEach(async () => {
  await destroyLocalDb(db);
});

function input(overrides: Partial<Parameters<typeof queueExpenseOffline>[0]> = {}) {
  return {
    userId: TEST_USER_ID,
    currency: "INR",
    clientId: newClientId(),
    amount: "450",
    description: "Groceries",
    date: NOW,
    accountId: "account-1",
    categoryId: null,
    notes: null,
    ...overrides,
  };
}

describe("queueExpenseOffline", () => {
  it("stores the expense and queues exactly one operation", async () => {
    const result = await queueExpenseOffline(input());

    expect(result.ok).toBe(true);

    const pending = await localStore.syncQueue.listPending(TEST_USER_ID);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.type).toBe("CREATE_EXPENSE");
  });

  it("writes the record and the operation together, so neither can exist alone", async () => {
    const command = input();
    await queueExpenseOffline(command);

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, command.clientId);
    const queued = await localStore.syncQueue.listForEntity(TEST_USER_ID, command.clientId);

    // An expense with no queued operation could never reach the server, and a queued
    // operation with no expense would push a record the user cannot see.
    expect(local).not.toBeNull();
    expect(queued).toHaveLength(1);
  });

  it("creates one split for the full amount, matching the server's invariant", async () => {
    const command = input({ amount: "450" });
    await queueExpenseOffline(command);

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, command.clientId);

    expect(local?.splits).toHaveLength(1);
    expect(local?.splits[0]?.participantType).toBe("user");
    expect(local?.splits[0]?.shareAmount.amount).toBe("450");
    // Active splits sum to the transaction amount, locally as well as on the server.
    expect(local?.splits[0]?.shareAmount.amount).toBe(local?.transaction.amount.amount);
  });

  it("marks the record pending with no server id", async () => {
    const command = input();
    await queueExpenseOffline(command);

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, command.clientId);

    expect(local?.transaction.syncStatus).toBe("pending");
    expect(local?.transaction.serverId).toBeNull();
  });

  it("keeps the amount as an exact decimal string", async () => {
    const command = input({ amount: "1234.56" });
    await queueExpenseOffline(command);

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, command.clientId);
    expect(local?.transaction.amount.amount).toBe("1234.56");

    const [queued] = await localStore.syncQueue.listPending(TEST_USER_ID);
    expect(queued?.payload.amount).toBe("1234.56");
    expect(typeof queued?.payload.amount).toBe("string");
  });

  it("normalises the description the same way the server does", async () => {
    const command = input({ description: "  Weekly   groceries  " });
    await queueExpenseOffline(command);

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, command.clientId);
    expect(local?.transaction.description).toBe("Weekly groceries");
  });

  it("shows the expense in the local list immediately", async () => {
    await queueExpenseOffline(input());

    // The point of offline support: the expense is visible without a server.
    const rows = await localStore.transactions.list(TEST_USER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.transaction.description).toBe("Groceries");
  });

  it("rejects an invalid amount before writing anything", async () => {
    const command = input({ amount: "0" });
    const result = await queueExpenseOffline(command);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("amount");

    // Nothing was stored, so there is no doomed operation sitting in the queue waiting
    // for a reconnection to fail.
    expect(await localStore.transactions.list(TEST_USER_ID)).toHaveLength(0);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);
  });

  it("rejects a negative amount", async () => {
    const result = await queueExpenseOffline(input({ amount: "-100" }));
    expect(result.ok).toBe(false);
  });

  it("rejects an over-precise amount, as the server would", async () => {
    const result = await queueExpenseOffline(input({ amount: "10.001" }));
    expect(result.ok).toBe(false);
  });

  it("rejects an empty description", async () => {
    const result = await queueExpenseOffline(input({ description: "   " }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("description");
  });

  it("resubmitting the same form does not create a second expense", async () => {
    const command = input();

    await queueExpenseOffline(command);
    await queueExpenseOffline(command);

    // The form holds one clientId per mount, so the record is replaced rather than
    // duplicated.
    expect(await localStore.transactions.list(TEST_USER_ID)).toHaveLength(1);
    const local = await localStore.transactions.findByClientId(TEST_USER_ID, command.clientId);
    expect(local?.splits).toHaveLength(1);
  });

  it("builds a payload the API schema would accept", async () => {
    const command = input({ categoryId: "cat-1", notes: "Weekly shop" });
    await queueExpenseOffline(command);

    const [queued] = await localStore.syncQueue.listPending(TEST_USER_ID);

    expect(queued?.payload).toMatchObject({
      amount: "450",
      description: "Groceries",
      accountId: "account-1",
      categoryId: "cat-1",
      notes: "Weekly shop",
    });
    // Dates cross the wire as ISO strings.
    expect(queued?.payload.date).toBe(NOW.toISOString());
    expect(typeof queued?.payload.splitClientId).toBe("string");
  });
});

describe("offline write then sync", () => {
  it("reaches the server and gets its id on the next push", async () => {
    const command = input();
    await queueExpenseOffline(command);

    const [queued] = await localStore.syncQueue.listPending(TEST_USER_ID);

    const outcome = await pushPendingOperations(TEST_USER_ID, {
      send: async () => ({
        kind: "ok",
        results: [
          {
            operationId: queued!.operationId,
            status: "completed",
            entityId: "server-txn-1",
            entityType: "transaction",
          },
        ],
      }),
      now: () => NOW,
      random: () => 1,
    });

    expect(outcome.completed).toBe(1);

    const local = await localStore.transactions.findByClientId(TEST_USER_ID, command.clientId);
    expect(local?.transaction.serverId).toBe("server-txn-1");
    expect(local?.transaction.syncStatus).toBe("synced");
    expect(local?.splits[0]?.transactionId).toBe("server-txn-1");

    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(0);
  });

  it("survives a failed push with the expense intact and the operation queued", async () => {
    const command = input();
    await queueExpenseOffline(command);

    await pushPendingOperations(TEST_USER_ID, {
      send: async () => ({ kind: "transport-error", message: "Failed to fetch" }),
      now: () => NOW,
      random: () => 1,
    });

    // The user's expense must never be a casualty of a failed sync.
    const local = await localStore.transactions.findByClientId(TEST_USER_ID, command.clientId);
    expect(local).not.toBeNull();
    expect(local?.transaction.description).toBe("Groceries");

    const later = new Date(NOW.getTime() + 300_000);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID, later)).toHaveLength(1);
  });

  it("keeps two offline expenses distinct", async () => {
    const first = input({ description: "Coffee", amount: "120" });
    const second = input({ description: "Lunch", amount: "300" });

    await queueExpenseOffline(first);
    await queueExpenseOffline(second);

    expect(await localStore.transactions.list(TEST_USER_ID)).toHaveLength(2);
    expect(await localStore.syncQueue.listPending(TEST_USER_ID)).toHaveLength(2);
  });

  it("scopes the local record to the user who created it", async () => {
    await queueExpenseOffline(input({ userId: "user-2" }));

    expect(await localStore.transactions.list(TEST_USER_ID)).toHaveLength(0);
    expect(await localStore.transactions.list("user-2")).toHaveLength(1);
  });
});
