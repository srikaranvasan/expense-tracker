import type { ClientSession } from "mongodb";
import { assertAccountUsable } from "@/domain/accounts/rules";
import { classifyObligation } from "@/domain/people/calculations";
import { assertPersonUsable } from "@/domain/people/rules";
import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import { summariseSplits } from "@/domain/settlements/calculations";
import {
  assertValidAllocations,
  assertValidSettlementAmount,
  obligationDirectionFor,
} from "@/domain/settlements/validators";
import type { AllocationTarget } from "@/domain/settlements/validators";
import { InvalidSettlementError } from "@/domain/shared/errors";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { Money } from "@/lib/money";
import { newClientId } from "@/lib/utils/client-id";
import { withTransaction } from "@/server/db/client";
import type { CursorResult } from "@/server/repositories/interfaces/common";
import type {
  ListSettlementsQuery,
  SettlementAllocationRepository,
  SettlementRepository,
} from "@/server/repositories/interfaces/settlement-repository";
import type {
  ExpenseSplitRepository,
  TransactionRepository,
} from "@/server/repositories/interfaces/transaction-repository";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import {
  settlementAllocationRepository,
  settlementRepository,
} from "@/server/repositories/mongo/settlement-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { resolveOwnedAccounts } from "@/server/services/accounts/account-service";
import { resolveOwnedPeople } from "@/server/services/people/person-service";
import type { SettlementDirection } from "@/types/common";

/**
 * Settlement use cases.
 *
 * A settlement records real money moving to clear an existing shared-expense balance.
 * It is not an expense and must never be recorded as one
 * (docs/00-README.md, Non-Negotiable Accounting Principle).
 *
 * The critical property here is concurrency safety. The outstanding amount on each
 * share is read **inside** the same database transaction that writes the allocations,
 * so two settlements submitted at the same moment cannot each pass a check that
 * together they would fail (docs/08-OFFLINE-SYNC.md section 34).
 */

export type SettlementServiceDependencies = {
  settlements: SettlementRepository;
  allocations: SettlementAllocationRepository;
  splits: ExpenseSplitRepository;
  transactions: TransactionRepository;
};

function defaultDependencies(): SettlementServiceDependencies {
  return {
    settlements: settlementRepository(),
    allocations: settlementAllocationRepository(),
    splits: expenseSplitRepository(),
    transactions: transactionRepository(),
  };
}

export type SettlementWithAllocations = {
  settlement: Settlement;
  allocations: SettlementAllocation[];
};

export type AllocationInput = {
  expenseSplitId: string;
  amount: string;
};

export type CreateSettlementCommand = {
  clientId: string;
  personId: string;
  direction: SettlementDirection;
  amount: string;
  /** The user's account the money left from or arrived in. Optional (cash). */
  accountId?: string | null;
  date: Date;
  notes?: string | null;
  allocations: readonly AllocationInput[];
  /** Stable ids for the allocation rows, so a retry reuses them. */
  allocationClientIds?: readonly string[];
};

/**
 * Records a settlement and its allocations atomically.
 *
 * Either the settlement and every allocation exist, or none of them do. A settlement
 * without allocations would move money without reducing any balance; allocations
 * without a settlement would reduce balances with no payment behind them.
 */
export async function createSettlement(
  userId: string,
  userCurrency: string,
  command: CreateSettlementCommand,
  dependencies: SettlementServiceDependencies = defaultDependencies(),
): Promise<SettlementWithAllocations> {
  const { settlements, allocations, splits, transactions } = dependencies;

  // Idempotency before validation: a retried offline settlement must return the
  // original rather than being re-checked against a balance it already reduced.
  const existing = await settlements.findByClientId(userId, command.clientId);
  if (existing) {
    return {
      settlement: existing,
      allocations: await allocations.listBySettlement(userId, existing.id),
    };
  }

  const amount = Money.of(command.amount, userCurrency);
  assertValidSettlementAmount(amount);

  const people = await resolveOwnedPeople(userId, [command.personId]);
  const person = people.get(command.personId);
  if (!person) throw new NotFoundError("Person");
  assertPersonUsable(person, "this settlement");

  let accountId: string | null = null;
  if (command.accountId) {
    const accounts = await resolveOwnedAccounts(userId, [command.accountId]);
    const account = accounts.get(command.accountId);
    if (!account) throw new NotFoundError("Account");
    assertAccountUsable(account, "this settlement");

    if (account.currency !== amount.currency) {
      throw new InvalidSettlementError(
        `"${account.name}" is a ${account.currency} account, so the payment must be in ${account.currency}.`,
      );
    }

    accountId = account.id;
  }

  const requestedAllocations = command.allocations.map((allocation) => ({
    expenseSplitId: allocation.expenseSplitId,
    amount: Money.of(allocation.amount, amount.currency),
  }));

  if (requestedAllocations.length === 0) {
    throw new InvalidSettlementError("Choose which expenses this payment settles.");
  }

  const result = await withTransaction(async (session) => {
    // Read the current outstanding amounts inside the transaction. This is the whole
    // point: a snapshot taken before the transaction could be stale by the time the
    // allocations are written.
    const targets = await loadAllocationTargets(
      userId,
      requestedAllocations.map((allocation) => allocation.expenseSplitId),
      { splits, transactions, allocations },
      session,
    );

    assertValidAllocations({
      settlementAmount: amount,
      direction: command.direction,
      personId: command.personId,
      allocations: requestedAllocations,
      targets,
    });

    // Writing to the splits being settled is what serialises concurrent settlements.
    // Snapshot isolation alone would let two transactions each read "nothing allocated"
    // and insert different allocation rows, and both would commit - a genuine
    // over-settlement. Touching the contended rows forces a write conflict, so the
    // loser retries, re-reads the now-visible allocation, and fails validation.
    await splits.touchMany(
      userId,
      requestedAllocations.map((allocation) => allocation.expenseSplitId),
      { session },
    );

    const settlement = await settlements.create(
      userId,
      {
        clientId: command.clientId,
        personId: command.personId,
        direction: command.direction,
        amount,
        accountId,
        date: command.date,
        notes: command.notes ?? null,
      },
      { session },
    );

    const created = await allocations.createMany(
      userId,
      requestedAllocations.map((allocation, index) => ({
        clientId: command.allocationClientIds?.[index] ?? newClientId(),
        settlementId: settlement.id,
        expenseSplitId: allocation.expenseSplitId,
        amount: allocation.amount,
      })),
      amount.currency,
      { session },
    );

    return { settlement, allocations: created };
  });

  logger.info("settlement created", {
    operation: "settlements.create",
    userId,
    entityType: "settlement",
    entityId: result.settlement.id,
    direction: command.direction,
    allocationCount: result.allocations.length,
  });

  return result;
}

/**
 * Soft-deletes a settlement and its allocations.
 *
 * Removing the allocations is what restores the balances: they are the only thing the
 * balance calculation reads. Both writes happen in one transaction so a balance can
 * never be left half-restored.
 */
export async function deleteSettlement(
  userId: string,
  settlementId: string,
  dependencies: SettlementServiceDependencies = defaultDependencies(),
): Promise<void> {
  const { settlements, allocations, splits } = dependencies;

  const existing = await settlements.findById(userId, settlementId);
  if (!existing) throw new NotFoundError("Settlement");

  await withTransaction(async (session) => {
    const current = await allocations.listBySettlement(userId, settlementId, { session });

    await allocations.softDeleteBySettlement(userId, settlementId, { session });
    await settlements.softDelete(userId, settlementId, { session });

    // The affected splits become outstanding again. Touching them serialises against a
    // concurrent settlement of the same split and tells offline clients to re-read.
    await splits.touchMany(
      userId,
      current.map((allocation) => allocation.expenseSplitId),
      { session },
    );
  });

  logger.info("settlement deleted", {
    operation: "settlements.delete",
    userId,
    entityType: "settlement",
    entityId: settlementId,
  });
}

export async function getSettlement(
  userId: string,
  settlementId: string,
  dependencies: SettlementServiceDependencies = defaultDependencies(),
): Promise<SettlementWithAllocations> {
  const { settlements, allocations } = dependencies;

  const settlement = await settlements.findById(userId, settlementId);
  if (!settlement) throw new NotFoundError("Settlement");

  return {
    settlement,
    allocations: await allocations.listBySettlement(userId, settlementId),
  };
}

export async function listSettlements(
  userId: string,
  query: ListSettlementsQuery,
  dependencies: SettlementServiceDependencies = defaultDependencies(),
): Promise<CursorResult<Settlement>> {
  return dependencies.settlements.list(userId, query);
}

/**
 * Builds the allocation targets for the requested splits.
 *
 * For each split it establishes three things:
 *  - which person the obligation involves, and in which direction, from the owning
 *    transaction's `paidBy`
 *  - how much is still outstanding, from the existing allocations
 *  - that it belongs to the requesting user, because every read is user-scoped
 */
async function loadAllocationTargets(
  userId: string,
  splitIds: readonly string[],
  repositories: Pick<SettlementServiceDependencies, "splits" | "transactions" | "allocations">,
  session?: ClientSession,
): Promise<Map<string, AllocationTarget>> {
  const context = session ? { session } : undefined;

  const splits = await repositories.splits.findManyByIds(userId, splitIds, context);
  if (splits.length === 0) return new Map();

  const existingAllocations = await repositories.allocations.listBySplitIds(
    userId,
    splits.map((split) => split.id),
    context,
  );

  // Fetched in one query rather than per split; several splits usually belong to
  // different expenses but a settlement may also target two shares of one.
  const owningTransactions = await repositories.transactions.findManyByIds(
    userId,
    [...new Set(splits.map((split) => split.transactionId))],
    context,
  );
  const transactionsById = new Map(
    owningTransactions.map((transaction) => [transaction.id, transaction] as const),
  );

  const summaries = summariseSplits(splits, existingAllocations);
  const targets = new Map<string, AllocationTarget>();

  for (const split of splits) {
    const transaction = transactionsById.get(split.transactionId);
    if (!transaction) continue;

    // The obligation direction comes from who paid, which lives on the transaction.
    const classification = classifyObligation(transaction, split);
    if (!classification) continue;

    const summary = summaries.get(split.id);
    if (!summary) continue;

    targets.set(split.id, {
      expenseSplitId: split.id,
      direction: classification.direction,
      personId: classification.personId,
      originalAmount: summary.originalAmount,
      remainingAmount: summary.remainingAmount,
    });
  }

  return targets;
}

export { obligationDirectionFor };
