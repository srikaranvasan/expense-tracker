import { buildPersonObligations } from "@/domain/people/calculations";
import type { SplitWithTransaction } from "@/domain/people/calculations";
import { summariseTransactionSettlements } from "@/domain/settlements/transaction-status";
import type { TransactionSettlementStatus } from "@/domain/settlements/transaction-status";
import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { settlementAllocationRepository } from "@/server/repositories/mongo/settlement-repository";

/**
 * Whether any of an expense's shares have been settled.
 *
 * Used by the UI to avoid offering an edit that the service would reject. The service
 * check is still the authority; this only prevents a pointless round trip.
 */
export async function isExpenseSettled(userId: string, expenseId: string): Promise<boolean> {
  const splits = await expenseSplitRepository().listByTransaction(userId, expenseId);
  if (splits.length === 0) return false;

  const count = await settlementAllocationRepository().countBySplitIds(
    userId,
    splits.map((split) => split.id),
  );

  return count > 0;
}

/**
 * Settlement status for a whole page of transactions, in two queries.
 *
 * The naive version is one query per row, which on a fifty-row page is fifty round
 * trips to answer a question about a badge. Instead the page's splits are fetched once,
 * their allocations once, and the roll-up happens in memory
 * (`domain/settlements/transaction-status.ts`).
 *
 * Only expenses are considered. A transfer or card payment has no splits and therefore
 * no obligations, so passing them through costs nothing but they can never produce a
 * status.
 */
export async function getSettlementStatusForTransactions(
  userId: string,
  transactions: readonly Transaction[],
  /** Splits already loaded by the caller, to avoid fetching them twice. */
  splits?: readonly ExpenseSplit[],
): Promise<Map<string, TransactionSettlementStatus>> {
  const expenses = transactions.filter((transaction) => transaction.type === "expense");
  if (expenses.length === 0) return new Map();

  const relevantSplits =
    splits ??
    (await expenseSplitRepository().listByTransactions(
      userId,
      expenses.map((expense) => expense.id),
    ));

  const byId = new Map(expenses.map((expense) => [expense.id, expense] as const));

  const entries: SplitWithTransaction[] = [];
  for (const split of relevantSplits) {
    const transaction = byId.get(split.transactionId);
    if (transaction) entries.push({ transaction, split });
  }

  if (entries.length === 0) return new Map();

  const allocations = await settlementAllocationRepository().listBySplitIds(
    userId,
    entries.map((entry) => entry.split.id),
  );

  return summariseTransactionSettlements(buildPersonObligations(entries, allocations));
}
