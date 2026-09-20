import type { Transaction } from "@/domain/transactions/entities";
import { formatDateTime, toDateInputValue } from "@/lib/dates";
import { formatAccountDirection } from "./direction";
import type { TransactionListItem } from "./expense-view-model";
import { toTransactionListItem } from "./expense-view-model";

/**
 * Transfer view models.
 *
 * A transfer has no participants, no category and no payer, so the expense detail
 * view would render three empty rows for it. What it does have is a direction, and
 * that is the one thing a transfer screen must make unmistakable: which account the
 * money left and which it arrived in.
 */

export type TransferListItem = TransactionListItem;

/** A transfer never has splits, so the caller never has to supply any. */
export function toTransferListItem(transaction: Transaction, timezone: string): TransferListItem {
  return toTransactionListItem(transaction, [], timezone);
}

export type TransferDetailView = TransferListItem & {
  fromAccountName: string | null;
  toAccountName: string | null;
  /**
   * Human-readable direction, e.g. "HDFC Savings → Cash".
   *
   * Built once here so the list row, the detail screen and the delete confirmation
   * cannot describe the same transfer differently.
   */
  directionLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  /** Value for an `<input type="date">` in the user's timezone. */
  dateInputValue: string;
};

export type TransferDetailContext = {
  timezone: string;
  fromAccountName?: string | null;
  toAccountName?: string | null;
};

export function toTransferDetailView(
  transaction: Transaction,
  context: TransferDetailContext,
): TransferDetailView {
  const fromAccountName = context.fromAccountName ?? null;
  const toAccountName = context.toAccountName ?? null;

  return {
    ...toTransferListItem(transaction, context.timezone),
    fromAccountName,
    toAccountName,
    directionLabel: formatAccountDirection(fromAccountName, toAccountName),
    createdAtLabel: formatDateTime(transaction.createdAt, context.timezone),
    updatedAtLabel: formatDateTime(transaction.updatedAt, context.timezone),
    dateInputValue: toDateInputValue(transaction.date, context.timezone),
  };
}
