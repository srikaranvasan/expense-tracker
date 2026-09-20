import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { Person } from "@/domain/people/entities";
import type { User } from "@/domain/users/entities";
import type { SyncPullResponse, SyncPushResponse } from "@/types/sync";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { expectData, expectError, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId, operationId } from "@tests/helpers/fixtures";
import { seedBankAccount, seedCashAccount, seedCreditCard, seedPerson } from "@tests/helpers/seed";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { POST: syncPush } = await import("@/app/api/sync/push/route");
const { GET: syncPull } = await import("@/app/api/sync/pull/route");
const { GET: syncRecord } = await import("@/app/api/sync/record/route");
const { GET: getAccount } = await import("@/app/api/accounts/[id]/route");

const transactions = transactionRepository();
const splits = expenseSplitRepository();

let user: User;
let bank: Account;
let arun: Person;

const DATE = "2026-08-15T10:00:00.000Z";

async function push(operations: unknown[]) {
  return invokeRoute<SyncPushResponse>(syncPush, "/api/sync/push", {
    method: "POST",
    body: { operations },
  });
}

async function pull(searchParams: Record<string, string | number> = {}) {
  return expectData(
    await invokeRoute<SyncPullResponse>(syncPull, "/api/sync/pull", { searchParams }),
  );
}

async function balanceOf(accountId: string): Promise<string> {
  const view = expectData(
    await invokeRoute<{ balance: { amount: string } }>(getAccount, `/api/accounts/${accountId}`, {
      params: { id: accountId },
    }),
  );
  return view.balance.amount;
}

/** A queued CREATE_EXPENSE, as a client would build it. */
function expenseOperation(overrides: Record<string, unknown> = {}) {
  return {
    operationId: operationId(),
    type: "CREATE_EXPENSE",
    clientId: clientId("txn"),
    payload: {
      amount: "450",
      description: "Groceries",
      date: DATE,
      accountId: bank.id,
    },
    ...overrides,
  };
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR", timezone: "Asia/Kolkata" });
  bank = await seedBankAccount(user.id, { openingBalance: "50000" });
  arun = await seedPerson(user.id, "Arun");
});

describe("POST /api/sync/push", () => {
  it("applies a queued expense and reports the server id", async () => {
    const operation = expenseOperation();
    const response = await push([operation]);

    expect(response.status).toBe(200);
    const { results } = expectData(response);

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("completed");
    expect(results[0]).toMatchObject({ entityType: "transaction" });

    expect(await balanceOf(bank.id)).toBe("49550");
  });

  it("applies a shared expense as one atomic operation", async () => {
    const response = await push([
      {
        operationId: operationId(),
        type: "CREATE_SHARED_EXPENSE",
        clientId: clientId("txn"),
        payload: {
          amount: "1000",
          description: "Dinner",
          date: DATE,
          accountId: bank.id,
          splitMethod: "custom",
          participants: [
            { personId: null, amount: "400" },
            { personId: arun.id, amount: "600" },
          ],
        },
      },
    ]);

    const { results } = expectData(response);
    expect(results[0]?.status).toBe("completed");

    const entityId = results[0]?.status === "completed" ? results[0].entityId : "";
    // The transaction and all its splits landed together.
    expect(await splits.listByTransaction(user.id, entityId)).toHaveLength(2);
  });

  it("applies a transfer and a card payment", async () => {
    const cash = await seedCashAccount(user.id, { openingBalance: "0" });
    const card = await seedCreditCard(user.id, { creditLimit: "100000", openingBalance: "5000" });

    const { results } = expectData(
      await push([
        {
          operationId: operationId(),
          type: "CREATE_TRANSFER",
          clientId: clientId("txn"),
          payload: {
            amount: "1000",
            fromAccountId: bank.id,
            toAccountId: cash.id,
            date: DATE,
          },
        },
        {
          operationId: operationId(),
          type: "CREATE_CREDIT_CARD_PAYMENT",
          clientId: clientId("txn"),
          payload: {
            amount: "2000",
            fromAccountId: bank.id,
            toAccountId: card.id,
            date: DATE,
          },
        },
      ]),
    );

    expect(results.map((result) => result.status)).toEqual(["completed", "completed"]);
    expect(await balanceOf(bank.id)).toBe("47000");
    expect(await balanceOf(cash.id)).toBe("1000");
  });

  it("processes a batch in order so a dependency lands first", async () => {
    // A person created before the expense that references them would arrive in this
    // order; the batch must not be reordered or parallelised.
    const first = expenseOperation({ payload: { ...expenseOperation().payload, amount: "100" } });
    const second = expenseOperation({ payload: { ...expenseOperation().payload, amount: "200" } });

    const { results } = expectData(await push([first, second]));

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === "completed")).toBe(true);
  });
});

describe("idempotency", () => {
  it("returns the same entity for a repeated operationId and records the expense once", async () => {
    const operation = expenseOperation();

    const first = expectData(await push([operation]));
    const second = expectData(await push([operation]));

    expect(first.results[0]?.status).toBe("completed");
    // A retry is recognised, not re-executed.
    expect(second.results[0]?.status).toBe("duplicate");

    const firstId = first.results[0]?.status === "completed" ? first.results[0].entityId : "a";
    const secondId = second.results[0]?.status === "duplicate" ? second.results[0].entityId : "b";
    expect(secondId).toBe(firstId);

    // The money moved once.
    expect(await balanceOf(bank.id)).toBe("49550");
  });

  it("also deduplicates on clientId when the operationId differs", async () => {
    const sharedClientId = clientId("txn");

    const first = expectData(await push([expenseOperation({ clientId: sharedClientId })]));
    const second = expectData(await push([expenseOperation({ clientId: sharedClientId })]));

    // A client that regenerated its operationId must still not create a second expense.
    const firstId = first.results[0]?.status === "completed" ? first.results[0].entityId : "a";
    const secondId = second.results[0]?.status === "completed" ? second.results[0].entityId : "b";

    expect(secondId).toBe(firstId);
    expect(await balanceOf(bank.id)).toBe("49550");
  });

  it("replays a recorded rejection rather than re-running a doomed operation", async () => {
    const operation = expenseOperation({
      payload: { amount: "450", description: "Groceries", date: DATE, accountId: bank.id },
    });

    // Make it fail permanently: an account that does not belong to the user.
    const other = await createTestUser({ email: "other@example.com" });
    const foreign = await seedBankAccount(other.id);
    setCurrentTestUser(user);

    const bad = { ...operation, payload: { ...operation.payload, accountId: foreign.id } };

    const first = expectData(await push([bad]));
    expect(first.results[0]?.status).toBe("failed");

    const second = expectData(await push([bad]));
    expect(second.results[0]?.status).toBe("failed");
    // Not retryable: the answer will never change.
    expect(second.results[0]?.status === "failed" && second.results[0].error.retryable).toBe(false);
  });
});

describe("failure handling", () => {
  it("keeps processing the batch when one operation fails", async () => {
    const good = expenseOperation();
    const bad = expenseOperation({
      payload: { amount: "-100", description: "Bad", date: DATE, accountId: bank.id },
    });
    const alsoGood = expenseOperation({
      payload: { amount: "200", description: "Fine", date: DATE, accountId: bank.id },
    });

    const { results } = expectData(await push([good, bad, alsoGood]));

    expect(results.map((result) => result.status)).toEqual(["completed", "failed", "completed"]);
    // Both valid expenses landed: 50000 - 450 - 200.
    expect(await balanceOf(bank.id)).toBe("49350");
  });

  it("marks a business-rule rejection as not retryable", async () => {
    const { results } = expectData(
      await push([
        {
          operationId: operationId(),
          type: "CREATE_SHARED_EXPENSE",
          clientId: clientId("txn"),
          payload: {
            amount: "1000",
            description: "Dinner",
            date: DATE,
            accountId: bank.id,
            splitMethod: "custom",
            // Shares do not add up. The server must never absorb the difference.
            participants: [
              { personId: null, amount: "400" },
              { personId: arun.id, amount: "400" },
            ],
          },
        },
      ]),
    );

    const result = results[0];
    expect(result?.status).toBe("failed");
    if (result?.status === "failed") {
      expect(result.error.retryable).toBe(false);
      expect(result.error.code).toBe("INVALID_SPLIT_TOTAL");
    }
  });

  it("rejects a transfer into a credit card through sync, exactly as the REST route does", async () => {
    const card = await seedCreditCard(user.id, { creditLimit: "100000" });

    const { results } = expectData(
      await push([
        {
          operationId: operationId(),
          type: "CREATE_TRANSFER",
          clientId: clientId("txn"),
          payload: { amount: "1000", fromAccountId: bank.id, toAccountId: card.id, date: DATE },
        },
      ]),
    );

    const result = results[0];
    expect(result?.status).toBe("failed");
    // The sync path shares the service, so it shares the rule.
    if (result?.status === "failed") expect(result.error.code).toBe("INVALID_TRANSFER");
  });

  it("rejects an unsupported operation type clearly instead of silently doing nothing", async () => {
    const { results } = expectData(
      await push([
        {
          operationId: operationId(),
          type: "CREATE_ACCOUNT",
          clientId: clientId("acc"),
          payload: { name: "Offline account" },
        },
      ]),
    );

    const result = results[0];
    expect(result?.status).toBe("failed");
    if (result?.status === "failed") expect(result.error.retryable).toBe(false);
  });

  it("rejects a malformed envelope with a 400", async () => {
    const response = await push([{ type: "CREATE_EXPENSE" }]);

    expect(response.status).toBe(400);
    expectError(response);
  });

  it("refuses an empty batch", async () => {
    expect((await push([])).status).toBe(400);
  });
});

describe("authorization", () => {
  /**
   * Group 17 changed this from "ignore" to "reject".
   *
   * docs/12-SECURITY-AND-ERROR-HANDLING.md section 4 permits either. The behaviour used to
   * be "ignore": the command schema stripped the unknown key and the record was written for
   * the session user. Safe, but silent — and silence means the safety net never fires if a
   * future service starts spreading a payload into a write.
   *
   * `rejectClientUserId()` was written for exactly this and had never been called. It now
   * runs at the top of the dispatcher, which is the only place a payload reaches the
   * application unfiltered — REST bodies are stripped by Zod before a handler sees them.
   */
  it("rejects a userId in the payload rather than silently ignoring it", async () => {
    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(user);

    const { results } = expectData(
      await push([
        expenseOperation({
          payload: {
            amount: "450",
            description: "Groceries",
            date: DATE,
            accountId: bank.id,
            // A hostile client trying to write into another account.
            userId: other.id,
          },
        }),
      ]),
    );

    const outcome = results[0];

    expect(outcome?.status).toBe("failed");
    expect(outcome?.status === "failed" ? outcome.error.code : null).toBe("FORBIDDEN");

    // A rejected operation must not half-apply: nothing was written for either user.
    expect(await transactions.list(user.id, { limit: 10 })).toMatchObject({ items: [] });
    expect(await transactions.list(other.id, { limit: 10 })).toMatchObject({ items: [] });
  });

  it("cannot reference another user's account", async () => {
    const other = await createTestUser({ email: "other@example.com" });
    const foreign = await seedBankAccount(other.id);
    setCurrentTestUser(user);

    const { results } = expectData(
      await push([
        expenseOperation({
          payload: { amount: "450", description: "x", date: DATE, accountId: foreign.id },
        }),
      ]),
    );

    expect(results[0]?.status).toBe("failed");
  });
});

describe("GET /api/sync/pull", () => {
  it("returns the seeded reference data on a first pull", async () => {
    const page = await pull();

    const types = new Set(page.changes.map((change) => change.entityType));
    expect(types.has("account")).toBe(true);
    // Registration creates default categories.
    expect(types.has("category")).toBe(true);
    expect(types.has("person")).toBe(true);
    expect(page.serverTime).toBeTruthy();
  });

  it("sends amounts as decimal strings, never numbers", async () => {
    const page = await pull({ limit: 100 });
    const account = page.changes.find((change) => change.entityId === bank.id);

    const openingBalance = account?.record?.openingBalance as { amount: unknown };
    expect(typeof openingBalance.amount).toBe("string");
    expect(openingBalance.amount).toBe("50000");
  });

  it("returns only changes after the cursor", async () => {
    const first = await pull({ limit: 100 });
    expect(first.changes.length).toBeGreaterThan(0);

    // Nothing has changed since, so a second pull with the cursor is empty.
    const second = await pull({ limit: 100, cursor: first.nextCursor! });
    expect(second.changes).toHaveLength(0);

    // Now record something and pull again.
    await push([expenseOperation()]);

    const third = await pull({ limit: 100, cursor: second.nextCursor ?? first.nextCursor! });
    const descriptions = third.changes
      .filter((change) => change.entityType === "transaction")
      .map((change) => change.record?.description);

    expect(descriptions).toContain("Groceries");
  });

  it("walks the whole change set without skipping or repeating a record", async () => {
    for (let index = 0; index < 8; index += 1) {
      await push([
        expenseOperation({
          payload: {
            amount: "100",
            description: `Expense ${index}`,
            date: DATE,
            accountId: bank.id,
          },
        }),
      ]);
    }

    const seen = new Set<string>();
    let cursor: string | null = null;

    for (let page = 0; page < 30; page += 1) {
      const result: SyncPullResponse = await pull({
        limit: 5,
        ...(cursor ? { cursor } : {}),
      });

      for (const change of result.changes) seen.add(`${change.entityType}:${change.entityId}`);
      cursor = result.nextCursor;
      if (!result.hasMore) break;
    }

    // 8 transactions plus 8 splits, plus the account, person and 9 default categories.
    const transactionsSeen = [...seen].filter((key) => key.startsWith("transaction:"));
    expect(transactionsSeen).toHaveLength(8);
  });

  it("reports a deletion without resending the record body", async () => {
    const { results } = expectData(await push([expenseOperation()]));
    const entityId = results[0]?.status === "completed" ? results[0].entityId : "";

    const { DELETE: deleteExpense } = await import("@/app/api/expenses/[id]/route");
    await invokeRoute(deleteExpense, `/api/expenses/${entityId}`, {
      method: "DELETE",
      params: { id: entityId },
    });

    const page = await pull({ limit: 100 });
    const change = page.changes.find((entry) => entry.entityId === entityId);

    expect(change?.deleted).toBe(true);
    // The client already has the record; it only needs to know it is gone.
    expect(change?.record).toBeUndefined();
  });

  it("rejects a hand-crafted cursor", async () => {
    const response = await invokeRoute(syncPull, "/api/sync/pull", {
      searchParams: { cursor: "not-a-real-cursor" },
    });

    expect(response.status).toBe(400);
  });

  it("never returns another user's changes", async () => {
    await push([expenseOperation()]);

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const page = await pull({ limit: 100 });
    const accountIds = page.changes.map((change) => change.entityId);

    expect(accountIds).not.toContain(bank.id);
  });
});

describe("GET /api/sync/record", () => {
  it("returns the canonical copy of one record", async () => {
    const { results } = expectData(await push([expenseOperation()]));
    const entityId = results[0]?.status === "completed" ? results[0].entityId : "";

    const data = expectData(
      await invokeRoute<{ change: { entityId: string; syncVersion: number } }>(
        syncRecord,
        "/api/sync/record",
        { searchParams: { entityType: "transaction", entityId } },
      ),
    );

    expect(data.change.entityId).toBe(entityId);
    expect(data.change.syncVersion).toBeGreaterThanOrEqual(1);
  });

  it("reports 404 for another user's record", async () => {
    const { results } = expectData(await push([expenseOperation()]));
    const entityId = results[0]?.status === "completed" ? results[0].entityId : "";

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const response = await invokeRoute(syncRecord, "/api/sync/record", {
      searchParams: { entityType: "transaction", entityId },
    });

    expect(response.status).toBe(404);
  });
});

describe("round trip", () => {
  it("a pushed expense comes back through pull with the same amount", async () => {
    const { results } = expectData(await push([expenseOperation()]));
    const entityId = results[0]?.status === "completed" ? results[0].entityId : "";

    const page = await pull({ limit: 100 });
    const change = page.changes.find((entry) => entry.entityId === entityId);

    expect(change?.entityType).toBe("transaction");
    expect(change?.record?.amount).toEqual({ amount: "450", currency: "INR" });
    expect(change?.record?.description).toBe("Groceries");
  });

  it("a shared expense's splits arrive with their shares intact", async () => {
    const { results } = expectData(
      await push([
        {
          operationId: operationId(),
          type: "CREATE_SHARED_EXPENSE",
          clientId: clientId("txn"),
          payload: {
            amount: "1000",
            description: "Dinner",
            date: DATE,
            accountId: bank.id,
            splitMethod: "equal",
            participants: [{ personId: null }, { personId: arun.id }],
          },
        },
      ]),
    );

    const entityId = results[0]?.status === "completed" ? results[0].entityId : "";

    const page = await pull({ limit: 100 });
    const splitChanges = page.changes.filter(
      (change) => change.entityType === "expenseSplit" && change.record?.transactionId === entityId,
    );

    expect(splitChanges).toHaveLength(2);

    const total = splitChanges.reduce((sum, change) => {
      const share = change.record?.shareAmount as { amount: string };
      return sum + Number(share.amount);
    }, 0);

    // The invariant survives the round trip.
    expect(total).toBe(1000);
  });
});
