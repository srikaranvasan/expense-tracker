import type { Account } from "@/domain/accounts/entities";
import type { Transaction } from "@/domain/transactions/entities";
import { assertValidDescription } from "@/domain/transactions/rules";
import {
  DEFAULT_TRANSFER_DESCRIPTION,
  assertValidTransferAccounts,
  assertValidTransferAmount,
} from "@/domain/transactions/transfer-rules";
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
 * Transfer use cases: money moving between two accounts the user owns.
 *
 * A transfer is deliberately *not* spending. Moving ₹10,000 from savings to cash
 * consumes nothing, so counting it would inflate the monthly total and make the
 * dashboard lie (docs/09-DATABASE-SCHEMA.md section 36). `isSpending()` already
 * excludes the type, and nothing here creates an expense split.
 *
 * Unlike an expense, a transfer is a single document: `fromAccountId` and
 * `toAccountId` on one transaction row. Both balances then derive from that one
 * record through `deriveAccountMovements()`, which cannot leave the two sides
 * disagreeing the way a pair of rows could. That is also why no `withTransaction()`
 * wrapper appears below - a single document write is already atomic, and wrapping it
 * would only suggest there is more than one write to protect.
 */

export type TransferServiceDependencies = {
  transactions: TransactionRepository;
};

function defaultDependencies(): TransferServiceDependencies {
  return { transactions: transactionRepository() };
}

export type CreateTransferCommand = {
  clientId: string;
  amount: string;
  fromAccountId: string;
  toAccountId: string;
  date: Date;
  description?: string | null;
  notes?: string | null;
};

/**
 * Records a movement between two of the user's accounts.
 *
 * The description is optional here, unlike on an expense: "Transfer" already says
 * everything a transfer needs to say, whereas an expense with no description is
 * unidentifiable later.
 */
export async function createTransfer(
  userId: string,
  userCurrency: string,
  command: CreateTransferCommand,
  dependencies: TransferServiceDependencies = defaultDependencies(),
): Promise<Transaction> {
  const { transactions } = dependencies;

  // Idempotency before validation: a retried offline create must return the record
  // it already made rather than being judged a second time
  // (docs/08-OFFLINE-SYNC.md section 18).
  const existing = await transactions.findByClientId(userId, command.clientId);
  if (existing) return existing;

  const amount = Money.of(command.amount, userCurrency);
  assertValidTransferAmount(amount);

  const description = assertValidDescription(command.description || DEFAULT_TRANSFER_DESCRIPTION);

  const { from, to } = await resolveTransferAccounts(
    userId,
    command.fromAccountId,
    command.toAccountId,
    amount,
  );

  const transfer = await transactions.create(userId, {
    clientId: command.clientId,
    type: "transfer",
    amount,
    description,
    date: command.date,
    fromAccountId: from.id,
    toAccountId: to.id,
    // A transfer has no category, no single account and no payer: it is not
    // spending, and both sides are the user's own.
    categoryId: null,
    accountId: null,
    paidBy: null,
    notes: command.notes ?? null,
  });

  logger.info("transfer created", {
    operation: "transfers.create",
    userId,
    entityType: "transaction",
    entityId: transfer.id,
  });

  return transfer;
}

export type UpdateTransferCommand = {
  amount?: string;
  fromAccountId?: string;
  toAccountId?: string;
  date?: Date;
  description?: string;
  notes?: string | null;
  expectedSyncVersion?: number;
};

/**
 * Edits a transfer.
 *
 * Both accounts are re-validated as a pair even when only one of them changed.
 * Changing just the destination could otherwise land it on the source account, or
 * on a credit card, and a partial check would not notice.
 */
export async function updateTransfer(
  userId: string,
  transferId: string,
  userCurrency: string,
  command: UpdateTransferCommand,
  dependencies: TransferServiceDependencies = defaultDependencies(),
): Promise<Transaction> {
  const { transactions } = dependencies;

  const existing = await loadTransfer(userId, transferId, transactions);

  const amount =
    command.amount !== undefined ? Money.of(command.amount, userCurrency) : existing.amount;
  if (command.amount !== undefined) assertValidTransferAmount(amount);

  const description =
    command.description !== undefined
      ? assertValidDescription(command.description || DEFAULT_TRANSFER_DESCRIPTION)
      : existing.description;

  const fromAccountId = command.fromAccountId ?? existing.fromAccountId;
  const toAccountId = command.toAccountId ?? existing.toAccountId;

  if (!fromAccountId || !toAccountId) {
    // A stored transfer always has both sides. Reaching here means the record was
    // written by something that bypassed this service.
    throw new NotFoundError("Transfer");
  }

  const { from, to } = await resolveTransferAccounts(userId, fromAccountId, toAccountId, amount);

  const updated = await transactions.update(userId, transferId, {
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

  logger.info("transfer updated", {
    operation: "transfers.update",
    userId,
    entityType: "transaction",
    entityId: transferId,
  });

  return updated;
}

/**
 * Soft-deletes a transfer, which restores both account balances.
 *
 * Nothing has to be undone by hand: the balances are derived, so once the record
 * stops being returned by the projection the two movements it produced disappear
 * with it. Soft rather than hard so an offline device cannot resurrect it on its
 * next sync (docs/09-DATABASE-SCHEMA.md section 25).
 *
 * No settlement check is needed either - a transfer has no splits, so nothing can
 * ever have been settled against it.
 */
export async function deleteTransfer(
  userId: string,
  transferId: string,
  dependencies: TransferServiceDependencies = defaultDependencies(),
): Promise<void> {
  const { transactions } = dependencies;

  await loadTransfer(userId, transferId, transactions);
  await transactions.softDelete(userId, transferId);

  logger.info("transfer deleted", {
    operation: "transfers.delete",
    userId,
    entityType: "transaction",
    entityId: transferId,
  });
}

export async function getTransfer(
  userId: string,
  transferId: string,
  dependencies: TransferServiceDependencies = defaultDependencies(),
): Promise<Transaction> {
  return loadTransfer(userId, transferId, dependencies.transactions);
}

/** Paginated list of transfers only. */
export async function listTransfers(
  userId: string,
  query: Omit<ListTransactionsQuery, "types">,
  dependencies: TransferServiceDependencies = defaultDependencies(),
): Promise<CursorResult<Transaction>> {
  return dependencies.transactions.list(userId, { ...query, types: ["transfer"] });
}

/**
 * Loads a transfer, treating a transaction of any other type as absent.
 *
 * An expense id passed to a transfer endpoint must not be editable through it: the
 * two have different rules, and letting one route rewrite the other's records is
 * how a card payment silently becomes a transfer.
 */
async function loadTransfer(
  userId: string,
  transferId: string,
  transactions: TransactionRepository,
): Promise<Transaction> {
  const transaction = await transactions.findById(userId, transferId);
  if (!transaction || transaction.type !== "transfer") throw new NotFoundError("Transfer");
  return transaction;
}

/** Resolves and validates the account pair for a transfer. */
async function resolveTransferAccounts(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: Money,
): Promise<{ from: Account; to: Account }> {
  const accounts = await resolveOwnedAccounts(userId, [fromAccountId, toAccountId]);

  // resolveOwnedAccounts throws for any id it could not find, so both are present.
  // When the ids are equal it returns one entry, and the rule below rejects that.
  const from = accounts.get(fromAccountId) as Account;
  const to = accounts.get(toAccountId) as Account;

  assertValidTransferAccounts(from, to, amount);

  return { from, to };
}
