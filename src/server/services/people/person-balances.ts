import {
  buildPersonObligations,
  calculatePeopleTotals,
  calculatePersonBalanceFromObligations,
  calculatePersonBalances,
} from "@/domain/people/calculations";
import type {
  PeopleTotals,
  PersonBalance,
  PersonObligation,
  SplitWithTransaction,
} from "@/domain/people/calculations";
import type { Settlement } from "@/domain/settlements/entities";
import type { ExpenseSplitRepository } from "@/server/repositories/interfaces/transaction-repository";
import type { TransactionRepository } from "@/server/repositories/interfaces/transaction-repository";
import type {
  SettlementAllocationRepository,
  SettlementRepository,
} from "@/server/repositories/interfaces/settlement-repository";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import {
  settlementAllocationRepository,
  settlementRepository,
} from "@/server/repositories/mongo/settlement-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";

/**
 * Loads the events a person balance is derived from.
 *
 * Splits, their transactions and every settlement allocation are read together,
 * then handed to the pure domain calculation. The read is deliberately separate
 * from the arithmetic so the arithmetic stays testable without a database.
 */

export type PersonBalanceDependencies = {
  transactions: TransactionRepository;
  splits: ExpenseSplitRepository;
  settlements: SettlementRepository;
  allocations: SettlementAllocationRepository;
};

function defaultDependencies(): PersonBalanceDependencies {
  return {
    transactions: transactionRepository(),
    splits: expenseSplitRepository(),
    settlements: settlementRepository(),
    allocations: settlementAllocationRepository(),
  };
}

export type ObligationContext = {
  obligations: PersonObligation[];
  settlements: Settlement[];
};

/**
 * Builds every user-to-person obligation for the user.
 *
 * Splits are paired with their transactions because whether a split creates a
 * debt depends on who paid, which lives on the transaction.
 */
export async function loadObligations(
  userId: string,
  dependencies: PersonBalanceDependencies = defaultDependencies(),
): Promise<ObligationContext> {
  const [transactions, splits, allocations, settlements] = await Promise.all([
    dependencies.transactions.listForProjection(userId, { types: ["expense"] }),
    dependencies.splits.listAll(userId),
    dependencies.allocations.listAll(userId),
    dependencies.settlements.listAll(userId),
  ]);

  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction] as const),
  );

  const entries: SplitWithTransaction[] = [];
  for (const split of splits) {
    const transaction = transactionsById.get(split.transactionId);
    // A split whose transaction is deleted contributes nothing.
    if (transaction) entries.push({ transaction, split });
  }

  return { obligations: buildPersonObligations(entries, allocations), settlements };
}

export async function getPersonBalance(
  userId: string,
  personId: string,
  currency: string,
  dependencies?: PersonBalanceDependencies,
): Promise<{ balance: PersonBalance; obligations: PersonObligation[]; settlements: Settlement[] }> {
  const { obligations, settlements } = await loadObligations(userId, dependencies);

  return {
    balance: calculatePersonBalanceFromObligations(personId, obligations, currency),
    obligations: obligations.filter((obligation) => obligation.personId === personId),
    settlements: settlements.filter((settlement) => settlement.personId === personId),
  };
}

export async function getPersonBalances(
  userId: string,
  personIds: readonly string[],
  currency: string,
  dependencies?: PersonBalanceDependencies,
): Promise<Map<string, PersonBalance>> {
  const { obligations } = await loadObligations(userId, dependencies);

  const balances = new Map<string, PersonBalance>();
  for (const personId of personIds) {
    balances.set(personId, calculatePersonBalanceFromObligations(personId, obligations, currency));
  }

  return balances;
}

/** Receivable/payable totals for the dashboard. */
export async function getPeopleTotals(
  userId: string,
  currency: string,
  dependencies?: PersonBalanceDependencies,
): Promise<PeopleTotals> {
  const { obligations } = await loadObligations(userId, dependencies);

  const personIds = new Set(obligations.map((obligation) => obligation.personId));
  const balances = calculatePersonBalances([], [], currency, [...personIds]);

  // Recomputed from the obligations already loaded rather than re-reading.
  for (const personId of personIds) {
    balances.set(personId, calculatePersonBalanceFromObligations(personId, obligations, currency));
  }

  return calculatePeopleTotals(balances.values(), currency);
}
