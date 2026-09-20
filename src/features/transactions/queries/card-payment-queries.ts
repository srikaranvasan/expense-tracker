import type { ListTransactionsQuery } from "@/server/repositories/interfaces/transaction-repository";
import { accountRepository } from "@/server/repositories/mongo/account-repository";
import {
  getCardOutstanding,
  getCardPayment,
  listCardPayments,
} from "@/server/services/transactions/card-payment-service";
import type {
  CardPaymentDetailView,
  CardPaymentListItem,
} from "../view-models/card-payment-view-model";
import {
  toCardPaymentDetailView,
  toCardPaymentListItem,
} from "../view-models/card-payment-view-model";

/**
 * Read models for the credit-card payment screens.
 */

export type CardPaymentListView = {
  items: CardPaymentListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Account names by id, covering both sides of every row. */
  accountNames: Record<string, string>;
};

export async function getCardPaymentListView(
  userId: string,
  timezone: string,
  query: Omit<ListTransactionsQuery, "types">,
): Promise<CardPaymentListView> {
  const page = await listCardPayments(userId, query);

  const accountIds = new Set<string>();
  for (const payment of page.items) {
    if (payment.fromAccountId) accountIds.add(payment.fromAccountId);
    if (payment.toAccountId) accountIds.add(payment.toAccountId);
  }

  const accounts = await accountRepository().findManyByIds(userId, [...accountIds]);

  return {
    items: page.items.map((payment) => toCardPaymentListItem(payment, timezone)),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    accountNames: Object.fromEntries(accounts.map((account) => [account.id, account.name])),
  };
}

export async function getCardPaymentDetailView(
  userId: string,
  paymentId: string,
  timezone: string,
): Promise<CardPaymentDetailView> {
  const payment = await getCardPayment(userId, paymentId);

  const accountIds = [payment.fromAccountId, payment.toAccountId].filter(
    (id): id is string => id !== null,
  );
  const accounts = await accountRepository().findManyByIds(userId, accountIds);
  const byId = new Map(accounts.map((account) => [account.id, account] as const));

  const card = payment.toAccountId ? byId.get(payment.toAccountId) : undefined;

  return toCardPaymentDetailView(payment, {
    timezone,
    fromAccountName: payment.fromAccountId ? (byId.get(payment.fromAccountId)?.name ?? null) : null,
    toAccountName: card?.name ?? null,
    // Recomputed from the card's movements, so it is the same figure the accounts
    // screen shows rather than a second copy that can drift.
    outstandingAfter: card ? await getCardOutstanding(userId, card) : null,
  });
}

/**
 * The card's current outstanding balance, for the payment form's suggestion.
 *
 * Returns `null` when the id is not a usable card of the user's, so the form simply
 * shows no suggestion rather than failing.
 */
export async function getCardOutstandingForForm(
  userId: string,
  cardId: string,
): Promise<{ formatted: string; amount: string } | null> {
  const card = await accountRepository().findById(userId, cardId);
  if (!card || card.type !== "credit_card") return null;

  const outstanding = await getCardOutstanding(userId, card);
  return { formatted: outstanding.toFixedString(), amount: outstanding.amount.toFixed() };
}
