import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { Person } from "@/domain/people/entities";
import type { User } from "@/domain/users/entities";
import type { PersonBalanceView } from "@/features/people/view-models/person-view-model";
import type {
  ExpenseDetailView,
  TransactionListItem,
} from "@/features/transactions/view-models/expense-view-model";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { expectData, expectError, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId } from "@tests/helpers/fixtures";
import { seedBankAccount, seedPerson, seedSettlement, splitForPerson } from "@tests/helpers/seed";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { POST: createShared } = await import("@/app/api/expenses/shared/route");
const { PATCH: patchShared } = await import("@/app/api/expenses/shared/[id]/route");
const { GET: getExpense, DELETE: deleteExpense } = await import("@/app/api/expenses/[id]/route");
const { PATCH: patchPersonal } = await import("@/app/api/expenses/[id]/route");
const { GET: getAccount } = await import("@/app/api/accounts/[id]/route");
const { GET: getPersonBalance } = await import("@/app/api/people/[id]/balance/route");

const splits = expenseSplitRepository();

let user: User;
let account: Account;
let arun: Person;
let vijay: Person;

async function postShared(body: Record<string, unknown> = {}) {
  return invokeRoute<TransactionListItem>(createShared, "/api/expenses/shared", {
    method: "POST",
    body: {
      clientId: clientId("txn"),
      amount: "1200",
      description: "Dinner",
      date: "2026-08-15T10:00:00.000Z",
      accountId: account.id,
      splitMethod: "equal",
      participants: [{ personId: null }, { personId: arun.id }, { personId: vijay.id }],
      ...body,
    },
  });
}

async function sharesOf(expenseId: string): Promise<Record<string, string>> {
  const rows = await splits.listByTransaction(user.id, expenseId);
  return Object.fromEntries(
    rows.map((row) => [row.personId ?? "user", row.shareAmount.toFixedString()]),
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

async function personBalance(personId: string): Promise<PersonBalanceView> {
  return expectData(
    await invokeRoute<PersonBalanceView>(getPersonBalance, `/api/people/${personId}/balance`, {
      params: { id: personId },
    }),
  );
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR" });
  account = await seedBankAccount(user.id, { openingBalance: "50000" });
  arun = await seedPerson(user.id, "Arun");
  vijay = await seedPerson(user.id, "Vijay");
});

describe("equal split", () => {
  it("splits evenly and records one row per participant", async () => {
    const response = await postShared({ amount: "900" });

    expect(response.status).toBe(201);
    const expense = expectData(response);
    expect(expense.isShared).toBe(true);
    expect(expense.participantCount).toBe(3);
    expect(expense.userShare.amount).toBe("300");

    expect(await sharesOf(expense.id)).toEqual({
      user: "300.00",
      [arun.id]: "300.00",
      [vijay.id]: "300.00",
    });
  });

  it("distributes the remainder so the shares sum to the total", async () => {
    const expense = expectData(await postShared({ amount: "1000" }));

    const shares = await sharesOf(expense.id);
    const total = Object.values(shares).reduce((sum, value) => sum + Number(value), 0);

    expect(total).toBeCloseTo(1000, 2);
    expect(Object.values(shares).sort()).toEqual(["333.33", "333.33", "333.34"]);
  });

  it("charges the full amount to the account, not the user's share", async () => {
    await postShared({ amount: "1200" });

    // ₹1,200 left the account even though only ₹400 is the user's own spending.
    expect(await accountBalance(account.id)).toBe("48800");
  });

  it("makes each participant owe their share", async () => {
    await postShared({ amount: "1200" });

    const arunBalance = await personBalance(arun.id);
    expect(arunBalance.direction).toBe("person_owes_user");
    expect(arunBalance.personOwesUser.amount).toBe("400");

    const vijayBalance = await personBalance(vijay.id);
    expect(vijayBalance.personOwesUser.amount).toBe("400");
  });

  it("supports an expense the user paid entirely for others", async () => {
    const expense = expectData(
      await postShared({
        amount: "600",
        participants: [{ personId: arun.id }, { personId: vijay.id }],
      }),
    );

    expect(expense.userShare.amount).toBe("0");
    expect(await accountBalance(account.id)).toBe("49400");
    expect((await personBalance(arun.id)).personOwesUser.amount).toBe("300");
  });
});

describe("custom split", () => {
  it("uses the amounts exactly as given", async () => {
    const expense = expectData(
      await postShared({
        amount: "1000",
        splitMethod: "custom",
        participants: [
          { personId: null, amount: "250" },
          { personId: arun.id, amount: "500" },
          { personId: vijay.id, amount: "250" },
        ],
      }),
    );

    expect(await sharesOf(expense.id)).toEqual({
      user: "250.00",
      [arun.id]: "500.00",
      [vijay.id]: "250.00",
    });
    expect(expense.userShare.amount).toBe("250");
  });

  it("rejects amounts that do not add up to the total", async () => {
    const response = await postShared({
      amount: "1000",
      splitMethod: "custom",
      participants: [
        { personId: null, amount: "400" },
        { personId: arun.id, amount: "400" },
      ],
    });

    expect(response.status).toBe(400);
    const error = expectError(response);
    expect(error.code).toBe("INVALID_SPLIT_TOTAL");
    expect(error.details?.expectedTotal).toBe("1000.00");
    expect(error.details?.actualTotal).toBe("800.00");
  });

  it("rejects a zero share", async () => {
    const response = await postShared({
      amount: "1000",
      splitMethod: "custom",
      participants: [
        { personId: null, amount: "1000" },
        { personId: arun.id, amount: "0" },
      ],
    });

    expect(response.status).toBe(400);
  });

  it("requires an amount for every participant", async () => {
    const response = await postShared({
      amount: "1000",
      splitMethod: "custom",
      participants: [{ personId: null, amount: "500" }, { personId: arun.id }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });
});

describe("percentage split", () => {
  it("applies whole percentages", async () => {
    const expense = expectData(
      await postShared({
        amount: "1000",
        splitMethod: "percentage",
        participants: [
          { personId: null, percentage: "50" },
          { personId: arun.id, percentage: "30" },
          { personId: vijay.id, percentage: "20" },
        ],
      }),
    );

    expect(await sharesOf(expense.id)).toEqual({
      user: "500.00",
      [arun.id]: "300.00",
      [vijay.id]: "200.00",
    });
  });

  it("keeps the total exact when a percentage does not divide cleanly", async () => {
    const expense = expectData(
      await postShared({
        amount: "1000",
        splitMethod: "percentage",
        participants: [
          { personId: null, percentage: "33.33" },
          { personId: arun.id, percentage: "33.33" },
          { personId: vijay.id, percentage: "33.34" },
        ],
      }),
    );

    const shares = await sharesOf(expense.id);
    const total = Object.values(shares).reduce((sum, value) => sum + Number(value), 0);
    expect(total).toBeCloseTo(1000, 2);
  });

  it("rejects percentages that do not add up to 100", async () => {
    const response = await postShared({
      amount: "1000",
      splitMethod: "percentage",
      participants: [
        { personId: null, percentage: "50" },
        { personId: arun.id, percentage: "30" },
      ],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_SPLIT");
    expect(expectError(response).message).toMatch(/add up to 100/i);
  });

  it("requires a percentage for every participant", async () => {
    const response = await postShared({
      amount: "1000",
      splitMethod: "percentage",
      participants: [{ personId: null, percentage: "100" }, { personId: arun.id }],
    });

    expect(response.status).toBe(400);
  });
});

describe("someone else pays", () => {
  it("records the payer and charges no account of the user's", async () => {
    const expense = expectData(
      await postShared({
        amount: "900",
        description: "Groceries",
        accountId: null,
        paidByPersonId: arun.id,
        participants: [{ personId: null }, { personId: arun.id }],
      }),
    );

    expect(expense.paidByPersonId).toBe(arun.id);
    expect(expense.accountId).toBeNull();

    // No account of the user's moved.
    expect(await accountBalance(account.id)).toBe("50000");

    // But the user owes their share.
    const balance = await personBalance(arun.id);
    expect(balance.direction).toBe("user_owes_person");
    expect(balance.userOwesPerson.amount).toBe("450");
  });

  it("rejects an account when another person paid", async () => {
    const response = await postShared({
      amount: "900",
      accountId: account.id,
      paidByPersonId: arun.id,
      participants: [{ personId: null }, { personId: arun.id }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
    expect(expectError(response).message).toMatch(/someone else paid/i);
  });

  it("requires an account when the user paid", async () => {
    const response = await postShared({ accountId: null });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
    expect(expectError(response).message).toMatch(/account you paid from/i);
  });

  it("ignores an obligation between two other people", async () => {
    // Arun paid, only Vijay consumed. Not the user's business.
    await postShared({
      amount: "600",
      accountId: null,
      paidByPersonId: arun.id,
      participants: [{ personId: vijay.id, amount: "600" }],
      splitMethod: "custom",
    });

    expect((await personBalance(arun.id)).isSettled).toBe(true);
    expect((await personBalance(vijay.id)).isSettled).toBe(true);
  });

  it("rejects another user's person as the payer", async () => {
    const other = await createTestUser();
    const theirPerson = await seedPerson(other.id, "Theirs");

    const response = await postShared({
      accountId: null,
      paidByPersonId: theirPerson.id,
      participants: [{ personId: null }, { personId: arun.id }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_PERSON");
  });
});

describe("participant validation", () => {
  it("rejects a duplicate participant", async () => {
    const response = await postShared({
      participants: [{ personId: arun.id }, { personId: arun.id }],
    });

    expect(response.status).toBe(400);
    // A problem with the list itself, rather than with any one person.
    expect(expectError(response).code).toBe("INVALID_PARTICIPANT");
    expect(expectError(response).message).toMatch(/twice/i);
  });

  it("rejects an expense with only the user", async () => {
    const response = await postShared({ participants: [{ personId: null }] });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_PARTICIPANT");
    expect(expectError(response).message).toMatch(/at least one other person/i);
  });

  it("rejects an empty participant list", async () => {
    const response = await postShared({ participants: [] });
    expect(response.status).toBe(400);
  });

  it("rejects another user's person as a participant", async () => {
    const other = await createTestUser();
    const theirPerson = await seedPerson(other.id, "Theirs");

    const response = await postShared({
      participants: [{ personId: null }, { personId: theirPerson.id }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_PERSON");
  });

  it("rejects an archived person", async () => {
    const { archivePerson } = await import("@/server/services/people/person-service");
    await archivePerson(user.id, arun.id);

    const response = await postShared({
      participants: [{ personId: null }, { personId: arun.id }],
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/archived/i);
  });
});

describe("idempotency and atomicity", () => {
  it("returns the original expense for a repeated clientId", async () => {
    const id = clientId("txn");

    const first = expectData(await postShared({ clientId: id, amount: "900" }));
    const second = expectData(await postShared({ clientId: id, amount: "9999" }));

    expect(second.id).toBe(first.id);
    expect(second.amount.amount).toBe("900");

    // No duplicate splits and the balance moved once.
    expect(await splits.listByTransaction(user.id, first.id)).toHaveLength(3);
    expect(await accountBalance(account.id)).toBe("49100");
  });

  it("writes no transaction when the split is invalid", async () => {
    const response = await postShared({
      amount: "1000",
      splitMethod: "custom",
      participants: [
        { personId: null, amount: "400" },
        { personId: arun.id, amount: "400" },
      ],
    });

    expect(response.status).toBe(400);
    // The balance is untouched, so nothing was partially written.
    expect(await accountBalance(account.id)).toBe("50000");
  });
});

describe("GET /api/expenses/:id for a shared expense", () => {
  it("lists every participant with their share", async () => {
    const created = expectData(await postShared({ amount: "900" }));

    const detail = expectData(
      await invokeRoute<ExpenseDetailView>(getExpense, `/api/expenses/${created.id}`, {
        params: { id: created.id },
      }),
    );

    expect(detail.isShared).toBe(true);
    expect(detail.participants).toHaveLength(3);
    expect(detail.participants.map((p) => p.name).sort()).toEqual(["Arun", "Vijay", "You"]);
    expect(detail.participants.every((p) => p.formattedShare.includes("300"))).toBe(true);
    expect(detail.paidByName).toBe("You");
  });
});

describe("PATCH /api/expenses/shared/:id", () => {
  it("re-splits when the amount and participants change together", async () => {
    const created = expectData(await postShared({ amount: "900" }));

    const updated = expectData(
      await invokeRoute<TransactionListItem>(patchShared, `/api/expenses/shared/${created.id}`, {
        method: "PATCH",
        params: { id: created.id },
        body: {
          amount: "1200",
          splitMethod: "equal",
          participants: [{ personId: null }, { personId: arun.id }, { personId: vijay.id }],
        },
      }),
    );

    expect(updated.amount.amount).toBe("1200");
    expect(updated.userShare.amount).toBe("400");

    expect(await sharesOf(created.id)).toEqual({
      user: "400.00",
      [arun.id]: "400.00",
      [vijay.id]: "400.00",
    });

    // The balance reflects only the new amount.
    expect(await accountBalance(account.id)).toBe("48800");
  });

  it("refuses to change the amount without a new split", async () => {
    const created = expectData(await postShared({ amount: "900" }));

    const response = await invokeRoute(patchShared, `/api/expenses/shared/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: { amount: "1200" },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_SPLIT");
    expect(expectError(response).message).toMatch(/updated split/i);
  });

  it("changes the participants and rewrites the shares", async () => {
    const created = expectData(await postShared({ amount: "900" }));

    await invokeRoute(patchShared, `/api/expenses/shared/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: {
        splitMethod: "custom",
        participants: [
          { personId: null, amount: "300" },
          { personId: arun.id, amount: "600" },
        ],
      },
    });

    expect(await sharesOf(created.id)).toEqual({ user: "300.00", [arun.id]: "600.00" });

    // Vijay no longer owes anything.
    expect((await personBalance(vijay.id)).isSettled).toBe(true);
    expect((await personBalance(arun.id)).personOwesUser.amount).toBe("600");
  });

  it("switches the payer to a person and clears the account", async () => {
    const created = expectData(await postShared({ amount: "900" }));

    const updated = expectData(
      await invokeRoute<TransactionListItem>(patchShared, `/api/expenses/shared/${created.id}`, {
        method: "PATCH",
        params: { id: created.id },
        body: { paidByPersonId: arun.id, accountId: null },
      }),
    );

    expect(updated.paidByPersonId).toBe(arun.id);
    expect(updated.accountId).toBeNull();

    // The account is restored, and the direction of the balance flips.
    expect(await accountBalance(account.id)).toBe("50000");
    expect((await personBalance(arun.id)).direction).toBe("user_owes_person");
  });

  it("updates the description, date, category and notes", async () => {
    const created = expectData(await postShared());

    const updated = expectData(
      await invokeRoute<TransactionListItem>(patchShared, `/api/expenses/shared/${created.id}`, {
        method: "PATCH",
        params: { id: created.id },
        body: { description: "Renamed dinner", notes: "Birthday" },
      }),
    );

    expect(updated.description).toBe("Renamed dinner");
    expect(updated.notes).toBe("Birthday");
  });

  it("rejects an invalid new split and leaves the old one intact", async () => {
    const created = expectData(await postShared({ amount: "900" }));

    const response = await invokeRoute(patchShared, `/api/expenses/shared/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: {
        splitMethod: "custom",
        participants: [
          { personId: null, amount: "100" },
          { personId: arun.id, amount: "100" },
        ],
      },
    });

    expect(response.status).toBe(400);
    expect(await sharesOf(created.id)).toEqual({
      user: "300.00",
      [arun.id]: "300.00",
      [vijay.id]: "300.00",
    });
  });

  it("refuses to change a settled expense", async () => {
    const created = expectData(await postShared({ amount: "900" }));
    const rows = await splits.listByTransaction(user.id, created.id);
    const arunSplit = rows.find((row) => row.personId === arun.id)!;

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: "300" }],
    });

    const response = await invokeRoute(patchShared, `/api/expenses/shared/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: {
        splitMethod: "equal",
        participants: [{ personId: null }, { personId: arun.id }],
      },
    });

    expect(response.status).toBe(409);
    expect(expectError(response).code).toBe("EXPENSE_HAS_SETTLEMENTS");
  });

  it("rejects a stale sync version", async () => {
    const created = expectData(await postShared());

    await invokeRoute(patchShared, `/api/expenses/shared/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: { description: "First" },
    });

    const stale = await invokeRoute(patchShared, `/api/expenses/shared/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: { description: "Second", expectedSyncVersion: created.syncVersion },
    });

    expect(stale.status).toBe(409);
  });

  it("reports 404 for a personal expense", async () => {
    const { POST: createPersonal } = await import("@/app/api/expenses/route");
    const personal = expectData(
      await invokeRoute<TransactionListItem>(createPersonal, "/api/expenses", {
        method: "POST",
        body: {
          clientId: clientId("txn"),
          amount: "450",
          description: "Solo lunch",
          date: "2026-08-15T10:00:00.000Z",
          accountId: account.id,
        },
      }),
    );

    const response = await invokeRoute(patchShared, `/api/expenses/shared/${personal.id}`, {
      method: "PATCH",
      params: { id: personal.id },
      body: { description: "Nope" },
    });

    expect(response.status).toBe(404);
  });

  it("does not update another user's expense", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);
    const theirPerson = await seedPerson(other.id, "Theirs");

    setCurrentTestUser(other);
    const theirs = expectData(
      await invokeRoute<TransactionListItem>(createShared, "/api/expenses/shared", {
        method: "POST",
        body: {
          clientId: clientId("txn"),
          amount: "500",
          description: "Theirs",
          date: "2026-08-15T10:00:00.000Z",
          accountId: theirAccount.id,
          splitMethod: "equal",
          participants: [{ personId: null }, { personId: theirPerson.id }],
        },
      }),
    );

    setCurrentTestUser(user);
    const response = await invokeRoute(patchShared, `/api/expenses/shared/${theirs.id}`, {
      method: "PATCH",
      params: { id: theirs.id },
      body: { description: "Mine now" },
    });

    expect(response.status).toBe(404);
  });
});

describe("personal endpoint rejects a shared expense", () => {
  it("reports 404 from PATCH /api/expenses/:id", async () => {
    const created = expectData(await postShared());

    const response = await invokeRoute(patchPersonal, `/api/expenses/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: { amount: "1000" },
    });

    expect(response.status).toBe(404);
  });
});

describe("deleting a shared expense", () => {
  it("removes every split and clears the person balances", async () => {
    const created = expectData(await postShared({ amount: "900" }));

    const response = await invokeRoute(deleteExpense, `/api/expenses/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(response.status).toBe(204);
    expect(await splits.listByTransaction(user.id, created.id)).toHaveLength(0);
    expect(await accountBalance(account.id)).toBe("50000");
    expect((await personBalance(arun.id)).isSettled).toBe(true);
    expect((await personBalance(vijay.id)).isSettled).toBe(true);
  });

  it("refuses to delete a settled shared expense", async () => {
    const created = expectData(await postShared({ amount: "900" }));
    const rows = await splits.listByTransaction(user.id, created.id);

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "300",
      accountId: account.id,
      allocations: [
        { expenseSplitId: rows.find((row) => row.personId === arun.id)!.id, amount: "300" },
      ],
    });

    const response = await invokeRoute(deleteExpense, `/api/expenses/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(response.status).toBe(409);
  });
});

describe("split total invariant", () => {
  it("holds for many amounts and participant counts", async () => {
    const third = await seedPerson(user.id, "Priya");
    const people = [arun.id, vijay.id, third.id];

    for (const amount of ["0.03", "1", "10.01", "999.99", "1234.57"]) {
      for (let count = 1; count <= people.length; count += 1) {
        const expense = expectData(
          await postShared({
            clientId: clientId("txn"),
            amount,
            participants: [
              { personId: null },
              ...people.slice(0, count).map((id) => ({ personId: id })),
            ],
          }),
        );

        const shares = await sharesOf(expense.id);
        const total = Object.values(shares).reduce((sum, value) => sum + Number(value), 0);

        expect(total).toBeCloseTo(Number(amount), 2);
      }
    }
  });

  it("verifies the settlement helper agrees with the stored splits", async () => {
    const created = expectData(await postShared({ amount: "1000" }));
    const arunSplit = splitForPerson(
      { splits: await splits.listByTransaction(user.id, created.id) },
      arun.id,
    );

    // Settling exactly the stored share should clear that person's balance.
    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: arunSplit.shareAmount.toString(),
      accountId: account.id,
      allocations: [{ expenseSplitId: arunSplit.id, amount: arunSplit.shareAmount.toString() }],
    });

    expect((await personBalance(arun.id)).isSettled).toBe(true);
  });
});
