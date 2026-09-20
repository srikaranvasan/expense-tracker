import type { Account } from "@/domain/accounts/entities";
import type { Category } from "@/domain/categories/entities";
import type { Person } from "@/domain/people/entities";
import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";
import { accountRepository } from "@/server/repositories/mongo/account-repository";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { personRepository } from "@/server/repositories/mongo/person-repository";
import {
  settlementAllocationRepository,
  settlementRepository,
} from "@/server/repositories/mongo/settlement-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { clientId, fixedDate, inr } from "./fixtures";

/**
 * Database seeding helpers for integration tests.
 *
 * These write through the real repositories, so the data they produce has the same
 * shape and constraints as data created by the application.
 */

const accounts = accountRepository();
const people = personRepository();
const categories = categoryRepository();
const transactions = transactionRepository();
const splits = expenseSplitRepository();
const settlements = settlementRepository();
const allocations = settlementAllocationRepository();

export async function seedBankAccount(
  userId: string,
  overrides: { name?: string; openingBalance?: string } = {},
): Promise<Account> {
  return accounts.create(userId, {
    clientId: clientId("acc"),
    name: overrides.name ?? "HDFC Savings",
    type: "bank",
    currency: "INR",
    openingBalance: inr(overrides.openingBalance ?? "50000"),
  });
}

export async function seedCashAccount(
  userId: string,
  overrides: { openingBalance?: string } = {},
): Promise<Account> {
  return accounts.create(userId, {
    clientId: clientId("cash"),
    name: "Cash",
    type: "cash",
    currency: "INR",
    openingBalance: inr(overrides.openingBalance ?? "2000"),
  });
}

export async function seedCreditCard(
  userId: string,
  overrides: { creditLimit?: string; openingBalance?: string; name?: string } = {},
): Promise<Account> {
  return accounts.create(userId, {
    clientId: clientId("card"),
    name: overrides.name ?? "HDFC Credit Card",
    type: "credit_card",
    currency: "INR",
    openingBalance: inr(overrides.openingBalance ?? "0"),
    creditLimit: inr(overrides.creditLimit ?? "150000"),
    statementDay: 5,
    paymentDueDay: 25,
  });
}

export async function seedPerson(userId: string, name = "Arun"): Promise<Person> {
  return people.create(userId, { clientId: clientId("person"), name });
}

export async function seedCategory(userId: string, name = "Food"): Promise<Category> {
  return categories.create(userId, { clientId: clientId("cat"), name });
}

export type SeedSharedExpenseOptions = {
  amount: string;
  description?: string;
  date?: Date;
  accountId?: string | null;
  categoryId?: string | null;
  /** Omit for "the user paid". */
  paidByPersonId?: string | null;
  /** `personId: null` means the user's own share. */
  participants: ReadonlyArray<{ personId: string | null; share: string }>;
};

/**
 * Seeds an expense and its splits.
 *
 * Mirrors what the shared-expense use case will write, so balance tests exercise
 * the same data layout as production.
 */
export async function seedSharedExpense(
  userId: string,
  options: SeedSharedExpenseOptions,
): Promise<{ transaction: Transaction; splits: ExpenseSplit[] }> {
  const transaction = await transactions.create(userId, {
    clientId: clientId("txn"),
    type: "expense",
    amount: inr(options.amount),
    description: options.description ?? "Shared expense",
    date: options.date ?? fixedDate(),
    accountId: options.accountId ?? null,
    categoryId: options.categoryId ?? null,
    paidBy:
      options.paidByPersonId != null
        ? { type: "person", personId: options.paidByPersonId }
        : { type: "user", personId: null },
  });

  const created = await splits.createMany(
    userId,
    options.participants.map((participant) => ({
      clientId: clientId("split"),
      transactionId: transaction.id,
      participantType: participant.personId === null ? ("user" as const) : ("person" as const),
      personId: participant.personId,
      shareAmount: inr(participant.share),
    })),
    "INR",
  );

  return { transaction, splits: created };
}

export async function seedPersonalExpense(
  userId: string,
  options: {
    amount: string;
    description?: string;
    accountId?: string | null;
    categoryId?: string | null;
    date?: Date;
  },
): Promise<{ transaction: Transaction; splits: ExpenseSplit[] }> {
  return seedSharedExpense(userId, {
    amount: options.amount,
    description: options.description ?? "Personal expense",
    date: options.date ?? fixedDate(),
    accountId: options.accountId ?? null,
    categoryId: options.categoryId ?? null,
    participants: [{ personId: null, share: options.amount }],
  });
}

export async function seedSettlement(
  userId: string,
  options: {
    personId: string;
    direction: Settlement["direction"];
    amount: string;
    accountId?: string | null;
    date?: Date;
    allocations?: ReadonlyArray<{ expenseSplitId: string; amount: string }>;
  },
): Promise<{ settlement: Settlement; allocations: SettlementAllocation[] }> {
  const settlement = await settlements.create(userId, {
    clientId: clientId("stl"),
    personId: options.personId,
    direction: options.direction,
    amount: inr(options.amount),
    accountId: options.accountId ?? null,
    date: options.date ?? fixedDate(),
  });

  const created = await allocations.createMany(
    userId,
    (options.allocations ?? []).map((allocation) => ({
      clientId: clientId("alloc"),
      settlementId: settlement.id,
      expenseSplitId: allocation.expenseSplitId,
      amount: inr(allocation.amount),
    })),
    "INR",
  );

  return { settlement, allocations: created };
}

/** Finds the split belonging to a specific person within a seeded expense. */
export function splitForPerson(seeded: { splits: ExpenseSplit[] }, personId: string): ExpenseSplit {
  const split = seeded.splits.find((candidate) => candidate.personId === personId);
  if (!split) throw new Error(`No split found for person ${personId}`);
  return split;
}

/** Finds the user's own split within a seeded expense. */
export function splitForUser(seeded: { splits: ExpenseSplit[] }): ExpenseSplit {
  const split = seeded.splits.find((candidate) => candidate.participantType === "user");
  if (!split) throw new Error("No user split found");
  return split;
}
