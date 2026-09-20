import type { Account } from "@/domain/accounts/entities";
import {
  calculateCreditCardOutstanding,
  deriveAccountMovements,
} from "@/domain/accounts/calculations";
import type { Transaction } from "@/domain/transactions/entities";
import {
  DEFAULT_CARD_PAYMENT_DESCRIPTION,
  assertValidCardPaymentAccounts,
  assertValidCardPaymentAmount,
} from "@/domain/transactions/card-payment-rules";
import { assertValidDescription } from "@/domain/transactions/rules";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { Money } from "@/lib/money";
import type { CursorResult } from "@/server/repositories/interfaces/common";
import type {
  ListTransactionsQuery,
  TransactionRepository,
} from "@/server/repositories/interfaces/transaction-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { resolveOwnedAccounts } from "@/server/services/accounts/account-service";

/**
 * Credit-card payment use cases.
 *
 * A card payment discharges a liability: money leaves a bank or cash account and the
 * card's outstanding balance falls by the same amount, which raises available credit.
 *
 * It is **not spending**. The spending was recorded when the card was used to buy
 * something; counting the payment as well would double-count every card purchase
 * (docs/09-DATABASE-SCHEMA.md section 36). `isSpending()` already excludes the type
 * and nothing here writes an expense split.
 *
 * Like a transfer, this is a single transaction document - `fromAccountId` plus
 * `toAccountId`, type `"credit_card_payment"` - so both effects derive from one row
 * and cannot disagree. No `withTransaction()` is needed for a single write.
 */

export type CardPaymentServiceDependencies = {
  transactions: TransactionRepository;
};

function defaultDependencies(): CardPaymentServiceDependencies {
  return { transactions: transactionRepository() };
}

export type CreateCardPaymentCommand = {
  clientId: string;
  amount: string;
  /** Bank or cash account the money comes from. */
  fromAccountId: string;
  /** The credit card being paid. */
  toAccountId: string;
  date: Date;
  description?: string | null;
  notes?: string | null;
};

/**
 * Records a payment towards a credit card.
 *
 * Overpayment is deliberately permitted. See `isOverpayment()` in
 * `domain/transactions/card-payment-rules.ts` for why refusing it would be the worse
 * failure.
 */
export async function createCardPayment(
  userId: string,
  userCurrency: string,
  command: CreateCardPaymentCommand,
  dependencies: CardPaymentServiceDependencies = defaultDependencies(),
): Promise<Transaction> {
  const { transactions } = dependencies;

  // Idempotency before validation: a retried offline create must return the record it
  // already made rather than being judged a second time
  // (docs/08-OFFLINE-SYNC.md section 18).
  const existing = await transactions.findByClientId(userId, command.clientId);
  if (existing) return existing;

  const amount = Money.of(command.amount, userCurrency);
  assertValidCardPaymentAmount(amount);

  const description = assertValidDescription(
    command.description || DEFAULT_CARD_PAYMENT_DESCRIPTION,
  );

  const { from, to } = await resolveCardPaymentAccounts(
    userId,
    command.fromAccountId,
    command.toAccountId,
    amount,
  );

  const payment = await transactions.create(userId, {
    clientId: command.clientId,
    type: "credit_card_payment",
    amount,
    description,
    date: command.date,
    fromAccountId: from.id,
    toAccountId: to.id,
    // Not spending, so no category; both sides are the user's own, so no payer.
    categoryId: null,
    accountId: null,
    paidBy: null,
    notes: command.notes ?? null,
  });

  logger.info("credit card payment created", {
    operation: "cardPayments.create",
    userId,
    entityType: "transaction",
    entityId: payment.id,
  });

  return payment;
}

export type UpdateCardPaymentCommand = {
  amount?: string;
  fromAccountId?: string;
  toAccountId?: string;
  date?: Date;
  description?: string;
  notes?: string | null;
  expectedSyncVersion?: number;
};

/**
 * Edits a card payment.
 *
 * Both accounts are re-validated as a pair even when only one changed, because
 * changing one side alone can produce an invalid combination - a card paying a card,
 * or a payment to a plain bank account - that a partial check would not notice.
 */
export async function updateCardPayment(
  userId: string,
  paymentId: string,
  userCurrency: string,
  command: UpdateCardPaymentCommand,
  dependencies: CardPaymentServiceDependencies = defaultDependencies(),
): Promise<Transaction> {
  const { transactions } = dependencies;

  const existing = await loadCardPayment(userId, paymentId, transactions);

  const amount =
    command.amount !== undefined ? Money.of(command.amount, userCurrency) : existing.amount;
  if (command.amount !== undefined) assertValidCardPaymentAmount(amount);

  const description =
    command.description !== undefined
      ? assertValidDescription(command.description || DEFAULT_CARD_PAYMENT_DESCRIPTION)
      : existing.description;

  const fromAccountId = command.fromAccountId ?? existing.fromAccountId;
  const toAccountId = command.toAccountId ?? existing.toAccountId;

  if (!fromAccountId || !toAccountId) {
    // A stored payment always has both sides. Reaching here means the record was
    // written by something that bypassed this service.
    throw new NotFoundError("Credit card payment");
  }

  const { from, to } = await resolveCardPaymentAccounts(userId, fromAccountId, toAccountId, amount);

  const updated = await transactions.update(userId, paymentId, {
    ...(command.amount !== undefined ? { amount } : {}),
    ...(command.description !== undefined ? { description } : {}),
    ...(command.date !== undefined ? { date: command.date } : {}),
    fromAccountId: from.id,
    toAccountId: to.id,
    ...(command.notes !== undefined ? { notes: command.notes } : {}),
    ...(command.expectedSyncVersion !== undefined
      ? { expectedSyncVersion: command.expectedSyncVersion }
      : {}),
  });

  logger.info("credit card payment updated", {
    operation: "cardPayments.update",
    userId,
    entityType: "transaction",
    entityId: paymentId,
  });

  return updated;
}

/**
 * Soft-deletes a card payment, which raises the card's outstanding balance again.
 *
 * Nothing is undone by hand: outstanding and available credit are derived, so once
 * the record leaves the projection the liability it discharged reappears.
 */
export async function deleteCardPayment(
  userId: string,
  paymentId: string,
  dependencies: CardPaymentServiceDependencies = defaultDependencies(),
): Promise<void> {
  const { transactions } = dependencies;

  await loadCardPayment(userId, paymentId, transactions);
  await transactions.softDelete(userId, paymentId);

  logger.info("credit card payment deleted", {
    operation: "cardPayments.delete",
    userId,
    entityType: "transaction",
    entityId: paymentId,
  });
}

export async function getCardPayment(
  userId: string,
  paymentId: string,
  dependencies: CardPaymentServiceDependencies = defaultDependencies(),
): Promise<Transaction> {
  return loadCardPayment(userId, paymentId, dependencies.transactions);
}

/** Paginated list of card payments only. */
export async function listCardPayments(
  userId: string,
  query: Omit<ListTransactionsQuery, "types">,
  dependencies: CardPaymentServiceDependencies = defaultDependencies(),
): Promise<CursorResult<Transaction>> {
  return dependencies.transactions.list(userId, { ...query, types: ["credit_card_payment"] });
}

/**
 * Outstanding balance on a card right now, for the payment form.
 *
 * Derived from the card's own movements, so the figure the form suggests is the same
 * one the accounts screen shows rather than a second, drifting copy.
 */
export async function getCardOutstanding(
  userId: string,
  card: Account,
  dependencies: CardPaymentServiceDependencies = defaultDependencies(),
): Promise<Money> {
  const related = await dependencies.transactions.listForProjection(userId, {
    accountIds: [card.id],
  });

  return calculateCreditCardOutstanding(card, deriveAccountMovements(related));
}

/**
 * Loads a card payment, treating any other transaction type as absent.
 *
 * An expense or transfer id must not be editable through these routes: the rules
 * differ, and letting one route rewrite the other's records is how a transfer
 * silently becomes a card payment.
 */
async function loadCardPayment(
  userId: string,
  paymentId: string,
  transactions: TransactionRepository,
): Promise<Transaction> {
  const transaction = await transactions.findById(userId, paymentId);
  if (!transaction || transaction.type !== "credit_card_payment") {
    throw new NotFoundError("Credit card payment");
  }
  return transaction;
}

async function resolveCardPaymentAccounts(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: Money,
): Promise<{ from: Account; to: Account }> {
  const accounts = await resolveOwnedAccounts(userId, [fromAccountId, toAccountId]);

  // resolveOwnedAccounts throws for any id it could not find, so both are present.
  // Equal ids collapse to one entry, and the rule below rejects that.
  const from = accounts.get(fromAccountId) as Account;
  const to = accounts.get(toAccountId) as Account;

  assertValidCardPaymentAccounts(from, to, amount);

  return { from, to };
}
