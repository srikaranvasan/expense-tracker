import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { Person } from "@/domain/people/entities";
import type { User } from "@/domain/users/entities";
import type { PersonBalanceView } from "@/features/people/view-models/person-view-model";
import type {
  SettlementDetailView,
  SettlementView,
} from "@/features/settlements/view-models/settlement-view-model";
import { collections } from "@/server/db/collections";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { expectData, expectError, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId } from "@tests/helpers/fixtures";
import {
  seedBankAccount,
  seedPerson,
  seedSharedExpense,
  splitForPerson,
  splitForUser,
} from "@tests/helpers/seed";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { GET: listSettlements, POST: createSettlement } =
  await import("@/app/api/settlements/route");
const { GET: getSettlement, DELETE: deleteSettlement } =
  await import("@/app/api/settlements/[id]/route");
const { GET: getPersonBalance } = await import("@/app/api/people/[id]/balance/route");
const { GET: getAccount } = await import("@/app/api/accounts/[id]/route");
const { DELETE: deleteExpense } = await import("@/app/api/expenses/[id]/route");

const splits = expenseSplitRepository();

let user: User;
let account: Account;
let arun: Person;

/** Arun owes the user ₹500 from a ₹1,000 dinner split two ways. */
async function seedArunOwes500() {
  const expense = await seedSharedExpense(user.id, {
    amount: "1000",
    description: "Dinner",
    accountId: account.id,
    participants: [
      { personId: null, share: "500" },
      { personId: arun.id, share: "500" },
    ],
  });

  return { expense, arunSplit: splitForPerson(expense, arun.id) };
}

/** The user owes Arun ₹450 from a ₹900 expense Arun paid. */
async function seedUserOwes450() {
  const expense = await seedSharedExpense(user.id, {
    amount: "900",
    description: "Groceries",
    paidByPersonId: arun.id,
    accountId: null,
    participants: [
      { personId: null, share: "450" },
      { personId: arun.id, share: "450" },
    ],
  });

  return { expense, userSplit: splitForUser(expense) };
}

async function postSettlement(body: Record<string, unknown>) {
  return invokeRoute<SettlementView>(createSettlement, "/api/settlements", {
    method: "POST",
    body: {
      clientId: clientId("stl"),
      personId: arun.id,
      direction: "person_to_user",
      date: "2026-08-20T10:00:00.000Z",
      ...body,
    },
  });
}

async function personBalance(personId: string): Promise<PersonBalanceView> {
  return expectData(
    await invokeRoute<PersonBalanceView>(getPersonBalance, `/api/people/${personId}/balance`, {
      params: { id: personId },
    }),
  );
}

async function accountBalance(accountId: string): Promise<string> {
  const view = expectData(
    await invokeRoute<{ balance: { amount: string } }>(getAccount, `/api/accounts/${accountId}`, {
      params: { id: accountId },
    }),
  );
  return view.balance.amount;
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR" });
  account = await seedBankAccount(user.id, { openingBalance: "50000" });
  arun = await seedPerson(user.id, "Arun");
});

describe("full settlement", () => {
  it("clears the balance and records the allocation", async () => {
    const { arunSplit } = await seedArunOwes500();

    const response = await postSettlement({
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });

    expect(response.status).toBe(201);
    const settlement = expectData(response);
    expect(settlement.amount.amount).toBe("500");
    expect(settlement.allocationCount).toBe(1);

    const balance = await personBalance(arun.id);
    expect(balance.isSettled).toBe(true);
    expect(balance.direction).toBe("settled");
  });

  it("increases the receiving account balance", async () => {
    const { arunSplit } = await seedArunOwes500();

    // The dinner charged ₹1,000 to the account: 50000 - 1000 = 49000.
    expect(await accountBalance(account.id)).toBe("49000");

    await postSettlement({
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });

    // Arun's ₹500 arrives: 49000 + 500 = 49500.
    expect(await accountBalance(account.id)).toBe("49500");
  });

  it("reduces the paying account when the user settles a debt", async () => {
    const { userSplit } = await seedUserOwes450();

    // Arun paid, so nothing was charged to the user's account.
    expect(await accountBalance(account.id)).toBe("50000");

    await postSettlement({
      direction: "user_to_person",
      amount: "450",
      accountId: account.id,
      allocations: [{ expenseSplitId: userSplit.id, amount: "450" }],
    });

    expect(await accountBalance(account.id)).toBe("49550");
    expect((await personBalance(arun.id)).isSettled).toBe(true);
  });

  it("records a cash settlement with no account", async () => {
    const { arunSplit } = await seedArunOwes500();

    const settlement = expectData(
      await postSettlement({
        amount: "500",
        accountId: null,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
      }),
    );

    expect(settlement.accountId).toBeNull();
    // No account moved, but the balance is still cleared.
    expect(await accountBalance(account.id)).toBe("49000");
    expect((await personBalance(arun.id)).isSettled).toBe(true);
  });
});

describe("partial settlement", () => {
  it("leaves the remainder outstanding", async () => {
    const { arunSplit } = await seedArunOwes500();

    await postSettlement({
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
    });

    const balance = await personBalance(arun.id);
    expect(balance.personOwesUser.amount).toBe("200");
    expect(balance.isSettled).toBe(false);
  });

  it("can be settled again down to zero", async () => {
    const { arunSplit } = await seedArunOwes500();

    await postSettlement({
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
    });
    await postSettlement({
      amount: "200",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "200" }],
    });

    expect((await personBalance(arun.id)).isSettled).toBe(true);
  });

  it("rejects a third payment once the share is fully settled", async () => {
    const { arunSplit } = await seedArunOwes500();

    await postSettlement({
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });

    const response = await postSettlement({
      amount: "100",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "100" }],
    });

    expect(response.status).toBe(409);
    expect(expectError(response).code).toBe("OVER_SETTLEMENT");
  });
});

describe("settlement across multiple expenses", () => {
  it("spreads one payment over several shares", async () => {
    const dinner = await seedSharedExpense(user.id, {
      amount: "600",
      description: "Dinner",
      accountId: account.id,
      participants: [
        { personId: null, share: "300" },
        { personId: arun.id, share: "300" },
      ],
    });
    const movie = await seedSharedExpense(user.id, {
      amount: "800",
      description: "Movie",
      accountId: account.id,
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "400" },
      ],
    });

    const dinnerSplit = splitForPerson(dinner, arun.id);
    const movieSplit = splitForPerson(movie, arun.id);

    const settlement = expectData(
      await postSettlement({
        amount: "500",
        accountId: account.id,
        allocations: [
          { expenseSplitId: dinnerSplit.id, amount: "300" },
          { expenseSplitId: movieSplit.id, amount: "200" },
        ],
      }),
    );

    expect(settlement.allocationCount).toBe(2);

    // ₹700 owed originally, ₹500 paid, ₹200 left on the movie.
    expect((await personBalance(arun.id)).personOwesUser.amount).toBe("200");

    const detail = expectData(
      await invokeRoute<SettlementDetailView>(getSettlement, `/api/settlements/${settlement.id}`, {
        params: { id: settlement.id },
      }),
    );

    expect(detail.allocations).toHaveLength(2);
    expect(detail.allocations.map((a) => a.expenseDescription).sort()).toEqual(["Dinner", "Movie"]);
  });
});

describe("over-settlement prevention", () => {
  it("rejects allocating more than a share's remaining amount", async () => {
    const { arunSplit } = await seedArunOwes500();

    const response = await postSettlement({
      amount: "600",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "600" }],
    });

    expect(response.status).toBe(409);
    const error = expectError(response);
    expect(error.code).toBe("OVER_SETTLEMENT");
    expect(error.details?.remaining).toBe("500.00");
    expect(error.details?.requested).toBe("600.00");
  });

  it("accounts for an earlier partial settlement", async () => {
    const { arunSplit } = await seedArunOwes500();

    await postSettlement({
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
    });

    // Only ₹200 remains, so ₹300 is now too much.
    const response = await postSettlement({
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
    });

    expect(response.status).toBe(409);
    expect(expectError(response).details?.remaining).toBe("200.00");
  });

  it("writes nothing when the allocation is rejected", async () => {
    const { arunSplit } = await seedArunOwes500();

    await postSettlement({
      amount: "600",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "600" }],
    });

    // No settlement row, and the balance is untouched.
    const settlements = await collections.settlements();
    expect(await settlements.countDocuments({ deletedAt: null })).toBe(0);
    expect((await personBalance(arun.id)).personOwesUser.amount).toBe("500");
  });

  it("holds under two concurrent settlements of the same share", async () => {
    const { arunSplit } = await seedArunOwes500();

    // Both would individually pass a check taken before the write. Reading the
    // remaining amount inside the transaction is what stops them both succeeding.
    const [first, second] = await Promise.all([
      postSettlement({
        clientId: clientId("stl"),
        amount: "500",
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
      }),
      postSettlement({
        clientId: clientId("stl"),
        amount: "500",
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
      }),
    ]);

    const statuses = [first.status, second.status].sort();

    // One succeeds; the other is rejected rather than both landing.
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);

    // Whatever happened, the share is settled exactly once.
    expect((await personBalance(arun.id)).isSettled).toBe(true);

    const allocations = await collections.settlementAllocations();
    expect(await allocations.countDocuments({ deletedAt: null })).toBe(1);
  });
});

describe("allocation validation", () => {
  it("requires at least one allocation", async () => {
    await seedArunOwes500();

    const response = await postSettlement({
      amount: "500",
      accountId: account.id,
      allocations: [],
    });

    expect(response.status).toBe(400);
  });

  it("requires the allocations to add up to the payment", async () => {
    const { arunSplit } = await seedArunOwes500();

    const response = await postSettlement({
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
    });

    expect(response.status).toBe(400);
    const error = expectError(response);
    expect(error.code).toBe("INVALID_SETTLEMENT");
    expect(error.details?.settlementAmount).toBe("500.00");
    expect(error.details?.allocatedAmount).toBe("300.00");
  });

  it("rejects the wrong direction for an obligation", async () => {
    const { arunSplit } = await seedArunOwes500();

    // Arun owes the user, so the user paying Arun cannot settle it.
    const response = await postSettlement({
      direction: "user_to_person",
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/money owed to you/i);
  });

  it("rejects an expense involving a different person", async () => {
    const vijay = await seedPerson(user.id, "Vijay");
    const expense = await seedSharedExpense(user.id, {
      amount: "600",
      accountId: account.id,
      participants: [
        { personId: null, share: "300" },
        { personId: vijay.id, share: "300" },
      ],
    });

    const response = await postSettlement({
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: splitForPerson(expense, vijay.id).id, amount: "300" }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/does not involve this person/i);
  });

  it("rejects the same expense twice in one payment", async () => {
    const { arunSplit } = await seedArunOwes500();

    const response = await postSettlement({
      amount: "400",
      accountId: account.id,
      allocations: [
        { expenseSplitId: arunSplit.id, amount: "200" },
        { expenseSplitId: arunSplit.id, amount: "200" },
      ],
    });

    expect(response.status).toBe(400);
  });

  it("rejects an unknown expense split", async () => {
    await seedArunOwes500();

    const response = await postSettlement({
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: "6a95b78237559e60592da181", amount: "500" }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/could not be found/i);
  });

  it("rejects another user's expense split", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);
    const theirPerson = await seedPerson(other.id, "Theirs");
    const theirExpense = await seedSharedExpense(other.id, {
      amount: "600",
      accountId: theirAccount.id,
      participants: [
        { personId: null, share: "300" },
        { personId: theirPerson.id, share: "300" },
      ],
    });

    await seedArunOwes500();

    const response = await postSettlement({
      amount: "300",
      accountId: account.id,
      allocations: [
        { expenseSplitId: splitForPerson(theirExpense, theirPerson.id).id, amount: "300" },
      ],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/could not be found/i);
  });

  it("rejects a zero or negative payment", async () => {
    const { arunSplit } = await seedArunOwes500();

    for (const amount of ["0", "-100"]) {
      const response = await postSettlement({
        amount,
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount }],
      });
      expect(response.status).toBe(400);
    }
  });

  it("rejects an over-precise payment", async () => {
    const { arunSplit } = await seedArunOwes500();

    const response = await postSettlement({
      amount: "100.005",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "100.005" }],
    });

    expect(response.status).toBe(400);
  });

  it("rejects another user's person", async () => {
    const other = await createTestUser();
    const theirPerson = await seedPerson(other.id, "Theirs");
    const { arunSplit } = await seedArunOwes500();

    const response = await postSettlement({
      personId: theirPerson.id,
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });

    expect(response.status).toBe(400);
  });

  it("rejects another user's account", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);
    const { arunSplit } = await seedArunOwes500();

    const response = await postSettlement({
      amount: "500",
      accountId: theirAccount.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });

    expect(response.status).toBe(400);
  });

  it("rejects an archived account", async () => {
    const { archiveAccount } = await import("@/server/services/accounts/account-service");
    const { arunSplit } = await seedArunOwes500();
    await archiveAccount(user.id, account.id);

    const response = await postSettlement({
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/archived/i);
  });

  it("requires authentication", async () => {
    const { arunSplit } = await seedArunOwes500();
    setCurrentTestUser(null);

    const response = await postSettlement({
      amount: "500",
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });

    expect(response.status).toBe(401);
  });
});

describe("idempotency", () => {
  it("returns the original settlement for a repeated clientId", async () => {
    const { arunSplit } = await seedArunOwes500();
    const id = clientId("stl");

    const first = expectData(
      await postSettlement({
        clientId: id,
        amount: "300",
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
      }),
    );
    const second = expectData(
      await postSettlement({
        clientId: id,
        amount: "300",
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
      }),
    );

    expect(second.id).toBe(first.id);

    // The balance reduced once, not twice.
    expect((await personBalance(arun.id)).personOwesUser.amount).toBe("200");

    const allocations = await collections.settlementAllocations();
    expect(await allocations.countDocuments({ deletedAt: null })).toBe(1);
  });
});

describe("GET /api/settlements", () => {
  it("lists settlements newest first with resolved names", async () => {
    const { arunSplit } = await seedArunOwes500();

    await postSettlement({
      amount: "200",
      accountId: account.id,
      date: "2026-08-10T10:00:00.000Z",
      allocations: [{ expenseSplitId: arunSplit.id, amount: "200" }],
    });
    await postSettlement({
      amount: "300",
      accountId: account.id,
      date: "2026-08-20T10:00:00.000Z",
      allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
    });

    const page = expectData(
      await invokeRoute<{ items: SettlementView[] }>(listSettlements, "/api/settlements"),
    );

    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.amount.amount).toBe("300");
    expect(page.items[0]?.personName).toBe("Arun");
    expect(page.items[0]?.accountName).toBe("HDFC Savings");
  });

  it("filters by person", async () => {
    const vijay = await seedPerson(user.id, "Vijay");
    const { arunSplit } = await seedArunOwes500();

    const vijayExpense = await seedSharedExpense(user.id, {
      amount: "400",
      accountId: account.id,
      participants: [
        { personId: null, share: "200" },
        { personId: vijay.id, share: "200" },
      ],
    });

    await postSettlement({
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
    });
    await postSettlement({
      personId: vijay.id,
      amount: "200",
      accountId: account.id,
      allocations: [{ expenseSplitId: splitForPerson(vijayExpense, vijay.id).id, amount: "200" }],
    });

    const page = expectData(
      await invokeRoute<{ items: SettlementView[] }>(listSettlements, "/api/settlements", {
        searchParams: { personId: vijay.id },
      }),
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.personName).toBe("Vijay");
  });

  it("does not return another user's settlements", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);

    const page = expectData(
      await invokeRoute<{ items: SettlementView[] }>(listSettlements, "/api/settlements"),
    );
    expect(page.items).toHaveLength(0);
  });
});

describe("DELETE /api/settlements/:id", () => {
  it("restores the balance it had reduced", async () => {
    const { arunSplit } = await seedArunOwes500();

    const settlement = expectData(
      await postSettlement({
        amount: "500",
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
      }),
    );

    expect((await personBalance(arun.id)).isSettled).toBe(true);

    const response = await invokeRoute(deleteSettlement, `/api/settlements/${settlement.id}`, {
      method: "DELETE",
      params: { id: settlement.id },
    });

    expect(response.status).toBe(204);

    // The obligation is outstanding again and the account movement is undone.
    expect((await personBalance(arun.id)).personOwesUser.amount).toBe("500");
    expect(await accountBalance(account.id)).toBe("49000");
  });

  it("keeps the rows as soft-deleted history", async () => {
    const { arunSplit } = await seedArunOwes500();

    const settlement = expectData(
      await postSettlement({
        amount: "500",
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
      }),
    );

    await invokeRoute(deleteSettlement, `/api/settlements/${settlement.id}`, {
      method: "DELETE",
      params: { id: settlement.id },
    });

    const settlements = await collections.settlements();
    const raw = await settlements.findOne({ clientId: settlement.clientId });
    expect(raw?.deletedAt).toBeInstanceOf(Date);
  });

  it("refuses to delete twice", async () => {
    const { arunSplit } = await seedArunOwes500();

    const settlement = expectData(
      await postSettlement({
        amount: "500",
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
      }),
    );

    await invokeRoute(deleteSettlement, `/api/settlements/${settlement.id}`, {
      method: "DELETE",
      params: { id: settlement.id },
    });

    const second = await invokeRoute(deleteSettlement, `/api/settlements/${settlement.id}`, {
      method: "DELETE",
      params: { id: settlement.id },
    });

    expect(second.status).toBe(404);
  });

  it("allows the expense to be edited again afterwards", async () => {
    const { expense, arunSplit } = await seedArunOwes500();

    const settlement = expectData(
      await postSettlement({
        amount: "500",
        accountId: account.id,
        allocations: [{ expenseSplitId: arunSplit.id, amount: "500" }],
      }),
    );

    // Blocked while settled.
    const blocked = await invokeRoute(deleteExpense, `/api/expenses/${expense.transaction.id}`, {
      method: "DELETE",
      params: { id: expense.transaction.id },
    });
    expect(blocked.status).toBe(409);

    await invokeRoute(deleteSettlement, `/api/settlements/${settlement.id}`, {
      method: "DELETE",
      params: { id: settlement.id },
    });

    // Allowed once the settlement is removed.
    const allowed = await invokeRoute(deleteExpense, `/api/expenses/${expense.transaction.id}`, {
      method: "DELETE",
      params: { id: expense.transaction.id },
    });
    expect(allowed.status).toBe(204);
  });

  it("does not delete another user's settlement", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);
    const theirPerson = await seedPerson(other.id, "Theirs");
    const theirExpense = await seedSharedExpense(other.id, {
      amount: "600",
      accountId: theirAccount.id,
      participants: [
        { personId: null, share: "300" },
        { personId: theirPerson.id, share: "300" },
      ],
    });

    setCurrentTestUser(other);
    const theirs = expectData(
      await invokeRoute<SettlementView>(createSettlement, "/api/settlements", {
        method: "POST",
        body: {
          clientId: clientId("stl"),
          personId: theirPerson.id,
          direction: "person_to_user",
          amount: "300",
          accountId: theirAccount.id,
          date: "2026-08-20T10:00:00.000Z",
          allocations: [
            { expenseSplitId: splitForPerson(theirExpense, theirPerson.id).id, amount: "300" },
          ],
        },
      }),
    );

    setCurrentTestUser(user);
    const response = await invokeRoute(deleteSettlement, `/api/settlements/${theirs.id}`, {
      method: "DELETE",
      params: { id: theirs.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/settlements/:id", () => {
  it("returns 404 for another user's settlement", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);

    const response = await invokeRoute(getSettlement, "/api/settlements/6a95b78237559e60592da181", {
      params: { id: "6a95b78237559e60592da181" },
    });

    expect(response.status).toBe(404);
  });
});

describe("settled shares are reflected in the expense", () => {
  it("marks the share partially settled then settled", async () => {
    const { expense, arunSplit } = await seedArunOwes500();

    await postSettlement({
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
    });

    const { GET: getPerson } = await import("@/app/api/people/[id]/route");
    const detail = expectData(
      await invokeRoute<{ obligations: { status: string; remainingAmount: { amount: string } }[] }>(
        getPerson,
        `/api/people/${arun.id}`,
        { params: { id: arun.id } },
      ),
    );

    expect(detail.obligations[0]?.status).toBe("partially_settled");
    expect(detail.obligations[0]?.remainingAmount.amount).toBe("200");

    // The split row itself is unchanged; only the allocations differ.
    const rows = await splits.listByTransaction(user.id, expense.transaction.id);
    expect(rows.find((row) => row.personId === arun.id)?.shareAmount.toFixedString()).toBe(
      "500.00",
    );
  });
});
