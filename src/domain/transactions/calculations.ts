import { Money, sumMoney } from "@/lib/money";
import { formatMonthKey, startOfMonthInTimezone } from "@/lib/dates";
import type { TransactionType } from "@/types/common";
import type { ExpenseSplit, Transaction } from "./entities";

/**
 * Spending classification.
 *
 * "How much did I spend?" is a different question from "how much money moved?", and
 * conflating them is the mistake this module exists to prevent
 * (docs/09-DATABASE-SCHEMA.md section 36).
 */

/**
 * Only an expense is spending.
 *
 * A transfer moves money between the user's own accounts - nothing was consumed.
 * A credit-card payment settles a liability that was already recorded as spending
 * when the card was used; counting it again would double-count every card purchase.
 * Income is money arriving, not leaving.
 */
export function isSpending(transaction: Transaction): boolean {
  return transaction.type === "expense";
}

const NON_SPENDING_TYPES: ReadonlySet<TransactionType> = new Set([
  "transfer",
  "credit_card_payment",
  "income",
]);

export function isNonSpendingType(type: TransactionType): boolean {
  return NON_SPENDING_TYPES.has(type);
}

/**
 * The user's own spending on one expense.
 *
 * For a personal expense this is the full amount. For a shared expense it is the
 * user's share, not what they paid: paying ₹1,200 for a group dinner where the
 * user's share is ₹400 is ₹400 of spending, even though ₹1,200 left their account
 * (docs/03-DATA-FLOW.md section 7).
 */
export function userSpendingFor(transaction: Transaction, splits: readonly ExpenseSplit[]): Money {
  if (!isSpending(transaction) || transaction.deletedAt !== null) {
    return Money.zero(transaction.amount.currency);
  }

  const userShares = splits.filter(
    (split) =>
      split.transactionId === transaction.id &&
      split.participantType === "user" &&
      split.deletedAt === null,
  );

  // No split rows at all means the expense was never split, so the whole amount is
  // the user's. A shared expense always has a row per participant, including the
  // user, so an absent user row genuinely means a zero share.
  const anySplit = splits.some(
    (split) => split.transactionId === transaction.id && split.deletedAt === null,
  );
  if (!anySplit) return transaction.amount;

  return sumMoney(
    userShares.map((split) => split.shareAmount),
    transaction.amount.currency,
  );
}

/** Groups splits by the transaction they belong to. */
export function indexSplitsByTransaction(
  splits: readonly ExpenseSplit[],
): Map<string, ExpenseSplit[]> {
  const index = new Map<string, ExpenseSplit[]>();

  for (const split of splits) {
    if (split.deletedAt !== null) continue;
    const bucket = index.get(split.transactionId);
    if (bucket) bucket.push(split);
    else index.set(split.transactionId, [split]);
  }

  return index;
}

/**
 * Total spending across transactions.
 *
 * Uses each expense's user share, so a shared expense contributes only the part the
 * user is responsible for.
 */
export function calculateTotalSpending(
  transactions: readonly Transaction[],
  splits: readonly ExpenseSplit[],
  currency: string,
): Money {
  const bySplit = indexSplitsByTransaction(splits);

  const amounts = transactions
    .filter((transaction) => isSpending(transaction) && transaction.deletedAt === null)
    .map((transaction) => userSpendingFor(transaction, bySplit.get(transaction.id) ?? []));

  return sumMoney(amounts, currency);
}

export type CategorySpending = {
  /** Null groups everything with no category. */
  categoryId: string | null;
  amount: Money;
  transactionCount: number;
};

/** Spending per category, highest first. */
export function calculateSpendingByCategory(
  transactions: readonly Transaction[],
  splits: readonly ExpenseSplit[],
  currency: string,
): CategorySpending[] {
  const bySplit = indexSplitsByTransaction(splits);
  const totals = new Map<string | null, { amount: Money; transactionCount: number }>();

  for (const transaction of transactions) {
    if (!isSpending(transaction) || transaction.deletedAt !== null) continue;

    const share = userSpendingFor(transaction, bySplit.get(transaction.id) ?? []);
    if (share.isZero()) continue;

    const key = transaction.categoryId;
    const existing = totals.get(key);

    totals.set(key, {
      amount: existing ? sumMoney([existing.amount, share], currency) : share,
      transactionCount: (existing?.transactionCount ?? 0) + 1,
    });
  }

  return [...totals.entries()]
    .map(([categoryId, value]) => ({ categoryId, ...value }))
    .sort((a, b) => b.amount.amount.comparedTo(a.amount.amount));
}

export type MonthlySpending = {
  /** `YYYY-MM` in the user's timezone. */
  monthKey: string;
  amount: Money;
  transactionCount: number;
};

/**
 * Spending per calendar month in the user's timezone.
 *
 * Grouping in UTC would put a late-evening expense in the wrong month for users east
 * of UTC (docs/02-DATA-MODEL.md section 27).
 */
export function calculateMonthlySpending(
  transactions: readonly Transaction[],
  splits: readonly ExpenseSplit[],
  currency: string,
  timezone: string,
): MonthlySpending[] {
  const bySplit = indexSplitsByTransaction(splits);
  const totals = new Map<string, { amount: Money; transactionCount: number }>();

  for (const transaction of transactions) {
    if (!isSpending(transaction) || transaction.deletedAt !== null) continue;

    const share = userSpendingFor(transaction, bySplit.get(transaction.id) ?? []);
    if (share.isZero()) continue;

    const monthKey = formatMonthKey(transaction.date, timezone);
    const existing = totals.get(monthKey);

    totals.set(monthKey, {
      amount: existing ? sumMoney([existing.amount, share], currency) : share,
      transactionCount: (existing?.transactionCount ?? 0) + 1,
    });
  }

  return [...totals.entries()]
    .map(([monthKey, value]) => ({ monthKey, ...value }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

/** Spending in the calendar month containing `reference`, in the user's timezone. */
export function calculateSpendingForMonth(
  transactions: readonly Transaction[],
  splits: readonly ExpenseSplit[],
  currency: string,
  timezone: string,
  reference: Date,
): Money {
  const targetMonth = formatMonthKey(startOfMonthInTimezone(reference, timezone), timezone);

  const monthly = calculateMonthlySpending(transactions, splits, currency, timezone).find(
    (entry) => entry.monthKey === targetMonth,
  );

  return monthly?.amount ?? Money.zero(currency);
}
