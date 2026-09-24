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
 * Which settlements are standing in the way of editing an expense.
 *
 * `isExpenseSettled` answers "may this be edited?" with a boolean, which is all the *guard* needs.
 * The screen that guard renders needs more: it tells the user to remove a settlement, and before
 * group 47 it named that settlement without linking to it — on a page that had no back link, no
 * Cancel and no way out at all (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 6.3).
 *
 * Composed from two calls that already existed, so **no repository interface changed**: the
 * expense's splits, then the allocations pointing at them, then the distinct `settlementId` on each.
 *
 * Returns a list rather than one id because an expense genuinely can be blocked by more than one
 * settlement — different shares can be cleared by different payments — and picking one to link would
 * hide the others from someone trying to unblock the record.
 */
export async function getSettlementsBlockingExpense(
  userId: string,
  expenseId: string,
): Promise<string[]> {
  const splits = await expenseSplitRepository().listByTransaction(userId, expenseId);
  if (splits.length === 0) return [];

  const allocations = await settlementAllocationRepository().listBySplitIds(
    userId,
    splits.map((split) => split.id),
  );

  return [...new Set(allocations.map((allocation) => allocation.settlementId))];
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
