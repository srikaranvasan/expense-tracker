import type { Account } from "@/domain/accounts/entities";
import type { Person } from "@/domain/people/entities";
import { assertPersonUsable } from "@/domain/people/rules";
import type { ExpenseSplit, PaidBy } from "@/domain/transactions/entities";
import { paidByPerson, paidByUser } from "@/domain/transactions/entities";
import {
  assertExpenseNotSettled,
  assertValidDescription,
  assertValidExpenseAmount,
  assertValidExpensePaymentSource,
} from "@/domain/transactions/rules";
import {
  assertIsSharedSplit,
  assertPayerIsKnown,
  assertSharesMatchTotal,
  assertValidParticipantList,
  calculateSplitShares,
  personParticipant,
  userParticipant,
} from "@/domain/transactions/splits";
import type { ComputedShare, ParticipantRef, SplitRequest } from "@/domain/transactions/splits";
import { InvalidSplitError } from "@/domain/shared/errors";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { Money } from "@/lib/money";
import { newClientId } from "@/lib/utils/client-id";
import { withTransaction } from "@/server/db/client";
import type { SettlementAllocationRepository } from "@/server/repositories/interfaces/settlement-repository";
import type {
  CreateExpenseSplitInput,
  ExpenseSplitRepository,
  TransactionRepository,
} from "@/server/repositories/interfaces/transaction-repository";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { settlementAllocationRepository } from "@/server/repositories/mongo/settlement-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { resolveOwnedAccounts } from "@/server/services/accounts/account-service";
import { resolveOwnedCategory } from "@/server/services/categories/category-service";
import { resolveOwnedPeople } from "@/server/services/people/person-service";
import type { ExpenseWithSplits } from "./expense-service";

/**
 * Shared expense use cases.
 *
 * A shared expense is the same transaction shape as a personal one with more than one
 * split. The two things that make it different are worth stating plainly:
 *
 *  1. **Who paid is separate from which account was used.** When another person paid,
 *     no account of the user's moved, so `accountId` must be null
 *     (docs/09-DATABASE-SCHEMA.md section 13).
 *  2. **The shares must sum exactly to the total.** Every balance and settlement
 *     figure is derived from the split rows, so an inexact split is an unfixable
 *     error, not a rounding nuisance (docs/02-DATA-MODEL.md section 13).
 */

export type SharedExpenseServiceDependencies = {
  transactions: TransactionRepository;
  splits: ExpenseSplitRepository;
  allocations: SettlementAllocationRepository;
};

function defaultDependencies(): SharedExpenseServiceDependencies {
  return {
    transactions: transactionRepository(),
    splits: expenseSplitRepository(),
    allocations: settlementAllocationRepository(),
  };
}

/** Participants as the API expresses them: `personId: null` means the user. */
export type ParticipantInput = {
  personId: string | null;
  /** Required for a custom split. */
  amount?: string;
  /** Required for a percentage split. */
  percentage?: string;
};

export type CreateSharedExpenseCommand = {
  clientId: string;
  amount: string;
  description: string;
  date: Date;
  /** Omit or null when another person paid. */
  accountId?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  /** Omit or null when the user paid. */
  paidByPersonId?: string | null;
  splitMethod: "equal" | "custom" | "percentage";
  participants: readonly ParticipantInput[];
  /** Stable ids for the split rows, so a retry reuses them. */
  splitClientIds?: readonly string[];
};

export async function createSharedExpense(
  userId: string,
  userCurrency: string,
  command: CreateSharedExpenseCommand,
  dependencies: SharedExpenseServiceDependencies = defaultDependencies(),
): Promise<ExpenseWithSplits> {
  const { transactions, splits } = dependencies;

  // Idempotency before validation: a retried offline create must return what it
  // already made (docs/08-OFFLINE-SYNC.md section 18).
  const existing = await transactions.findByClientId(userId, command.clientId);
  if (existing) {
    return { transaction: existing, splits: await splits.listByTransaction(userId, existing.id) };
  }

  const amount = Money.of(command.amount, userCurrency);
  assertValidExpenseAmount(amount);
  const description = assertValidDescription(command.description);

  // The participant list is checked before any lookup, so malformed input fails
  // without a database round trip.
  const participants = toParticipantRefs(command.participants);
  assertValidParticipantList(participants);
  assertIsSharedSplit(participants);

  const { paidBy, account, people } = await resolvePaymentAndPeople(
    userId,
    command.paidByPersonId ?? null,
    command.accountId ?? null,
    command.participants,
    amount,
  );

  const shares = calculateSplitShares(amount, buildSplitRequest(command));
  // Belt and braces: `calculateSplitShares` guarantees this for every method, but the
  // invariant is important enough to check on the way to the database.
  assertSharesMatchTotal(amount, shares);

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
        accountId: account?.id ?? null,
        categoryId: category?.id ?? null,
        paidBy,
        notes: command.notes ?? null,
      },
      { session },
    );

    const created = await splits.createMany(
      userId,
      toSplitInputs(transaction.id, shares, command.splitClientIds),
      amount.currency,
      { session },
    );

    return { transaction, splits: created };
  });

  logger.info("shared expense created", {
    operation: "expenses.createShared",
    userId,
    entityType: "transaction",
    entityId: result.transaction.id,
    participantCount: shares.length,
    splitMethod: command.splitMethod,
    payer: paidBy.type,
    peopleCount: people.size,
  });

  return result;
}

export type UpdateSharedExpenseCommand = {
  amount?: string;
  description?: string;
  date?: Date;
  accountId?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  paidByPersonId?: string | null;
  /** Supply all three together to change the split. */
  splitMethod?: "equal" | "custom" | "percentage";
  participants?: readonly ParticipantInput[];
  expectedSyncVersion?: number;
};

/**
 * Edits a shared expense.
 *
 * Refuses outright once any share has been settled. Re-splitting a settled expense
 * would leave settlement allocations pointing at shares that no longer exist, and the
 * person balance would drift with nothing in the data to reveal it
 * (docs/03-DATA-FLOW.md section 21).
 *
 * Changing the amount without also supplying participants is refused too: the existing
 * shares would no longer sum to the new total, breaking the core invariant. The client
 * must re-state the split.
 */
export async function updateSharedExpense(
  userId: string,
  expenseId: string,
  userCurrency: string,
  command: UpdateSharedExpenseCommand,
  dependencies: SharedExpenseServiceDependencies = defaultDependencies(),
): Promise<ExpenseWithSplits> {
  const { transactions, splits, allocations } = dependencies;

  const existing = await transactions.findById(userId, expenseId);
  if (!existing || existing.type !== "expense") throw new NotFoundError("Expense");

  const currentSplits = await splits.listByTransaction(userId, expenseId);
  if (!currentSplits.some((split) => split.participantType === "person")) {
    // Not a shared expense; the personal endpoint owns it.
    throw new NotFoundError("Shared expense");
  }

  const allocationCount = await allocations.countBySplitIds(
    userId,
    currentSplits.map((split) => split.id),
  );
  assertExpenseNotSettled(allocationCount, "changed");

  const amount =
    command.amount !== undefined ? Money.of(command.amount, userCurrency) : existing.amount;
  if (command.amount !== undefined) assertValidExpenseAmount(amount);

  const description =
    command.description !== undefined
      ? assertValidDescription(command.description)
      : existing.description;

  const rewritingSplit = command.participants !== undefined;

  if (command.amount !== undefined && !rewritingSplit) {
    // The existing shares sum to the old total. Keeping them against a new total
    // would break the invariant every balance depends on, so the client must
    // re-state the split rather than have the server guess how to redistribute.
    throw new InvalidSplitError(
      "Changing the amount also changes everyone's share, so send the updated split with it.",
    );
  }

  const participantInputs = command.participants ?? toParticipantInputs(currentSplits);

  const participants = toParticipantRefs(participantInputs);
  assertValidParticipantList(participants);
  assertIsSharedSplit(participants);

  const payerPersonId =
    command.paidByPersonId !== undefined
      ? command.paidByPersonId
      : existing.paidBy?.type === "person"
        ? existing.paidBy.personId
        : null;

  const accountId = command.accountId !== undefined ? command.accountId : existing.accountId;

  const { paidBy, account } = await resolvePaymentAndPeople(
    userId,
    payerPersonId,
    accountId,
    participantInputs,
    amount,
  );

  const shares = calculateSplitShares(
    amount,
    buildSplitRequest({
      splitMethod: command.splitMethod ?? "custom",
      participants: participantInputs,
    }),
  );
  assertSharesMatchTotal(amount, shares);

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
        ...(command.accountId !== undefined || command.paidByPersonId !== undefined
          ? { accountId: account?.id ?? null, paidBy }
          : {}),
        ...(command.categoryId !== undefined ? { categoryId: category?.id ?? null } : {}),
        ...(command.notes !== undefined ? { notes: command.notes } : {}),
        ...(command.expectedSyncVersion !== undefined
          ? { expectedSyncVersion: command.expectedSyncVersion }
          : {}),
      },
      { session },
    );

    let updatedSplits = currentSplits;

    if (rewritingSplit || command.amount !== undefined) {
      // Replaced wholesale rather than diffed. One code path - "the splits are now
      // exactly these" - is far easier to reason about than matching participants
      // between the old and new lists, and the old rows survive as soft-deleted
      // history.
      await splits.softDeleteByTransaction(userId, expenseId, { session });
      updatedSplits = await splits.createMany(
        userId,
        toSplitInputs(expenseId, shares),
        amount.currency,
        { session },
      );
    }

    return { transaction, splits: updatedSplits };
  });

  logger.info("shared expense updated", {
    operation: "expenses.updateShared",
    userId,
    entityType: "transaction",
    entityId: expenseId,
    resplit: rewritingSplit,
  });

  return result;
}

/**
 * Resolves the payer, the account, and every referenced person in one place.
 *
 * The payer and the participants are resolved together so a single lookup covers
 * both, and so the payment-source rule can be applied with the account already known.
 */
async function resolvePaymentAndPeople(
  userId: string,
  paidByPersonId: string | null,
  accountId: string | null,
  participants: readonly ParticipantInput[],
  amount: Money,
): Promise<{ paidBy: PaidBy; account: Account | null; people: Map<string, Person> }> {
  const personIds = new Set<string>();
  for (const participant of participants) {
    if (participant.personId) personIds.add(participant.personId);
  }
  if (paidByPersonId) personIds.add(paidByPersonId);

  const people = await resolveOwnedPeople(userId, [...personIds]);

  for (const person of people.values()) {
    assertPersonUsable(person, "this expense");
  }

  const paidBy = paidByPersonId ? paidByPerson(paidByPersonId) : paidByUser();
  assertPayerIsKnown(paidBy, new Set(people.keys()));

  let account: Account | null = null;
  if (accountId) {
    const accounts = await resolveOwnedAccounts(userId, [accountId]);
    account = accounts.get(accountId) ?? null;
  }

  // The rule that matters: an account is required when the user paid and forbidden
  // when somebody else did.
  assertValidExpensePaymentSource(paidBy, account, amount);

  return { paidBy, account, people };
}

function toParticipantRefs(participants: readonly ParticipantInput[]): ParticipantRef[] {
  return participants.map((participant) =>
    participant.personId ? personParticipant(participant.personId) : userParticipant(),
  );
}

function buildSplitRequest(command: {
  splitMethod: "equal" | "custom" | "percentage";
  participants: readonly ParticipantInput[];
}): SplitRequest {
  const refs = toParticipantRefs(command.participants);

  if (command.splitMethod === "equal") {
    return { method: "equal", participants: refs };
  }

  if (command.splitMethod === "percentage") {
    return {
      method: "percentage",
      participants: command.participants.map((participant, index) => ({
        participant: refs[index]!,
        percentage: participant.percentage ?? "0",
      })),
    };
  }

  return {
    method: "custom",
    participants: command.participants.map((participant, index) => ({
      participant: refs[index]!,
      amount: participant.amount ?? "0",
    })),
  };
}

function toSplitInputs(
  transactionId: string,
  shares: readonly ComputedShare[],
  clientIds?: readonly string[],
): CreateExpenseSplitInput[] {
  return shares.map((share, index) => ({
    clientId: clientIds?.[index] ?? newClientId(),
    transactionId,
    participantType: share.participant.type,
    personId: share.participant.type === "person" ? share.participant.personId : null,
    shareAmount: share.shareAmount,
  }));
}

/** Existing splits expressed as custom amounts, for an edit that keeps the split. */
function toParticipantInputs(splits: readonly ExpenseSplit[]): ParticipantInput[] {
  return splits.map((split) => ({
    personId: split.personId,
    amount: split.shareAmount.toString(),
  }));
}
