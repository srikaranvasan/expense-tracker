import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { Category } from "@/domain/categories/entities";
import type { User } from "@/domain/users/entities";
import type {
  ExpenseDetailView,
  TransactionListItem,
} from "@/features/transactions/view-models/expense-view-model";
import { collections } from "@/server/db/collections";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
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
  seedCreditCard,
  seedPerson,
  seedSettlement,
  seedSharedExpense,
  splitForPerson,
} from "@tests/helpers/seed";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { GET: listExpenses, POST: createExpense } = await import("@/app/api/expenses/route");
const {
  GET: getExpense,
  PATCH: patchExpense,
  DELETE: deleteExpense,
} = await import("@/app/api/expenses/[id]/route");
const { GET: getAccount } = await import("@/app/api/accounts/[id]/route");

const splits = expenseSplitRepository();

let user: User;
let account: Account;
let food: Category;

type ListResponse = { items: TransactionListItem[]; nextCursor: string | null; hasMore: boolean };

async function postExpense(body: Record<string, unknown> = {}) {
  return invokeRoute<TransactionListItem>(createExpense, "/api/expenses", {
    method: "POST",
    body: {
      clientId: clientId("txn"),
      amount: "450",
      description: "Groceries",
      date: "2026-08-15T10:00:00.000Z",
      accountId: account.id,
      ...body,
    },
  });
}

async function fetchList(searchParams: Record<string, string | number> = {}) {
  return expectData(
    await invokeRoute<ListResponse>(listExpenses, "/api/expenses", { searchParams }),
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
  food = (await categoryRepository().list(user.id)).find((c) => c.name === "Food")!;
});

describe("POST /api/expenses", () => {
  it("records an expense and reduces the account balance", async () => {
    const response = await postExpense();

    expect(response.status).toBe(201);
    const expense = expectData(response);
    expect(expense.description).toBe("Groceries");
    expect(expense.amount.amount).toBe("450");
    expect(expense.userShare.amount).toBe("450");
    expect(expense.isShared).toBe(false);
    expect(expense.isSplit).toBe(false);

    expect(await accountBalance(account.id)).toBe("49550");
  });

  it("creates exactly one user split covering the full amount", async () => {
    const expense = expectData(await postExpense({ amount: "1200" }));

    const created = await splits.listByTransaction(user.id, expense.id);
    expect(created).toHaveLength(1);
    expect(created[0]?.participantType).toBe("user");
    expect(created[0]?.personId).toBeNull();
    expect(created[0]?.shareAmount.toFixedString()).toBe("1200.00");
  });

  it("stores an optional category and notes", async () => {
    const expense = expectData(await postExpense({ categoryId: food.id, notes: "Weekly shop" }));

    expect(expense.categoryId).toBe(food.id);
    expect(expense.notes).toBe("Weekly shop");
  });

  it("allows an expense with no category", async () => {
    const expense = expectData(await postExpense({ categoryId: null }));
    expect(expense.categoryId).toBeNull();
  });

  it("records an expense charged to a credit card", async () => {
    const card = await seedCreditCard(user.id, { creditLimit: "150000" });

    const expense = expectData(await postExpense({ accountId: card.id, amount: "1200" }));
    expect(expense.amount.amount).toBe("1200");

    const view = expectData(
      await invokeRoute<{ outstanding: { amount: string }; availableCredit: { amount: string } }>(
        getAccount,
        `/api/accounts/${card.id}`,
        { params: { id: card.id } },
      ),
    );

    expect(view.outstanding.amount).toBe("1200");
    expect(view.availableCredit.amount).toBe("148800");
  });

  it("normalises whitespace in the description", async () => {
    const expense = expectData(await postExpense({ description: "  Weekly   shop  " }));
    expect(expense.description).toBe("Weekly shop");
  });

  it("rejects a zero or negative amount", async () => {
    for (const amount of ["0", "-100"]) {
      const response = await postExpense({ amount });
      expect(response.status).toBe(400);
    }
  });

  it("rejects an over-precise amount rather than rounding it", async () => {
    const response = await postExpense({ amount: "10.005" });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/decimal places|too many decimal/i);
  });

  it("rejects an amount that is not a number", async () => {
    const response = await postExpense({ amount: "four fifty" });
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an empty description", async () => {
    const response = await postExpense({ description: "   " });
    expect(response.status).toBe(400);
  });

  it("requires an account", async () => {
    const response = await invokeRoute(createExpense, "/api/expenses", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "450",
        description: "Groceries",
        date: "2026-08-15T10:00:00.000Z",
      },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });

  it("rejects another user's account", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);

    const response = await postExpense({ accountId: theirAccount.id });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });

  it("rejects an archived account", async () => {
    const { archiveAccount } = await import("@/server/services/accounts/account-service");
    await archiveAccount(user.id, account.id);

    const response = await postExpense();

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/archived/i);
  });

  it("rejects another user's category", async () => {
    const other = await createTestUser();
    const theirCategory = (await categoryRepository().list(other.id))[0]!;

    const response = await postExpense({ categoryId: theirCategory.id });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_CATEGORY");
  });

  it("rejects an archived category", async () => {
    const { archiveCategory } = await import("@/server/services/categories/category-service");
    await archiveCategory(user.id, food.id);

    const response = await postExpense({ categoryId: food.id });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/archived/i);
  });

  it("rejects an invalid date", async () => {
    const response = await postExpense({ date: "not-a-date" });
    expect(response.status).toBe(400);
  });

  it("is idempotent for a repeated clientId", async () => {
    const id = clientId("txn");

    const first = expectData(await postExpense({ clientId: id }));
    const second = expectData(await postExpense({ clientId: id, amount: "999" }));

    expect(second.id).toBe(first.id);
    expect(second.amount.amount).toBe("450");

    // No duplicate transaction and no duplicate split.
    const transactions = await collections.transactions();
    expect(await transactions.countDocuments({ clientId: id })).toBe(1);
    expect(await splits.listByTransaction(user.id, first.id)).toHaveLength(1);

    // And the balance moved only once.
    expect(await accountBalance(account.id)).toBe("49550");
  });

  it("requires authentication", async () => {
    setCurrentTestUser(null);
    expect((await postExpense()).status).toBe(401);
  });
});

describe("GET /api/expenses", () => {
  it("returns expenses newest first", async () => {
    await postExpense({ description: "Older", date: "2026-08-01T10:00:00.000Z" });
    await postExpense({ description: "Newer", date: "2026-08-20T10:00:00.000Z" });

    const { items } = await fetchList();
    expect(items.map((item) => item.description)).toEqual(["Newer", "Older"]);
  });

  it("paginates with a cursor and does not repeat rows", async () => {
    for (let index = 0; index < 5; index += 1) {
      await postExpense({
        description: `Expense ${index}`,
        date: `2026-08-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
      });
    }

    const first = await fetchList({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);

    const second = await fetchList({ limit: 2, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(2);

    const seen = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(seen.size).toBe(4);

    const third = await fetchList({ limit: 2, cursor: second.nextCursor! });
    expect(third.items).toHaveLength(1);
    expect(third.hasMore).toBe(false);
    expect(third.nextCursor).toBeNull();
  });

  it("rejects a malformed cursor", async () => {
    const response = await invokeRoute(listExpenses, "/api/expenses", {
      searchParams: { cursor: "not-a-cursor" },
    });

    expect(response.status).toBe(400);
  });

  it("filters by account", async () => {
    const other = await seedBankAccount(user.id, { name: "ICICI" });
    await postExpense({ description: "From HDFC" });
    await postExpense({ description: "From ICICI", accountId: other.id });

    const { items } = await fetchList({ accountId: other.id });
    expect(items.map((item) => item.description)).toEqual(["From ICICI"]);
  });

  it("filters by category", async () => {
    await postExpense({ description: "Food expense", categoryId: food.id });
    await postExpense({ description: "Uncategorised" });

    const { items } = await fetchList({ categoryId: food.id });
    expect(items.map((item) => item.description)).toEqual(["Food expense"]);
  });

  it("filters by date range", async () => {
    await postExpense({ description: "July", date: "2026-07-15T10:00:00.000Z" });
    await postExpense({ description: "August", date: "2026-08-15T10:00:00.000Z" });

    const { items } = await fetchList({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.000Z",
    });

    expect(items.map((item) => item.description)).toEqual(["August"]);
  });

  it("searches the description", async () => {
    await postExpense({ description: "Weekly groceries" });
    await postExpense({ description: "Cinema tickets" });

    const { items } = await fetchList({ search: "grocer" });
    expect(items.map((item) => item.description)).toEqual(["Weekly groceries"]);
  });

  it("treats a regex metacharacter in the search term as a literal", async () => {
    await postExpense({ description: "Weekly groceries" });

    const { items } = await fetchList({ search: ".*" });
    expect(items).toHaveLength(0);
  });

  it("filters personal expenses from shared ones", async () => {
    const arun = await seedPerson(user.id, "Arun");

    await postExpense({ description: "Personal lunch" });
    await seedSharedExpense(user.id, {
      amount: "1000",
      description: "Group dinner",
      accountId: account.id,
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    const personal = await fetchList({ shared: "false" });
    expect(personal.items.map((item) => item.description)).toEqual(["Personal lunch"]);

    const shared = await fetchList({ shared: "true" });
    expect(shared.items.map((item) => item.description)).toEqual(["Group dinner"]);
  });

  it("filters by person", async () => {
    const arun = await seedPerson(user.id, "Arun");
    const vijay = await seedPerson(user.id, "Vijay");

    await seedSharedExpense(user.id, {
      amount: "600",
      description: "With Arun",
      accountId: account.id,
      participants: [
        { personId: null, share: "300" },
        { personId: arun.id, share: "300" },
      ],
    });
    await seedSharedExpense(user.id, {
      amount: "800",
      description: "With Vijay",
      accountId: account.id,
      participants: [
        { personId: null, share: "400" },
        { personId: vijay.id, share: "400" },
      ],
    });

    const { items } = await fetchList({ personId: arun.id });
    expect(items.map((item) => item.description)).toEqual(["With Arun"]);
  });

  it("reports the user's share separately for a shared expense", async () => {
    const arun = await seedPerson(user.id, "Arun");

    await seedSharedExpense(user.id, {
      amount: "1200",
      description: "Group dinner",
      accountId: account.id,
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "800" },
      ],
    });

    const { items } = await fetchList();
    const dinner = items.find((item) => item.description === "Group dinner")!;

    expect(dinner.amount.amount).toBe("1200");
    expect(dinner.userShare.amount).toBe("400");
    expect(dinner.isSplit).toBe(true);
    expect(dinner.isShared).toBe(true);
    expect(dinner.participantCount).toBe(2);
  });

  it("excludes deleted expenses", async () => {
    const expense = expectData(await postExpense());
    await invokeRoute(deleteExpense, `/api/expenses/${expense.id}`, {
      method: "DELETE",
      params: { id: expense.id },
    });

    const { items } = await fetchList();
    expect(items).toHaveLength(0);
  });

  it("does not return another user's expenses", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);
    setCurrentTestUser(other);
    await postExpense({ accountId: theirAccount.id, description: "Theirs" });

    setCurrentTestUser(user);
    const { items } = await fetchList();
    expect(items).toHaveLength(0);
  });
});

describe("GET /api/expenses/:id", () => {
  it("returns detail with resolved names", async () => {
    const created = expectData(await postExpense({ categoryId: food.id, notes: "Weekly" }));

    const detail = expectData(
      await invokeRoute<ExpenseDetailView>(getExpense, `/api/expenses/${created.id}`, {
        params: { id: created.id },
      }),
    );

    expect(detail.accountName).toBe("HDFC Savings");
    expect(detail.categoryName).toBe("Food");
    expect(detail.paidByName).toBe("You");
    expect(detail.notes).toBe("Weekly");
    expect(detail.participants).toHaveLength(1);
    expect(detail.participants[0]?.isUser).toBe(true);
  });

  it("names each participant of a shared expense", async () => {
    const arun = await seedPerson(user.id, "Arun");
    const shared = await seedSharedExpense(user.id, {
      amount: "1000",
      description: "Dinner",
      accountId: account.id,
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    const detail = expectData(
      await invokeRoute<ExpenseDetailView>(getExpense, `/api/expenses/${shared.transaction.id}`, {
        params: { id: shared.transaction.id },
      }),
    );

    expect(detail.participants.map((p) => p.name).sort()).toEqual(["Arun", "You"]);
  });

  it("names the payer when someone else paid", async () => {
    const arun = await seedPerson(user.id, "Arun");
    const shared = await seedSharedExpense(user.id, {
      amount: "900",
      description: "Groceries",
      paidByPersonId: arun.id,
      accountId: null,
      participants: [
        { personId: null, share: "450" },
        { personId: arun.id, share: "450" },
      ],
    });

    const detail = expectData(
      await invokeRoute<ExpenseDetailView>(getExpense, `/api/expenses/${shared.transaction.id}`, {
        params: { id: shared.transaction.id },
      }),
    );

    expect(detail.paidByName).toBe("Arun");
    expect(detail.accountName).toBeNull();
  });

  it("returns 404 for another user's expense", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);
    setCurrentTestUser(other);
    const theirs = expectData(await postExpense({ accountId: theirAccount.id }));

    setCurrentTestUser(user);
    const response = await invokeRoute(getExpense, `/api/expenses/${theirs.id}`, {
      params: { id: theirs.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/expenses/:id", () => {
  it("updates the amount and rewrites the user split", async () => {
    const created = expectData(await postExpense({ amount: "450" }));

    const updated = expectData(
      await invokeRoute<TransactionListItem>(patchExpense, `/api/expenses/${created.id}`, {
        method: "PATCH",
        params: { id: created.id },
        body: { amount: "600" },
      }),
    );

    expect(updated.amount.amount).toBe("600");
    expect(updated.userShare.amount).toBe("600");

    const current = await splits.listByTransaction(user.id, created.id);
    expect(current).toHaveLength(1);
    expect(current[0]?.shareAmount.toFixedString()).toBe("600.00");

    // The balance reflects the new amount, not both.
    expect(await accountBalance(account.id)).toBe("49400");
  });

  it("updates the description, date, category and notes", async () => {
    const created = expectData(await postExpense());

    const updated = expectData(
      await invokeRoute<TransactionListItem>(patchExpense, `/api/expenses/${created.id}`, {
        method: "PATCH",
        params: { id: created.id },
        body: {
          description: "Renamed",
          date: "2026-09-01T10:00:00.000Z",
          categoryId: food.id,
          notes: "Updated note",
        },
      }),
    );

    expect(updated.description).toBe("Renamed");
    expect(updated.categoryId).toBe(food.id);
    expect(updated.notes).toBe("Updated note");
    expect(updated.date.startsWith("2026-09-01")).toBe(true);
  });

  it("moves the expense to another account", async () => {
    const other = await seedBankAccount(user.id, { name: "ICICI", openingBalance: "10000" });
    const created = expectData(await postExpense({ amount: "450" }));

    await invokeRoute(patchExpense, `/api/expenses/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: { accountId: other.id },
    });

    expect(await accountBalance(account.id)).toBe("50000");
    expect(await accountBalance(other.id)).toBe("9550");
  });

  it("clears the category when sent null", async () => {
    const created = expectData(await postExpense({ categoryId: food.id }));

    const updated = expectData(
      await invokeRoute<TransactionListItem>(patchExpense, `/api/expenses/${created.id}`, {
        method: "PATCH",
        params: { id: created.id },
        body: { categoryId: null },
      }),
    );

    expect(updated.categoryId).toBeNull();
  });

  it("rejects an empty update", async () => {
    const created = expectData(await postExpense());

    const response = await invokeRoute(patchExpense, `/api/expenses/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: {},
    });

    expect(response.status).toBe(400);
  });

  it("rejects a stale sync version", async () => {
    const created = expectData(await postExpense());

    await invokeRoute(patchExpense, `/api/expenses/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: { description: "First" },
    });

    const stale = await invokeRoute(patchExpense, `/api/expenses/${created.id}`, {
      method: "PATCH",
      params: { id: created.id },
      body: { description: "Second", expectedSyncVersion: created.syncVersion },
    });

    expect(stale.status).toBe(409);
  });

  it("reports 404 for a shared expense, which needs the split editor", async () => {
    const arun = await seedPerson(user.id, "Arun");
    const shared = await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: account.id,
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    const response = await invokeRoute(patchExpense, `/api/expenses/${shared.transaction.id}`, {
      method: "PATCH",
      params: { id: shared.transaction.id },
      body: { amount: "1200" },
    });

    expect(response.status).toBe(404);
  });

  it("does not update another user's expense", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);
    setCurrentTestUser(other);
    const theirs = expectData(await postExpense({ accountId: theirAccount.id }));

    setCurrentTestUser(user);
    const response = await invokeRoute(patchExpense, `/api/expenses/${theirs.id}`, {
      method: "PATCH",
      params: { id: theirs.id },
      body: { description: "Mine now" },
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/expenses/:id", () => {
  it("soft-deletes the expense and its splits, restoring the balance", async () => {
    const created = expectData(await postExpense({ amount: "450" }));
    expect(await accountBalance(account.id)).toBe("49550");

    const response = await invokeRoute(deleteExpense, `/api/expenses/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(response.status).toBe(204);
    expect(await accountBalance(account.id)).toBe("50000");

    // The row survives, marked deleted.
    const transactions = await collections.transactions();
    const raw = await transactions.findOne({ clientId: created.clientId });
    expect(raw?.deletedAt).toBeInstanceOf(Date);

    // The split is deleted too, so it no longer contributes anywhere.
    expect(await splits.listByTransaction(user.id, created.id)).toHaveLength(0);
  });

  it("refuses to delete twice", async () => {
    const created = expectData(await postExpense());

    await invokeRoute(deleteExpense, `/api/expenses/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    const second = await invokeRoute(deleteExpense, `/api/expenses/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(second.status).toBe(404);
  });

  it("refuses to delete a settled expense", async () => {
    const arun = await seedPerson(user.id, "Arun");
    const shared = await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: account.id,
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "500",
      accountId: account.id,
      allocations: [{ expenseSplitId: splitForPerson(shared, arun.id).id, amount: "500" }],
    });

    const response = await invokeRoute(deleteExpense, `/api/expenses/${shared.transaction.id}`, {
      method: "DELETE",
      params: { id: shared.transaction.id },
    });

    expect(response.status).toBe(409);
    expect(expectError(response).code).toBe("EXPENSE_HAS_SETTLEMENTS");
  });

  it("does not delete another user's expense", async () => {
    const other = await createTestUser();
    const theirAccount = await seedBankAccount(other.id);
    setCurrentTestUser(other);
    const theirs = expectData(await postExpense({ accountId: theirAccount.id }));

    setCurrentTestUser(user);
    const response = await invokeRoute(deleteExpense, `/api/expenses/${theirs.id}`, {
      method: "DELETE",
      params: { id: theirs.id },
    });

    expect(response.status).toBe(404);
  });
});
