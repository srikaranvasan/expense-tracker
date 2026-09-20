import type { Transaction } from "@/domain/transactions/entities";
import { formatDateTime, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/money";
import type { MoneyDto } from "@/types/common";
import { formatAccountDirection } from "./direction";
import type { TransactionListItem } from "./expense-view-model";
import { toTransactionListItem } from "./expense-view-model";

/**
 * Credit-card payment view models.
 *
 * The detail screen shows the card's outstanding balance *after* this payment, which
 * is the number the user actually wants: "how much do I still owe on this card?"
 */

export type CardPaymentListItem = TransactionListItem;

/** A card payment never has splits, so the caller never has to supply any. */
export function toCardPaymentListItem(
  transaction: Transaction,
  timezone: string,
): CardPaymentListItem {
  return toTransactionListItem(transaction, [], timezone);
}

export type CardPaymentDetailView = CardPaymentListItem & {
  /** Bank or cash account the money came from. */
  fromAccountName: string | null;
  /** The card that was paid. */
  toAccountName: string | null;
  /** e.g. "HDFC Savings → Amex Platinum". */
  directionLabel: string;
  /**
   * What is still owed on the card, counting this payment.
   *
   * Negative when the card holds a credit because it was overpaid.
   */
  outstandingAfter: MoneyDto | null;
  formattedOutstandingAfter: string | null;
  /** True when the card now holds a credit balance. */
  cardInCredit: boolean;
  createdAtLabel: string;
  updatedAtLabel: string;
  /** Value for an `<input type="date">` in the user's timezone. */
  dateInputValue: string;
};

export type CardPaymentDetailContext = {
  timezone: string;
  fromAccountName?: string | null;
  toAccountName?: string | null;
  /** Current outstanding balance on the card, already including this payment. */
  outstandingAfter?: Money | null;
};

export function toCardPaymentDetailView(
  transaction: Transaction,
  context: CardPaymentDetailContext,
): CardPaymentDetailView {
  const fromAccountName = context.fromAccountName ?? null;
  const toAccountName = context.toAccountName ?? null;
  const outstanding = context.outstandingAfter ?? null;

  return {
    ...toCardPaymentListItem(transaction, context.timezone),
    fromAccountName,
    toAccountName,
    directionLabel: formatAccountDirection(fromAccountName, toAccountName),
    outstandingAfter: outstanding?.toJSON() ?? null,
    formattedOutstandingAfter: outstanding ? formatMoney(outstanding) : null,
    cardInCredit: outstanding ? outstanding.isNegative() : false,
    createdAtLabel: formatDateTime(transaction.createdAt, context.timezone),
    updatedAtLabel: formatDateTime(transaction.updatedAt, context.timezone),
    dateInputValue: toDateInputValue(transaction.date, context.timezone),
  };
}
