import type { TransactionSettlementStatus } from "@/domain/settlements/transaction-status";
import { NO_SETTLEMENT_STATUS } from "@/domain/settlements/transaction-status";
import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";
import { isSharedExpense } from "@/domain/transactions/entities";
import { isSpending, userSpendingFor } from "@/domain/transactions/calculations";
import { formatDate, formatDateTime, formatRelativeDayLabel, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { referenceCodeFor } from "@/lib/utils/reference-code";
import type { MoneyDto, SplitStatus, TransactionType } from "@/types/common";

/**
 * Transaction view models.
 *
 * The list needs to distinguish "what left the account" from "what the user spent",
 * because for a shared expense they differ. Both are exposed so the UI never has to
 * recompute a share (docs/03-DATA-FLOW.md section 7).
 */

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  credit_card_payment: "Card payment",
};

export type TransactionListItem = {
  id: string;
  clientId: string;
  /**
   * The ledger reference — `#A3F09`.
   *
   * Formatted here rather than in the component, like `formattedAmount` beside it. Derived from
   * `clientId`, so it is the same code before and after sync; see `lib/utils/reference-code.ts`.
   *
   * Nullable because a server-allocated sequence would be null before its first sync, and typing it
   * nullable now means that change does not ripple through every consumer.
   */
  referenceCode: string | null;
  type: TransactionType;
  typeLabel: string;
  description: string;
  /** The full transaction amount. */
  amount: MoneyDto;
  formattedAmount: string;
  /**
   * The user's own share. Differs from `amount` on a shared expense, and is zero on
   * anything that is not spending.
   */
  userShare: MoneyDto;
  formattedUserShare: string;
  /** True when the two differ, so the UI can show both without guessing. */
  isSplit: boolean;
  isShared: boolean;
  participantCount: number;
  /**
   * Settlement state of the expense as a whole.
   *
   * Null when the expense creates no obligations - a personal expense has nothing to
   * settle - so the row shows no badge at all rather than "unsettled".
   */
  settlementStatus: SplitStatus | null;
  settlementLabel: string | null;
  /** How many shares are still owed, for the row's secondary line. */
  outstandingShareCount: number;
  date: string;
  dateLabel: string;
  dayLabel: string;
  accountId: string | null;
  /** Source account. Transfers and card payments only. */
  fromAccountId: string | null;
  /** Destination account. Transfers and card payments only. */
  toAccountId: string | null;
  categoryId: string | null;
  notes: string | null;
  paidByPersonId: string | null;
  syncVersion: number;
};

const SETTLEMENT_LABELS: Record<SplitStatus, string> = {
  unsettled: "Unsettled",
  partially_settled: "Part settled",
  settled: "Settled",
};

export function toTransactionListItem(
  transaction: Transaction,
  splits: readonly ExpenseSplit[],
  timezone: string,
  settlement: TransactionSettlementStatus = NO_SETTLEMENT_STATUS,
): TransactionListItem {
  const own = splits.filter((split) => split.transactionId === transaction.id);
  const userShare = userSpendingFor(transaction, own);
  const shared = isSharedExpense(own);

  return {
    id: transaction.id,
    clientId: transaction.clientId,
    referenceCode: referenceCodeFor(transaction),
    type: transaction.type,
    typeLabel: TYPE_LABELS[transaction.type],
    description: transaction.description,
    amount: transaction.amount.toJSON(),
    formattedAmount: formatMoney(transaction.amount),
    userShare: userShare.toJSON(),
    formattedUserShare: formatMoney(userShare),
    // Only spending has a share to compare. A transfer's share is zero by
    // definition, and reporting that as "split" would show the user "₹0 of ₹10,000".
    isSplit: isSpending(transaction) && !userShare.equals(transaction.amount),
    isShared: shared,
    participantCount: own.length,
    settlementStatus: settlement.status,
    settlementLabel: settlement.status ? SETTLEMENT_LABELS[settlement.status] : null,
    outstandingShareCount: settlement.outstandingCount,
    date: transaction.date.toISOString(),
    dateLabel: formatDate(transaction.date, timezone),
    dayLabel: formatRelativeDayLabel(transaction.date, timezone),
    accountId: transaction.accountId,
    fromAccountId: transaction.fromAccountId,
    toAccountId: transaction.toAccountId,
    categoryId: transaction.categoryId,
    notes: transaction.notes,
    paidByPersonId: transaction.paidBy?.type === "person" ? transaction.paidBy.personId : null,
    syncVersion: transaction.syncVersion,
  };
}

/** Adds the resolved names a detail screen needs. */
export type ExpenseDetailView = TransactionListItem & {
  accountName: string | null;
  categoryName: string | null;
  paidByName: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  /** Value for an `<input type="date">` in the user's timezone. */
  dateInputValue: string;
  participants: ExpenseParticipantView[];
};

export type ExpenseParticipantView = {
  expenseSplitId: string;
  name: string;
  isUser: boolean;
  personId: string | null;
  shareAmount: MoneyDto;
  formattedShare: string;
};

export type ExpenseDetailContext = {
  timezone: string;
  accountName?: string | null;
  categoryName?: string | null;
  /** Person names by id, for participant rows and the payer label. */
  personNames?: ReadonlyMap<string, string>;
  settlement?: TransactionSettlementStatus;
};

export function toExpenseDetailView(
  transaction: Transaction,
  splits: readonly ExpenseSplit[],
  context: ExpenseDetailContext,
): ExpenseDetailView {
  const { timezone, personNames } = context;
  const own = splits.filter((split) => split.transactionId === transaction.id);

  const paidByName =
    transaction.paidBy?.type === "person"
      ? (personNames?.get(transaction.paidBy.personId) ?? "Someone else")
      : "You";

  return {
    ...toTransactionListItem(transaction, own, timezone, context.settlement),
    accountName: context.accountName ?? null,
    categoryName: context.categoryName ?? null,
    paidByName,
    createdAtLabel: formatDateTime(transaction.createdAt, timezone),
    updatedAtLabel: formatDateTime(transaction.updatedAt, timezone),
    dateInputValue: toDateInputValue(transaction.date, timezone),
    participants: own.map((split) => ({
      expenseSplitId: split.id,
      name:
        split.participantType === "user"
          ? "You"
          : (personNames?.get(split.personId ?? "") ?? "Someone"),
      isUser: split.participantType === "user",
      personId: split.personId,
      shareAmount: split.shareAmount.toJSON(),
      formattedShare: formatMoney(split.shareAmount),
    })),
  };
}

/** Transactions grouped by local day, which is how the list is rendered. */
export type TransactionDayGroup = {
  dayKey: string;
  dayLabel: string;
  items: TransactionListItem[];
};

export function groupByDay(items: readonly TransactionListItem[]): TransactionDayGroup[] {
  const groups = new Map<string, TransactionDayGroup>();

  for (const item of items) {
    // The ISO date prefix is stable for grouping; dayLabel is the display form.
    const dayKey = item.date.slice(0, 10);
    const existing = groups.get(dayKey);

    if (existing) existing.items.push(item);
    else groups.set(dayKey, { dayKey, dayLabel: item.dayLabel, items: [item] });
  }

  // Items arrive newest-first from the repository, so insertion order is correct.
  return [...groups.values()];
}
