import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { Category } from "@/domain/categories/entities";
import type { Person } from "@/domain/people/entities";
import type { User } from "@/domain/users/entities";
import type { TransactionListItem } from "@/features/transactions/view-models/expense-view-model";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { expectData, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId } from "@tests/helpers/fixtures";
import {
  seedBankAccount,
  seedCashAccount,
  seedCreditCard,
  seedPerson,
  seedPersonalExpense,
  seedSettlement,
  seedSharedExpense,
  splitForPerson,
} from "@tests/helpers/seed";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { GET: listTransactions } = await import("@/app/api/expenses/route");
const { POST: createTransfer } = await import("@/app/api/transfers/route");
const { POST: createCardPayment } = await import("@/app/api/credit-card-payments/route");

let user: User;
let bank: Account;
let cash: Account;
let food: Category;
let arun: Person;

type HistoryResponse = {
  items: TransactionListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  accountNames: Record<string, string>;
  categoryNames: Record<string, string>;
  personNames: Record<string, string>;
};

function dayInMonth(day: number): Date {
  return new Date(Date.UTC(2026, 7, day, 10, 0, 0));
}

async function history(
  searchParams: Record<string, string | number> = {},
): Promise<HistoryResponse> {
  return expectData(
    await invokeRoute<HistoryResponse>(listTransactions, "/api/expenses", { searchParams }),
  );
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR", timezone: "Asia/Kolkata" });
  bank = await seedBankAccount(user.id, { openingBalance: "50000" });
  cash = await seedCashAccount(user.id, { openingBalance: "5000" });
  food = (await categoryRepository().list(user.id)).find((c) => c.name === "Food")!;
  arun = await seedPerson(user.id, "Arun");
});

describe("row content", () => {
  it("carries everything a row needs to render", async () => {
    await seedPersonalExpense(user.id, {
      amount: "450",
      description: "Groceries",
      accountId: bank.id,
      categoryId: food.id,
      date: dayInMonth(15),
    });

    const view = await history();
    const row = view.items[0]!;

    expect(row.description).toBe("Groceries");
    expect(row.typeLabel).toBe("Expense");
    expect(row.formattedAmount).toContain("450");
    expect(row.accountId).toBe(bank.id);
    expect(row.categoryId).toBe(food.id);
    expect(row.dateLabel).toBeTruthy();
    expect(row.dayLabel).toBeTruthy();

    // Names come with the page so no row needs a lookup of its own.
    expect(view.accountNames[bank.id]).toBe(bank.name);
    expect(view.categoryNames[food.id]).toBe(food.name);
  });

  it("labels every transaction type", async () => {
    const card = await seedCreditCard(user.id, { creditLimit: "100000", openingBalance: "5000" });
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id, date: dayInMonth(1) });

    await invokeRoute(createTransfer, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "1000",
        fromAccountId: bank.id,
        toAccountId: cash.id,
        date: dayInMonth(2).toISOString(),
      },
    });

    await invokeRoute(createCardPayment, "/api/credit-card-payments", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "2000",
        fromAccountId: bank.id,
        toAccountId: card.id,
        date: dayInMonth(3).toISOString(),
      },
    });

    const view = await history();
    const labels = new Map(view.items.map((item) => [item.type, item.typeLabel]));

    expect(labels.get("expense")).toBe("Expense");
    expect(labels.get("transfer")).toBe("Transfer");
    expect(labels.get("credit_card_payment")).toBe("Card payment");
  });

  it("exposes both accounts on a transfer row so it can show a direction", async () => {
    await invokeRoute(createTransfer, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "1000",
        fromAccountId: bank.id,
        toAccountId: cash.id,
        date: dayInMonth(2).toISOString(),
      },
    });

    const view = await history();
    const row = view.items[0]!;

    expect(row.fromAccountId).toBe(bank.id);
    expect(row.toAccountId).toBe(cash.id);
    expect(view.accountNames[bank.id]).toBe(bank.name);
    expect(view.accountNames[cash.id]).toBe(cash.name);
  });

  it("flags a shared expense and names the payer when it was someone else", async () => {
    await seedSharedExpense(user.id, {
      amount: "800",
      accountId: null,
      paidByPersonId: arun.id,
      date: dayInMonth(10),
      participants: [
        { personId: null, share: "300" },
        { personId: arun.id, share: "500" },
      ],
    });

    const view = await history();
    const row = view.items[0]!;

    expect(row.isShared).toBe(true);
    expect(row.participantCount).toBe(2);
    expect(row.paidByPersonId).toBe(arun.id);
    expect(view.personNames[arun.id]).toBe("Arun");
    // Only the user's own share counts as their spending.
    expect(row.userShare.amount).toBe("300");
    expect(row.isSplit).toBe(true);
  });
});

describe("settlement indicator", () => {
  it("reports no settlement state for a personal expense", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id, date: dayInMonth(1) });

    const view = await history();
    // Nothing is owed, so there is nothing to settle and no badge to show.
    expect(view.items[0]?.settlementStatus).toBeNull();
    expect(view.items[0]?.settlementLabel).toBeNull();
  });

  it("reports unsettled for a fresh shared expense", async () => {
    await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: bank.id,
      date: dayInMonth(5),
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "600" },
      ],
    });

    const view = await history();
    expect(view.items[0]?.settlementStatus).toBe("unsettled");
    expect(view.items[0]?.outstandingShareCount).toBe(1);
  });

  it("reports partly settled after a partial payment", async () => {
    const expense = await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: bank.id,
      date: dayInMonth(5),
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "600" },
      ],
    });

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "200",
      accountId: bank.id,
      date: dayInMonth(6),
      allocations: [{ expenseSplitId: splitForPerson(expense, arun.id).id, amount: "200" }],
    });

    const view = await history();
    const row = view.items.find((item) => item.id === expense.transaction.id)!;

    expect(row.settlementStatus).toBe("partially_settled");
    expect(row.settlementLabel).toBe("Part settled");
    expect(row.outstandingShareCount).toBe(1);
  });

  it("reports settled once the share is fully paid", async () => {
    const expense = await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: bank.id,
      date: dayInMonth(5),
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "600" },
      ],
    });

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "600",
      accountId: bank.id,
      date: dayInMonth(6),
      allocations: [{ expenseSplitId: splitForPerson(expense, arun.id).id, amount: "600" }],
    });

    const view = await history();
    const row = view.items.find((item) => item.id === expense.transaction.id)!;

    expect(row.settlementStatus).toBe("settled");
    expect(row.outstandingShareCount).toBe(0);
  });

  it("is not settled while any one participant still owes", async () => {
    const priya = await seedPerson(user.id, "Priya");
    const expense = await seedSharedExpense(user.id, {
      amount: "900",
      accountId: bank.id,
      date: dayInMonth(5),
      participants: [
        { personId: null, share: "300" },
        { personId: arun.id, share: "300" },
        { personId: priya.id, share: "300" },
      ],
    });

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "300",
      accountId: bank.id,
      date: dayInMonth(6),
      allocations: [{ expenseSplitId: splitForPerson(expense, arun.id).id, amount: "300" }],
    });

    const view = await history();
    const row = view.items.find((item) => item.id === expense.transaction.id)!;

    // One of two people is square. Saying "settled" would be wrong.
    expect(row.settlementStatus).toBe("partially_settled");
    expect(row.outstandingShareCount).toBe(1);
  });

  it("does not give transfers a settlement state", async () => {
    await invokeRoute(createTransfer, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "1000",
        fromAccountId: bank.id,
        toAccountId: cash.id,
        date: dayInMonth(2).toISOString(),
      },
    });

    const view = await history();
    expect(view.items[0]?.settlementStatus).toBeNull();
  });
});

describe("filters", () => {
  beforeEach(async () => {
    const card = await seedCreditCard(user.id, { creditLimit: "100000" });

    await seedPersonalExpense(user.id, {
      amount: "450",
      description: "Groceries",
      accountId: bank.id,
      categoryId: food.id,
      date: dayInMonth(5),
    });
    await seedPersonalExpense(user.id, {
      amount: "1200",
      description: "Fuel",
      accountId: card.id,
      date: dayInMonth(10),
    });
    await seedSharedExpense(user.id, {
      amount: "1000",
      description: "Dinner with Arun",
      accountId: bank.id,
      date: dayInMonth(20),
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });
    await invokeRoute(createTransfer, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "2000",
        fromAccountId: bank.id,
        toAccountId: cash.id,
        date: dayInMonth(25).toISOString(),
      },
    });
  });

  it("filters by type", async () => {
    const expenses = await history({ type: "expense" });
    expect(expenses.items).toHaveLength(3);
    expect(expenses.items.every((item) => item.type === "expense")).toBe(true);

    const transfers = await history({ type: "transfer" });
    expect(transfers.items).toHaveLength(1);
    expect(transfers.items[0]?.type).toBe("transfer");
  });

  it("filters by account, matching a transfer on either side", async () => {
    const byCash = await history({ accountId: cash.id });
    // Only the transfer touches cash, and it does so as the destination.
    expect(byCash.items).toHaveLength(1);
    expect(byCash.items[0]?.type).toBe("transfer");
  });

  it("filters by category", async () => {
    const view = await history({ categoryId: food.id });
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.description).toBe("Groceries");
  });

  it("filters by person", async () => {
    const view = await history({ personId: arun.id });
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.description).toBe("Dinner with Arun");
  });

  it("filters to shared expenses only", async () => {
    const shared = await history({ shared: "true" });
    expect(shared.items).toHaveLength(1);
    expect(shared.items[0]?.isShared).toBe(true);

    const personal = await history({ shared: "false" });
    expect(personal.items).toHaveLength(2);
    expect(personal.items.every((item) => !item.isShared)).toBe(true);
  });

  it("filters by date range", async () => {
    const view = await history({
      from: dayInMonth(8).toISOString(),
      to: dayInMonth(21).toISOString(),
    });

    expect(view.items.map((item) => item.description).sort()).toEqual(["Dinner with Arun", "Fuel"]);
  });

  it("searches the description, case-insensitively", async () => {
    const view = await history({ search: "groc" });
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.description).toBe("Groceries");
  });

  it("combines filters", async () => {
    const view = await history({ type: "expense", accountId: bank.id, shared: "false" });
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.description).toBe("Groceries");
  });

  it("returns nothing rather than everything when a filter matches no rows", async () => {
    const view = await history({ search: "nothing matches this" });
    expect(view.items).toHaveLength(0);
    expect(view.hasMore).toBe(false);
  });
});

describe("pagination", () => {
  beforeEach(async () => {
    // Descending dates so page order is deterministic.
    for (let index = 1; index <= 12; index += 1) {
      await seedPersonalExpense(user.id, {
        amount: "100",
        description: `Expense ${String(index).padStart(2, "0")}`,
        accountId: bank.id,
        date: dayInMonth(index),
      });
    }
  });

  it("returns a cursor while more rows remain", async () => {
    const first = await history({ limit: 5 });

    expect(first.items).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeTruthy();
  });

  it("walks the whole list without skipping or repeating a row", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < 10; page += 1) {
      const view: HistoryResponse = await history({
        limit: 5,
        ...(cursor ? { cursor } : {}),
      });

      seen.push(...view.items.map((item) => item.description));
      cursor = view.nextCursor;
      if (!view.hasMore) break;
    }

    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
    // Newest first throughout.
    expect(seen[0]).toBe("Expense 12");
    expect(seen[11]).toBe("Expense 01");
  });

  it("stops with no cursor on the last page", async () => {
    let cursor: string | null = null;
    let last: HistoryResponse | null = null;

    for (let page = 0; page < 10; page += 1) {
      const view: HistoryResponse = await history({ limit: 5, ...(cursor ? { cursor } : {}) });
      last = view;
      cursor = view.nextCursor;
      if (!view.hasMore) break;
    }

    expect(last?.hasMore).toBe(false);
    expect(last?.nextCursor).toBeNull();
  });

  it("keeps filters applied across pages", async () => {
    await seedPersonalExpense(user.id, {
      amount: "100",
      description: "Something else",
      accountId: bank.id,
      date: dayInMonth(28),
    });

    const first = await history({ limit: 5, search: "Expense" });
    expect(first.items).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    // "Something else" is the newest row but does not match, so it must not appear.
    expect(first.items.every((item) => item.description.startsWith("Expense"))).toBe(true);

    const second = await history({ limit: 5, search: "Expense", cursor: first.nextCursor! });

    expect(second.items).toHaveLength(5);
    expect(second.items.every((item) => item.description.startsWith("Expense"))).toBe(true);

    const combined = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(combined).size).toBe(combined.length);
  });
});

describe("isolation", () => {
  it("never returns another user's transactions", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id, date: dayInMonth(1) });

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const view = await history();
    expect(view.items).toHaveLength(0);
    expect(view.accountNames).toEqual({});
  });

  it("does not leak another user's names through a filter", async () => {
    const other = await createTestUser({ email: "other@example.com" });
    const theirAccount = await seedBankAccount(other.id, { name: "Their bank" });

    // Filtering by a foreign account id must simply match nothing.
    const view = await history({ accountId: theirAccount.id });
    expect(view.items).toHaveLength(0);
  });
});
