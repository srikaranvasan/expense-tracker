import { money } from "@/lib/money";
import type { Money } from "@/lib/money";
import type { Account } from "@/domain/accounts/entities";
import type { Person } from "@/domain/people/entities";
import type { Category } from "@/domain/categories/entities";
import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";

/**
 * In-memory entity builders for unit tests.
 *
 * These produce domain entities directly so the pure calculation functions can be
 * tested without a database.
 */

export const inr = (value: string | number): Money => money(value, "INR");

let sequence = 0;
export function nextId(prefix = "id"): string {
  sequence += 1;
  return `${prefix}${sequence}`;
}

export function resetIdSequence(): void {
  sequence = 0;
}

const T0 = new Date("2026-08-15T10:00:00.000Z");

export function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: nextId("acc"),
    userId: "user1",
    clientId: nextId("client"),
    name: "HDFC Savings",
    type: "bank",
    currency: "INR",
    openingBalance: inr("0"),
    institutionName: null,
    creditCard: null,
    archivedAt: null,
    createdAt: T0,
    updatedAt: T0,
    syncVersion: 1,
    ...overrides,
  };
}

export function buildCreditCard(overrides: Partial<Account> = {}): Account {
  return buildAccount({
    name: "HDFC Credit Card",
    type: "credit_card",
    creditCard: { creditLimit: inr("150000"), statementDay: 5, paymentDueDay: 25 },
    ...overrides,
  });
}

export function buildPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: nextId("person"),
    userId: "user1",
    clientId: nextId("client"),
    name: "Arun",
    notes: null,
    archivedAt: null,
    createdAt: T0,
    updatedAt: T0,
    syncVersion: 1,
    ...overrides,
  };
}

export function buildCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: nextId("cat"),
    userId: "user1",
    clientId: nextId("client"),
    name: "Food",
    icon: null,
    parentId: null,
    kind: "expense",
    archivedAt: null,
    createdAt: T0,
    updatedAt: T0,
    syncVersion: 1,
    ...overrides,
  };
}

export function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: nextId("txn"),
    userId: "user1",
    clientId: nextId("client"),
    type: "expense",
    amount: inr("100"),
    description: "Something",
    date: T0,
    categoryId: null,
    accountId: null,
    fromAccountId: null,
    toAccountId: null,
    paidBy: { type: "user", personId: null },
    notes: null,
    deletedAt: null,
    createdAt: T0,
    updatedAt: T0,
    syncVersion: 1,
    ...overrides,
  };
}

export function buildSplit(overrides: Partial<ExpenseSplit> = {}): ExpenseSplit {
  return {
    id: nextId("split"),
    userId: "user1",
    clientId: nextId("client"),
    transactionId: nextId("txn"),
    participantType: "user",
    personId: null,
    shareAmount: inr("100"),
    deletedAt: null,
    createdAt: T0,
    updatedAt: T0,
    syncVersion: 1,
    ...overrides,
  };
}

export function buildSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: nextId("stl"),
    userId: "user1",
    clientId: nextId("client"),
    personId: "person1",
    direction: "user_to_person",
    amount: inr("300"),
    accountId: null,
    date: T0,
    notes: null,
    deletedAt: null,
    createdAt: T0,
    updatedAt: T0,
    syncVersion: 1,
    ...overrides,
  };
}

export function buildAllocation(
  overrides: Partial<SettlementAllocation> = {},
): SettlementAllocation {
  return {
    id: nextId("alloc"),
    userId: "user1",
    clientId: nextId("client"),
    settlementId: nextId("stl"),
    expenseSplitId: nextId("split"),
    amount: inr("100"),
    deletedAt: null,
    createdAt: T0,
    updatedAt: T0,
    syncVersion: 1,
    ...overrides,
  };
}

/**
 * Builds a shared expense: one transaction plus its splits.
 *
 * `participants` gives each share; `personId: null` means the user.
 */
export function buildSharedExpense(options: {
  amount: string;
  description?: string;
  date?: Date;
  paidByPersonId?: string | null;
  accountId?: string | null;
  participants: ReadonlyArray<{ personId: string | null; share: string }>;
}): { transaction: Transaction; splits: ExpenseSplit[] } {
  const transaction = buildTransaction({
    type: "expense",
    amount: inr(options.amount),
    description: options.description ?? "Shared expense",
    date: options.date ?? T0,
    accountId: options.accountId ?? null,
    paidBy:
      options.paidByPersonId != null
        ? { type: "person", personId: options.paidByPersonId }
        : { type: "user", personId: null },
  });

  const splits = options.participants.map((participant) =>
    buildSplit({
      transactionId: transaction.id,
      participantType: participant.personId === null ? "user" : "person",
      personId: participant.personId,
      shareAmount: inr(participant.share),
    }),
  );

  return { transaction, splits };
}

/** Flattens shared expenses into the split/transaction pairs the domain expects. */
export function toSplitEntries(
  expenses: ReadonlyArray<{ transaction: Transaction; splits: ExpenseSplit[] }>,
): Array<{ transaction: Transaction; split: ExpenseSplit }> {
  return expenses.flatMap((expense) =>
    expense.splits.map((split) => ({ transaction: expense.transaction, split })),
  );
}
