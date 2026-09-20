import { describe, expect, it } from "vitest";
import { money } from "@/lib/money";
import type { Settlement } from "@/domain/settlements/entities";
import type { Transaction } from "@/domain/transactions/entities";
import type { Account } from "./entities";
import {
  calculateAccountBalance,
  calculateAccountTotals,
  calculateAvailableCredit,
  calculateCreditCardOutstanding,
  deriveAccountMovements,
  summariseAccount,
} from "./calculations";

const inr = (value: string) => money(value, "INR");

let sequence = 0;
function nextId(): string {
  sequence += 1;
  return `id${sequence}`;
}

function buildAccount(overrides: Partial<Account> = {}): Account {
  const base: Account = {
    id: nextId(),
    userId: "user1",
    clientId: `client-${nextId()}`,
    name: "HDFC Savings",
    type: "bank",
    currency: "INR",
    openingBalance: inr("0"),
    institutionName: null,
    creditCard: null,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    syncVersion: 1,
  };
  return { ...base, ...overrides };
}

function buildCard(overrides: Partial<Account> = {}): Account {
  return buildAccount({
    name: "HDFC Credit Card",
    type: "credit_card",
    openingBalance: inr("0"),
    creditCard: { creditLimit: inr("100000"), statementDay: 5, paymentDueDay: 25 },
    ...overrides,
  });
}

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const base: Transaction = {
    id: nextId(),
    userId: "user1",
    clientId: `client-${nextId()}`,
    type: "expense",
    amount: inr("100"),
    description: "Something",
    date: new Date("2026-08-15T10:00:00.000Z"),
    categoryId: null,
    accountId: null,
    fromAccountId: null,
    toAccountId: null,
    paidBy: { type: "user", personId: null },
    notes: null,
    deletedAt: null,
    createdAt: new Date("2026-08-15T10:00:00.000Z"),
    updatedAt: new Date("2026-08-15T10:00:00.000Z"),
    syncVersion: 1,
  };
  return { ...base, ...overrides };
}

function buildSettlement(overrides: Partial<Settlement> = {}): Settlement {
  const base: Settlement = {
    id: nextId(),
    userId: "user1",
    clientId: `client-${nextId()}`,
    personId: "person1",
    direction: "user_to_person",
    amount: inr("300"),
    accountId: null,
    date: new Date("2026-08-20T10:00:00.000Z"),
    notes: null,
    deletedAt: null,
    createdAt: new Date("2026-08-20T10:00:00.000Z"),
    updatedAt: new Date("2026-08-20T10:00:00.000Z"),
    syncVersion: 1,
  };
  return { ...base, ...overrides };
}

describe("calculateAccountBalance", () => {
  it("returns the opening balance when there are no movements", () => {
    const account = buildAccount({ openingBalance: inr("50000") });
    expect(calculateAccountBalance(account, []).toFixedString()).toBe("50000.00");
  });

  it("subtracts expenses and applies transfers in both directions", () => {
    const account = buildAccount({ openingBalance: inr("50000") });
    const other = buildAccount({ name: "ICICI" });

    const movements = deriveAccountMovements([
      buildTransaction({ type: "expense", amount: inr("2000"), accountId: account.id }),
      buildTransaction({
        type: "transfer",
        amount: inr("5000"),
        fromAccountId: account.id,
        toAccountId: other.id,
        paidBy: null,
      }),
      buildTransaction({
        type: "transfer",
        amount: inr("3000"),
        fromAccountId: other.id,
        toAccountId: account.id,
        paidBy: null,
      }),
    ]);

    // 50000 - 2000 - 5000 + 3000
    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("46000.00");
  });

  it("adds income", () => {
    const account = buildAccount({ openingBalance: inr("1000") });
    const movements = deriveAccountMovements([
      buildTransaction({
        type: "income",
        amount: inr("2500"),
        accountId: account.id,
        paidBy: null,
      }),
    ]);

    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("3500.00");
  });

  it("subtracts a credit-card payment from the paying account", () => {
    const bank = buildAccount({ openingBalance: inr("20000") });
    const card = buildCard();

    const movements = deriveAccountMovements([
      buildTransaction({
        type: "credit_card_payment",
        amount: inr("2000"),
        fromAccountId: bank.id,
        toAccountId: card.id,
        paidBy: null,
      }),
    ]);

    expect(calculateAccountBalance(bank, movements).toFixedString()).toBe("18000.00");
  });

  it("uses the full amount paid for a shared expense, not the user's share", () => {
    // The user paid ₹1,200 for a group dinner. ₹1,200 left the account even though
    // only ₹400 is their own spending.
    const account = buildAccount({ openingBalance: inr("10000") });
    const movements = deriveAccountMovements([
      buildTransaction({ type: "expense", amount: inr("1200"), accountId: account.id }),
    ]);

    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("8800.00");
  });

  it("ignores an expense paid by another person", () => {
    // Arun paid, so no account of the user's was charged.
    const account = buildAccount({ openingBalance: inr("10000") });
    const movements = deriveAccountMovements([
      buildTransaction({
        type: "expense",
        amount: inr("900"),
        accountId: null,
        paidBy: { type: "person", personId: "person1" },
      }),
    ]);

    expect(movements).toHaveLength(0);
    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("10000.00");
  });

  it("applies settlements in the correct direction", () => {
    const account = buildAccount({ openingBalance: inr("5000") });

    const movements = deriveAccountMovements(
      [],
      [
        buildSettlement({ direction: "user_to_person", amount: inr("450"), accountId: account.id }),
        buildSettlement({ direction: "person_to_user", amount: inr("200"), accountId: account.id }),
      ],
    );

    // 5000 - 450 + 200
    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("4750.00");
  });

  it("ignores a settlement with no tracked account", () => {
    const account = buildAccount({ openingBalance: inr("5000") });
    const movements = deriveAccountMovements([], [buildSettlement({ accountId: null })]);

    expect(movements).toHaveLength(0);
    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("5000.00");
  });

  it("ignores soft-deleted transactions and settlements", () => {
    const account = buildAccount({ openingBalance: inr("1000") });
    const deletedAt = new Date("2026-08-16T00:00:00.000Z");

    const movements = deriveAccountMovements(
      [buildTransaction({ amount: inr("500"), accountId: account.id, deletedAt })],
      [buildSettlement({ amount: inr("100"), accountId: account.id, deletedAt })],
    );

    expect(movements).toHaveLength(0);
    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("1000.00");
  });

  it("ignores movements belonging to other accounts", () => {
    const account = buildAccount({ openingBalance: inr("1000") });
    const other = buildAccount();

    const movements = deriveAccountMovements([
      buildTransaction({ amount: inr("500"), accountId: other.id }),
    ]);

    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("1000.00");
  });

  it("handles a negative opening balance (overdraft)", () => {
    const account = buildAccount({ openingBalance: inr("-500") });
    const movements = deriveAccountMovements([
      buildTransaction({ type: "income", amount: inr("200"), accountId: account.id, paidBy: null }),
    ]);

    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("-300.00");
  });

  it("stays exact across many decimal movements", () => {
    const account = buildAccount({ openingBalance: inr("0") });
    const movements = deriveAccountMovements(
      Array.from({ length: 10 }, () =>
        buildTransaction({
          type: "income",
          amount: inr("0.1"),
          accountId: account.id,
          paidBy: null,
        }),
      ),
    );

    expect(calculateAccountBalance(account, movements).toFixedString()).toBe("1.00");
  });
});

describe("calculateCreditCardOutstanding", () => {
  it("starts from the opening outstanding amount", () => {
    const card = buildCard({ openingBalance: inr("5000") });
    expect(calculateCreditCardOutstanding(card, []).toFixedString()).toBe("5000.00");
  });

  it("increases with card spending", () => {
    const card = buildCard();
    const movements = deriveAccountMovements([
      buildTransaction({ type: "expense", amount: inr("1200"), accountId: card.id }),
    ]);

    expect(calculateCreditCardOutstanding(card, movements).toFixedString()).toBe("1200.00");
  });

  it("decreases with a card payment and never counts the payment as spending", () => {
    const bank = buildAccount({ openingBalance: inr("20000") });
    const card = buildCard({ openingBalance: inr("5000") });

    const movements = deriveAccountMovements([
      buildTransaction({
        type: "credit_card_payment",
        amount: inr("2000"),
        fromAccountId: bank.id,
        toAccountId: card.id,
        paidBy: null,
      }),
    ]);

    expect(calculateCreditCardOutstanding(card, movements).toFixedString()).toBe("3000.00");
    expect(calculateAccountBalance(bank, movements).toFixedString()).toBe("18000.00");
  });

  it("reduces the outstanding balance for a refund onto the card", () => {
    const card = buildCard({ openingBalance: inr("5000") });
    const movements = deriveAccountMovements([
      buildTransaction({ type: "income", amount: inr("500"), accountId: card.id, paidBy: null }),
    ]);

    expect(calculateCreditCardOutstanding(card, movements).toFixedString()).toBe("4500.00");
  });

  it("treats a transfer off the card as a cash advance", () => {
    const card = buildCard();
    const bank = buildAccount();

    const movements = deriveAccountMovements([
      buildTransaction({
        type: "transfer",
        amount: inr("3000"),
        fromAccountId: card.id,
        toAccountId: bank.id,
        paidBy: null,
      }),
    ]);

    expect(calculateCreditCardOutstanding(card, movements).toFixedString()).toBe("3000.00");
  });
});

describe("calculateAvailableCredit", () => {
  it("is the limit minus the outstanding balance", () => {
    expect(calculateAvailableCredit(inr("100000"), inr("20000")).toFixedString()).toBe("80000.00");
  });

  it("tracks spending and payments", () => {
    const card = buildCard({
      creditCard: { creditLimit: inr("100000"), statementDay: null, paymentDueDay: null },
    });
    const bank = buildAccount();

    const afterSpend = deriveAccountMovements([
      buildTransaction({ type: "expense", amount: inr("20000"), accountId: card.id }),
      buildTransaction({ type: "expense", amount: inr("5000"), accountId: card.id }),
    ]);
    const spendSummary = summariseAccount(card, afterSpend);
    expect(spendSummary.outstanding?.toFixedString()).toBe("25000.00");
    expect(spendSummary.availableCredit?.toFixedString()).toBe("75000.00");

    const afterPayment = deriveAccountMovements([
      buildTransaction({ type: "expense", amount: inr("20000"), accountId: card.id }),
      buildTransaction({ type: "expense", amount: inr("5000"), accountId: card.id }),
      buildTransaction({
        type: "credit_card_payment",
        amount: inr("10000"),
        fromAccountId: bank.id,
        toAccountId: card.id,
        paidBy: null,
      }),
    ]);
    const paidSummary = summariseAccount(card, afterPayment);
    expect(paidSummary.outstanding?.toFixedString()).toBe("15000.00");
    expect(paidSummary.availableCredit?.toFixedString()).toBe("85000.00");
  });

  it("reports an over-limit card", () => {
    const card = buildCard({
      creditCard: { creditLimit: inr("1000"), statementDay: null, paymentDueDay: null },
    });
    const movements = deriveAccountMovements([
      buildTransaction({ type: "expense", amount: inr("1500"), accountId: card.id }),
    ]);

    const summary = summariseAccount(card, movements);
    expect(summary.availableCredit?.toFixedString()).toBe("-500.00");
    expect(summary.overLimit).toBe(true);
  });
});

describe("summariseAccount", () => {
  it("reports a card liability as a negative balance", () => {
    const card = buildCard({ openingBalance: inr("18500") });
    const summary = summariseAccount(card, []);

    expect(summary.outstanding?.toFixedString()).toBe("18500.00");
    expect(summary.balance.toFixedString()).toBe("-18500.00");
  });

  it("leaves card-only figures null for an asset account", () => {
    const summary = summariseAccount(buildAccount({ openingBalance: inr("100") }), []);

    expect(summary.outstanding).toBeNull();
    expect(summary.creditLimit).toBeNull();
    expect(summary.availableCredit).toBeNull();
    expect(summary.balance.toFixedString()).toBe("100.00");
  });
});

describe("calculateAccountTotals", () => {
  it("separates liquid balances from card liabilities", () => {
    const bank = buildAccount({ openingBalance: inr("50000") });
    const cash = buildAccount({ name: "Cash", type: "cash", openingBalance: inr("2000") });
    const card = buildCard({
      openingBalance: inr("0"),
      creditCard: { creditLimit: inr("150000"), statementDay: null, paymentDueDay: null },
    });

    const movements = deriveAccountMovements([
      buildTransaction({ type: "expense", amount: inr("1200"), accountId: card.id }),
      buildTransaction({ type: "expense", amount: inr("500"), accountId: bank.id }),
    ]);

    const totals = calculateAccountTotals([bank, cash, card], movements, "INR");

    expect(totals.liquidBalance.toFixedString()).toBe("51500.00");
    expect(totals.creditCardOutstanding.toFixedString()).toBe("1200.00");
    expect(totals.availableCredit.toFixedString()).toBe("148800.00");
    expect(totals.netPosition.toFixedString()).toBe("50300.00");
  });

  it("returns zeroes when there are no accounts", () => {
    const totals = calculateAccountTotals([], [], "INR");

    expect(totals.liquidBalance.isZero()).toBe(true);
    expect(totals.creditCardOutstanding.isZero()).toBe(true);
    expect(totals.netPosition.isZero()).toBe(true);
  });

  it("skips accounts in another currency rather than adding them together", () => {
    const inrBank = buildAccount({ openingBalance: inr("1000") });
    const usdBank = buildAccount({ currency: "USD", openingBalance: money("500", "USD") });

    const totals = calculateAccountTotals([inrBank, usdBank], [], "INR");
    expect(totals.liquidBalance.toFixedString()).toBe("1000.00");
  });
});
