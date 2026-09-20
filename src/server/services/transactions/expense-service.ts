import type { ClientSession } from "mongodb";
import type { Account } from "@/domain/accounts/entities";
import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";
import { paidByUser } from "@/domain/transactions/entities";
import {
  assertExpenseNotSettled,
  assertValidDescription,
  assertValidExpenseAmount,
  assertValidExpensePaymentSource,
} from "@/domain/transactions/rules";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { Money } from "@/lib/money";
import { newClientId } from "@/lib/utils/client-id";
import { withTransaction } from "@/server/db/client";
import type { SettlementAllocationRepository } from "@/server/repositories/interfaces/settlement-repository";
import type {
  ExpenseSplitRepository,
  ListTransactionsQuery,
  TransactionRepository,
} from "@/server/repositories/interfaces/transaction-repository";
import type { CursorResult } from "@/server/repositories/interfaces/common";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { settlementAllocationRepository } from "@/server/repositories/mongo/settlement-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { resolveOwnedAccounts } from "@/server/services/accounts/account-service";
import { resolveOwnedCategory } from "@/server/services/categories/category-service";

/**
 * Expense use cases.
 *
 * A personal expense is an expense with exactly one split: the user, for the full
 * amount. Writing that split even when nothing is shared keeps one invariant true
 * everywhere - a transaction's active splits always sum to its amount
 * (docs/02-DATA-MODEL.md section 13) - so the spending, balance and settlement code
 * never needs a special case for "unsplit".
 *
 * Group 8 extends this with multi-participant splits.
 */

export type ExpenseServiceDependencies = {
  transactions: TransactionRepository;
  splits: ExpenseSplitRepository;
  allocations: SettlementAllocationRepository;
};

function defaultDependencies(): ExpenseServiceDependencies {
  return {
    transactions: transactionRepository(),
    splits: expenseSplitRepository(),
    allocations: settlementAllocationRepository(),
  };
}

export type ExpenseWithSplits = {
  transaction: Transaction;
  splits: ExpenseSplit[];
};

export type CreatePersonalExpenseCommand = {
  clientId: string;
  amount: string;
  description: string;
  date: Date;
  accountId: string;
  categoryId?: string | null;
  notes?: string | null;
  /** Client id for the user's own split, so a retry reuses it. */
  splitClientId?: string;
};

/**
 * Records an expense the user paid for themselves.
 *
 * The transaction and its split are written in one MongoDB transaction. A
 * transaction without its split would appear to have no participants, which would
 * corrupt every spending total that reads it
 * (docs/09-DATABASE-SCHEMA.md sections 32-33).
 */
export async function createPersonalExpense(
  userId: string,
  userCurrency: string,
  command: CreatePersonalExpenseCommand,
  dependencies: ExpenseServiceDependencies = defaultDependencies(),
): Promise<ExpenseWithSplits> {
  const { transactions, splits } = dependencies;

  // Idempotency first: a retried offline create must return what it already made
  // rather than being re-validated (docs/08-OFFLINE-SYNC.md section 18).
  const existing = await transactions.findByClientId(userId, command.clientId);
  if (existing) {
    return { transaction: existing, splits: await splits.listByTransaction(userId, existing.id) };
  }

  const amount = Money.of(command.amount, userCurrency);
  assertValidExpenseAmount(amount);
  const description = assertValidDescription(command.description);

  const accounts = await resolveOwnedAccounts(userId, [command.accountId]);
  const account = accounts.get(command.accountId) as Account;

  const paidBy = paidByUser();
  assertValidExpensePaymentSource(paidBy, account, amount);

  const category = await resolveOwnedCategory(userId, command.categoryId, "expense");

  const result = await withTransaction(async (session) => {
    const transaction = await transactions.create(
      userId,
      {
        clientId: command.clientId,
        type: "expense",
        amount,
        description,
        date: command.date,
        accountId: account.id,
        categoryId: category?.id ?? null,
        paidBy,
        notes: command.notes ?? null,
      },
      { session },
    );

    const created = await splits.createMany(
      userId,
      [
        {
          clientId: command.splitClientId ?? newClientId(),
          transactionId: transaction.id,
          participantType: "user",
          personId: null,
          shareAmount: amount,
        },
      ],
      amount.currency,
      { session },
    );

    return { transaction, splits: created };
  });

  logger.info("personal expense created", {
    operation: "expenses.createPersonal",
    userId,
    entityType: "transaction",
    entityId: result.transaction.id,
  });

  return result;
}

export type UpdatePersonalExpenseCommand = {
  amount?: string;
  description?: string;
  date?: Date;
  accountId?: string;
  categoryId?: string | null;
  notes?: string | null;
  expectedSyncVersion?: number;
};

/**
 * Edits an expense the user paid for themselves.
 *
 * Refuses if the expense is shared - that path needs the split editor in group 8 -
 * and refuses if any share has been settled, because changing the amount would leave
 * settlement allocations pointing at a share that no longer exists.
 */
export async function updatePersonalExpense(
  userId: string,
  expenseId: string,
  userCurrency: string,
  command: UpdatePersonalExpenseCommand,
  dependencies: ExpenseServiceDependencies = defaultDependencies(),
): Promise<ExpenseWithSplits> {
  const { transactions, splits, allocations } = dependencies;

  const existing = await transactions.findById(userId, expenseId);
  if (!existing || existing.type !== "expense") throw new NotFoundError("Expense");

  const currentSplits = await splits.listByTransaction(userId, expenseId);
  assertNotShared(currentSplits);

  await assertNoSettlements(userId, currentSplits, allocations, "changed");

  const amount =
    command.amount !== undefined ? Money.of(command.amount, userCurrency) : existing.amount;
  if (command.amount !== undefined) assertValidExpenseAmount(amount);

  const description =
    command.description !== undefined
      ? assertValidDescription(command.description)
      : existing.description;

  let accountId = existing.accountId;
  if (command.accountId !== undefined) {
    const accounts = await resolveOwnedAccounts(userId, [command.accountId]);
    const account = accounts.get(command.accountId) as Account;
    assertValidExpensePaymentSource(paidByUser(), account, amount);
    accountId = account.id;
  } else if (existing.accountId) {
    // The account is unchanged but the amount may not be, so the currency pairing is
    // re-checked against the amount actually being stored.
    const accounts = await resolveOwnedAccounts(userId, [existing.accountId]);
    const account = accounts.get(existing.accountId);
    if (account) assertValidExpensePaymentSource(paidByUser(), account, amount);
  }

  const category =
    command.categoryId !== undefined
      ? await resolveOwnedCategory(userId, command.categoryId, "expense")
      : null;

  const result = await withTransaction(async (session) => {
    const transaction = await transactions.update(
      userId,
      expenseId,
      {
        ...(command.amount !== undefined ? { amount } : {}),
        ...(command.description !== undefined ? { description } : {}),
        ...(command.date !== undefined ? { date: command.date } : {}),
        ...(command.accountId !== undefined ? { accountId } : {}),
        ...(command.categoryId !== undefined ? { categoryId: category?.id ?? null } : {}),
        ...(command.notes !== undefined ? { notes: command.notes } : {}),
        ...(command.expectedSyncVersion !== undefined
          ? { expectedSyncVersion: command.expectedSyncVersion }
          : {}),
      },
      { session },
    );

    // The single user split must keep matching the amount, so it is rewritten rather
    // than edited in place. Replacing it keeps one code path for "the splits of this
    // expense are now exactly these".
    let updatedSplits = currentSplits;
    if (command.amount !== undefined) {
      await splits.softDeleteByTransaction(userId, expenseId, { session });
      updatedSplits = await splits.createMany(
        userId,
        [
          {
            clientId: newClientId(),
            transactionId: expenseId,
            participantType: "user",
            personId: null,
            shareAmount: amount,
          },
        ],
        amount.currency,
        { session },
      );
    }

    return { transaction, splits: updatedSplits };
  });

  logger.info("personal expense updated", {
    operation: "expenses.updatePersonal",
    userId,
    entityType: "transaction",
    entityId: expenseId,
  });

  return result;
}

/**
 * Soft-deletes an expense and its splits.
 *
 * Physical deletion would let an offline device resurrect the record on its next
 * sync, and would destroy the trail behind any balance that referenced it
 * (docs/09-DATABASE-SCHEMA.md section 25).
 */
export async function deleteExpense(
  userId: string,
  expenseId: string,
  dependencies: ExpenseServiceDependencies = defaultDependencies(),
): Promise<void> {
  const { transactions, splits, allocations } = dependencies;

  const existing = await transactions.findById(userId, expenseId);
  if (!existing || existing.type !== "expense") throw new NotFoundError("Expense");

  const currentSplits = await splits.listByTransaction(userId, expenseId);
  await assertNoSettlements(userId, currentSplits, allocations, "deleted");

  await withTransaction(async (session) => {
    // Splits first: if the second write failed, an expense with no splits is a
    // clearer inconsistency than orphaned splits pointing at nothing.
    await splits.softDeleteByTransaction(userId, expenseId, { session });
    await transactions.softDelete(userId, expenseId, { session });
  });

  logger.info("expense deleted", {
    operation: "expenses.delete",
    userId,
    entityType: "transaction",
    entityId: expenseId,
  });
}

export async function getExpense(
  userId: string,
  expenseId: string,
  dependencies: ExpenseServiceDependencies = defaultDependencies(),
): Promise<ExpenseWithSplits> {
  const { transactions, splits } = dependencies;

  const transaction = await transactions.findById(userId, expenseId);
  if (!transaction) throw new NotFoundError("Expense");

  return { transaction, splits: await splits.listByTransaction(userId, expenseId) };
}

/** Paginated expense list with the splits needed to show each user share. */
export async function listExpenses(
  userId: string,
  query: ListTransactionsQuery,
  dependencies: ExpenseServiceDependencies = defaultDependencies(),
): Promise<CursorResult<Transaction> & { splits: ExpenseSplit[] }> {
  const { transactions, splits } = dependencies;

  const page = await transactions.list(userId, query);
  const relatedSplits = await splits.listByTransactions(
    userId,
    page.items.map((transaction) => transaction.id),
  );

  return { ...page, splits: relatedSplits };
}

function assertNotShared(splits: readonly ExpenseSplit[]): void {
  const shared = splits.some((split) => split.participantType === "person");
  if (shared) {
    throw new NotFoundError("Personal expense");
  }
}

async function assertNoSettlements(
  userId: string,
  splits: readonly ExpenseSplit[],
  allocations: SettlementAllocationRepository,
  action: string,
  session?: ClientSession,
): Promise<void> {
  if (splits.length === 0) return;

  const count = await allocations.countBySplitIds(
    userId,
    splits.map((split) => split.id),
    session ? { session } : undefined,
  );

  assertExpenseNotSettled(count, action);
}
