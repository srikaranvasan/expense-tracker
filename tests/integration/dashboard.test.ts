import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { Category } from "@/domain/categories/entities";
import type { User } from "@/domain/users/entities";
import type { DashboardView } from "@/features/dashboard/view-models/dashboard-view-model";
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

const { GET: getDashboard } = await import("@/app/api/dashboard/route");
const { POST: createTransfer } = await import("@/app/api/transfers/route");
const { POST: createCardPayment } = await import("@/app/api/credit-card-payments/route");

let user: User;
let bank: Account;
let food: Category;

/**
 * A date inside the current month, so the "spending this month" figure is exercised
 * rather than silently skipped. Late in the day on purpose: it would fall into the
 * wrong month if the code grouped in UTC for a user east of UTC.
 */
function thisMonth(day = 15): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 20, 30, 0));
}

function lastMonth(day = 15): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day, 10, 0, 0));
}

async function dashboard(): Promise<DashboardView> {
  return expectData(await invokeRoute<DashboardView>(getDashboard, "/api/dashboard"));
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR", timezone: "Asia/Kolkata" });
  bank = await seedBankAccount(user.id, { openingBalance: "50000" });
  food = (await categoryRepository().list(user.id)).find((c) => c.name === "Food")!;
});

describe("GET /api/dashboard", () => {
  it("reports an empty dashboard before anything is recorded", async () => {
    const view = await dashboard();

    expect(view.isEmpty).toBe(true);
    expect(view.spending.total.amount.amount).toBe("0");
    expect(view.recentTransactions).toHaveLength(0);
    expect(view.recentSettlements).toHaveLength(0);
    // An account with no activity still appears, with its opening balance.
    expect(view.accounts).toHaveLength(1);
    expect(view.totals.liquidBalance.amount.amount).toBe("50000");
  });

  it("stops being empty once a transaction exists", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id, date: thisMonth() });

    const view = await dashboard();
    expect(view.isEmpty).toBe(false);
  });
});

describe("account figures", () => {
  it("sums bank and cash into one liquid balance", async () => {
    await seedCashAccount(user.id, { openingBalance: "2000" });

    const view = await dashboard();
    expect(view.totals.liquidBalance.amount.amount).toBe("52000");
  });

  it("reports card outstanding and available credit separately from cash", async () => {
    await seedCreditCard(user.id, { creditLimit: "150000", openingBalance: "15000" });

    const view = await dashboard();

    expect(view.totals.hasCreditCards).toBe(true);
    expect(view.totals.creditCardOutstanding.amount.amount).toBe("15000");
    expect(view.totals.availableCredit.amount.amount).toBe("135000");
    // Liquid is unaffected by a card liability.
    expect(view.totals.liquidBalance.amount.amount).toBe("50000");
  });

  it("computes net position as liquid minus card debt", async () => {
    await seedCreditCard(user.id, { creditLimit: "150000", openingBalance: "15000" });

    const view = await dashboard();
    expect(view.totals.netPosition.amount.amount).toBe("35000");
  });

  it("hides the card tiles when the user has no cards", async () => {
    const view = await dashboard();
    expect(view.totals.hasCreditCards).toBe(false);
  });

  it("flags a card that is over its limit", async () => {
    const card = await seedCreditCard(user.id, { creditLimit: "10000", openingBalance: "0" });
    await seedPersonalExpense(user.id, {
      amount: "12000",
      accountId: card.id,
      date: thisMonth(),
    });

    const view = await dashboard();

    expect(view.totals.anyCardOverLimit).toBe(true);
    const cardView = view.accounts.find((account) => account.id === card.id);
    expect(cardView?.overLimit).toBe(true);
  });

  it("excludes archived accounts", async () => {
    const { DELETE: archiveAccount } = await import("@/app/api/accounts/[id]/route");
    const cash = await seedCashAccount(user.id, { openingBalance: "2000" });
    await invokeRoute(archiveAccount, `/api/accounts/${cash.id}`, {
      method: "DELETE",
      params: { id: cash.id },
    });

    const view = await dashboard();
    expect(view.accounts.map((account) => account.id)).not.toContain(cash.id);
  });
});

describe("monthly spending", () => {
  it("counts only this month's expenses", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id, date: thisMonth() });
    await seedPersonalExpense(user.id, { amount: "9999", accountId: bank.id, date: lastMonth() });

    const view = await dashboard();
    expect(view.spending.total.amount.amount).toBe("450");
    expect(view.spending.previousTotal.amount.amount).toBe("9999");
  });

  it("compares against last month in words", async () => {
    await seedPersonalExpense(user.id, { amount: "1000", accountId: bank.id, date: thisMonth() });
    await seedPersonalExpense(user.id, { amount: "400", accountId: bank.id, date: lastMonth() });

    const view = await dashboard();
    expect(view.spending.comparison).toBe("more");
    expect(view.spending.difference.amount.amount).toBe("600");
  });

  it("says there is nothing to compare with when last month was empty", async () => {
    await seedPersonalExpense(user.id, { amount: "1000", accountId: bank.id, date: thisMonth() });

    const view = await dashboard();
    expect(view.spending.comparison).toBe("no_previous");
  });

  it("counts only the user's share of a shared expense", async () => {
    const arun = await seedPerson(user.id, "Arun");
    await seedSharedExpense(user.id, {
      amount: "1200",
      accountId: bank.id,
      date: thisMonth(),
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "800" },
      ],
    });

    const view = await dashboard();

    // 1,200 left the account, but only 400 was the user's own spending.
    expect(view.spending.total.amount.amount).toBe("400");
    expect(view.totals.liquidBalance.amount.amount).toBe("48800");
  });

  it("excludes transfers", async () => {
    const cash = await seedCashAccount(user.id, { openingBalance: "0" });
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id, date: thisMonth() });

    await invokeRoute(createTransfer, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "10000",
        fromAccountId: bank.id,
        toAccountId: cash.id,
        date: thisMonth().toISOString(),
      },
    });

    const view = await dashboard();

    expect(view.spending.total.amount.amount).toBe("450");
    // The money moved, so the total across accounts is unchanged.
    expect(view.totals.liquidBalance.amount.amount).toBe("49550");
  });

  it("excludes credit-card payments", async () => {
    const card = await seedCreditCard(user.id, { creditLimit: "150000", openingBalance: "0" });
    // Spending on the card is what creates the liability, and it counts once.
    await seedPersonalExpense(user.id, { amount: "1200", accountId: card.id, date: thisMonth() });

    await invokeRoute(createCardPayment, "/api/credit-card-payments", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "1200",
        fromAccountId: bank.id,
        toAccountId: card.id,
        date: thisMonth().toISOString(),
      },
    });

    const view = await dashboard();

    // Paying the card must not count the same 1,200 twice.
    expect(view.spending.total.amount.amount).toBe("1200");
    expect(view.totals.creditCardOutstanding.amount.amount).toBe("0");
  });

  it("breaks this month's spending down by category, largest first", async () => {
    const travel = (await categoryRepository().list(user.id)).find((c) => c.name === "Transport")!;

    await seedPersonalExpense(user.id, {
      amount: "300",
      accountId: bank.id,
      categoryId: food.id,
      date: thisMonth(),
    });
    await seedPersonalExpense(user.id, {
      amount: "900",
      accountId: bank.id,
      categoryId: travel.id,
      date: thisMonth(),
    });
    // Last month must not leak into the breakdown.
    await seedPersonalExpense(user.id, {
      amount: "5000",
      accountId: bank.id,
      categoryId: food.id,
      date: lastMonth(),
    });

    const view = await dashboard();

    expect(view.spending.topCategories).toHaveLength(2);
    expect(view.spending.topCategories[0]?.name).toBe(travel.name);
    expect(view.spending.topCategories[0]?.total.amount.amount).toBe("900");
    expect(view.spending.topCategories[1]?.total.amount.amount).toBe("300");

    // The breakdown adds up to the headline figure.
    const sum = view.spending.topCategories.reduce(
      (total, entry) => total + Number(entry.total.amount.amount),
      0,
    );
    expect(String(sum)).toBe(view.spending.total.amount.amount);
  });

  it("labels uncategorised spending rather than dropping it", async () => {
    await seedPersonalExpense(user.id, {
      amount: "250",
      accountId: bank.id,
      categoryId: null,
      date: thisMonth(),
    });

    const view = await dashboard();
    expect(view.spending.topCategories[0]?.name).toBe("Uncategorised");
    expect(view.spending.topCategories[0]?.categoryId).toBeNull();
  });
});

describe("people balances", () => {
  it("separates who owes the user from who the user owes", async () => {
    const arun = await seedPerson(user.id, "Arun");
    const priya = await seedPerson(user.id, "Priya");

    // The user paid, so Arun owes his share.
    await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: bank.id,
      date: thisMonth(),
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "600" },
      ],
    });

    // Priya paid, so the user owes their share.
    await seedSharedExpense(user.id, {
      amount: "800",
      accountId: null,
      paidByPersonId: priya.id,
      date: thisMonth(),
      participants: [
        { personId: null, share: "300" },
        { personId: priya.id, share: "500" },
      ],
    });

    const view = await dashboard();

    expect(view.people.peopleOweUser.amount.amount).toBe("600");
    expect(view.people.userOwesPeople.amount.amount).toBe("300");
    expect(view.people.isSettled).toBe(false);

    expect(view.peopleOwingUser.map((person) => person.name)).toEqual(["Arun"]);
    expect(view.peopleUserOwes.map((person) => person.name)).toEqual(["Priya"]);
  });

  it("reports settled when nothing is outstanding", async () => {
    await seedPerson(user.id, "Arun");
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id, date: thisMonth() });

    const view = await dashboard();

    expect(view.people.isSettled).toBe(true);
    expect(view.peopleOwingUser).toHaveLength(0);
    expect(view.peopleUserOwes).toHaveLength(0);
  });

  it("drops a person from the list once they are settled", async () => {
    const arun = await seedPerson(user.id, "Arun");
    const expense = await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: bank.id,
      date: thisMonth(),
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "600" },
      ],
    });

    expect((await dashboard()).peopleOwingUser).toHaveLength(1);

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "600",
      accountId: bank.id,
      date: thisMonth(),
      allocations: [{ expenseSplitId: splitForPerson(expense, arun.id).id, amount: "600" }],
    });

    const view = await dashboard();
    expect(view.peopleOwingUser).toHaveLength(0);
    expect(view.people.peopleOweUser.amount.amount).toBe("0");
  });

  it("orders people by the largest outstanding balance", async () => {
    const small = await seedPerson(user.id, "Small");
    const large = await seedPerson(user.id, "Large");

    await seedSharedExpense(user.id, {
      amount: "300",
      accountId: bank.id,
      date: thisMonth(),
      participants: [
        { personId: null, share: "100" },
        { personId: small.id, share: "200" },
      ],
    });
    await seedSharedExpense(user.id, {
      amount: "3000",
      accountId: bank.id,
      date: thisMonth(),
      participants: [
        { personId: null, share: "1000" },
        { personId: large.id, share: "2000" },
      ],
    });

    const view = await dashboard();
    expect(view.peopleOwingUser.map((person) => person.name)).toEqual(["Large", "Small"]);
  });
});

describe("recent activity", () => {
  it("lists the most recent transactions, newest first", async () => {
    await seedPersonalExpense(user.id, {
      amount: "100",
      description: "Older",
      accountId: bank.id,
      date: thisMonth(3),
    });
    await seedPersonalExpense(user.id, {
      amount: "200",
      description: "Newer",
      accountId: bank.id,
      date: thisMonth(20),
    });

    const view = await dashboard();
    const descriptions = view.recentTransactions.flatMap((group) =>
      group.items.map((item) => item.description),
    );

    expect(descriptions[0]).toBe("Newer");
    expect(descriptions).toContain("Older");
  });

  it("caps the recent list", async () => {
    for (let index = 0; index < 10; index += 1) {
      await seedPersonalExpense(user.id, {
        amount: "100",
        description: `Expense ${index}`,
        accountId: bank.id,
        date: thisMonth(),
      });
    }

    const view = await dashboard();
    const count = view.recentTransactions.reduce((total, group) => total + group.items.length, 0);
    expect(count).toBeLessThanOrEqual(6);
  });

  it("resolves account and category names for the recent rows", async () => {
    await seedPersonalExpense(user.id, {
      amount: "450",
      accountId: bank.id,
      categoryId: food.id,
      date: thisMonth(),
    });

    const view = await dashboard();
    expect(view.recentAccountNames[bank.id]).toBe(bank.name);
    expect(view.recentCategoryNames[food.id]).toBe(food.name);
  });

  it("includes transfers and card payments in recent activity", async () => {
    const cash = await seedCashAccount(user.id, { openingBalance: "0" });
    await invokeRoute(createTransfer, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "1000",
        fromAccountId: bank.id,
        toAccountId: cash.id,
        date: thisMonth().toISOString(),
      },
    });

    const view = await dashboard();
    const types = view.recentTransactions.flatMap((group) => group.items.map((item) => item.type));
    expect(types).toContain("transfer");
  });

  it("lists recent settlements with their direction", async () => {
    const arun = await seedPerson(user.id, "Arun");
    const expense = await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: bank.id,
      date: thisMonth(),
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
      date: thisMonth(),
      allocations: [{ expenseSplitId: splitForPerson(expense, arun.id).id, amount: "600" }],
    });

    const view = await dashboard();

    expect(view.recentSettlements).toHaveLength(1);
    expect(view.recentSettlements[0]?.direction).toBe("person_to_user");
    expect(view.recentSettlements[0]?.personName).toBe("Arun");
    expect(view.recentSettlements[0]?.formattedAmount).toContain("600");
  });
});

describe("derivation and isolation", () => {
  it("changes immediately when an expense is deleted", async () => {
    const { DELETE: deleteExpense } = await import("@/app/api/expenses/[id]/route");
    const expense = await seedPersonalExpense(user.id, {
      amount: "450",
      accountId: bank.id,
      date: thisMonth(),
    });

    expect((await dashboard()).spending.total.amount.amount).toBe("450");

    await invokeRoute(deleteExpense, `/api/expenses/${expense.transaction.id}`, {
      method: "DELETE",
      params: { id: expense.transaction.id },
    });

    const view = await dashboard();
    // No cached total to go stale.
    expect(view.spending.total.amount.amount).toBe("0");
    expect(view.totals.liquidBalance.amount.amount).toBe("50000");
  });

  it("shows nothing belonging to another user", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id, date: thisMonth() });

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const view = await dashboard();

    expect(view.isEmpty).toBe(true);
    expect(view.accounts).toHaveLength(0);
    expect(view.spending.total.amount.amount).toBe("0");
    expect(view.totals.liquidBalance.amount.amount).toBe("0");
  });
});
