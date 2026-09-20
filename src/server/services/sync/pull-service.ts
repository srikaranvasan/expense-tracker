import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Account } from "@/domain/accounts/entities";
import type { Category } from "@/domain/categories/entities";
import type { Person } from "@/domain/people/entities";
import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";
import { accountRepository } from "@/server/repositories/mongo/account-repository";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { personRepository } from "@/server/repositories/mongo/person-repository";
import {
  settlementAllocationRepository,
  settlementRepository,
} from "@/server/repositories/mongo/settlement-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import type { SyncChange, SyncEntityType, SyncPullResponse } from "@/types/sync";

/**
 * Serves changes a client has not seen yet.
 *
 * Ordering is by `(updatedAt, id)` across every entity type, and the cursor encodes
 * that pair. Ordering by `updatedAt` alone would be wrong: several records written in
 * one MongoDB transaction share a timestamp to the millisecond, so a timestamp-only
 * cursor either replays them or skips them. The id breaks the tie
 * (docs/08-OFFLINE-SYNC.md sections 22-23).
 *
 * Every record is returned in full. Sending a diff would require the server to know
 * what the client already has, which it cannot, and a financial record the client
 * reconstructs from partial data is a record nobody can audit.
 */

export type PullCursor = {
  updatedAt: Date;
  entityId: string;
};

/** Base64 so the client treats it as opaque and cannot hand-craft one. */
export function encodePullCursor(cursor: PullCursor): string {
  const raw = `${cursor.updatedAt.toISOString()}|${cursor.entityId}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function decodePullCursor(value: string): PullCursor {
  const raw = Buffer.from(value, "base64url").toString("utf8");
  const separator = raw.lastIndexOf("|");
  const timestamp = separator === -1 ? "" : raw.slice(0, separator);
  const entityId = separator === -1 ? "" : raw.slice(separator + 1);
  const updatedAt = new Date(timestamp);

  if (Number.isNaN(updatedAt.getTime()) || entityId === "") {
    throw new ValidationError("The sync cursor is not valid.", {
      fieldErrors: { cursor: ["Unrecognised cursor."] },
    });
  }

  return { updatedAt, entityId };
}

export type PullOptions = {
  cursor?: string;
  limit: number;
  /** Explicit start point, for a client rebuilding its database from scratch. */
  since?: Date;
};

export async function pullChanges(userId: string, options: PullOptions): Promise<SyncPullResponse> {
  const cursor = options.cursor ? decodePullCursor(options.cursor) : null;
  const since = cursor?.updatedAt ?? options.since ?? null;

  // Each repository is asked for a little more than the page size. Changes are merged
  // and re-sorted afterwards, so one busy entity type cannot crowd the others out of
  // the page entirely.
  const perType = options.limit + 1;
  const query = { since, sinceId: cursor?.entityId ?? null, limit: perType };

  const [accounts, people, categories, transactions, splits, settlements, allocations] =
    await Promise.all([
      accountRepository().changesSince(userId, query),
      personRepository().changesSince(userId, query),
      categoryRepository().changesSince(userId, query),
      transactionRepository().changesSince(userId, query),
      expenseSplitRepository().changesSince(userId, query),
      settlementRepository().changesSince(userId, query),
      settlementAllocationRepository().changesSince(userId, query),
    ]);

  const changes: SyncChange[] = [
    ...accounts.map(accountChange),
    ...people.map(personChange),
    ...categories.map(categoryChange),
    ...transactions.map(transactionChange),
    ...splits.map(splitChange),
    ...settlements.map(settlementChange),
    ...allocations.map(allocationChange),
  ];

  changes.sort(byUpdatedAtThenId);

  // A record whose `updatedAt` and id both match the cursor was already delivered.
  const fresh = cursor ? changes.filter((change) => isAfterCursor(change, cursor)) : changes;

  const page = fresh.slice(0, options.limit);
  const hasMore = fresh.length > options.limit;
  const last = page.at(-1);

  return {
    changes: page,
    // The cursor only advances to what is actually in this page. A client that fails to
    // apply the page keeps its old cursor and receives the same changes again, which is
    // the behaviour that makes a partial apply safe (docs/08-OFFLINE-SYNC.md section 23).
    nextCursor: last
      ? encodePullCursor({ updatedAt: new Date(last.updatedAt), entityId: last.entityId })
      : (options.cursor ?? null),
    hasMore,
    serverTime: new Date().toISOString(),
  };
}

function byUpdatedAtThenId(left: SyncChange, right: SyncChange): number {
  const difference = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
  return difference !== 0 ? difference : left.entityId.localeCompare(right.entityId);
}

function isAfterCursor(change: SyncChange, cursor: PullCursor): boolean {
  const changedAt = Date.parse(change.updatedAt);
  const cursorAt = cursor.updatedAt.getTime();

  if (changedAt !== cursorAt) return changedAt > cursorAt;
  return change.entityId.localeCompare(cursor.entityId) > 0;
}

/**
 * Change envelope shared by every entity type.
 *
 * A deleted record carries no body: the client already has it and only needs to know it
 * is gone. Sending the body again would invite a client to "restore" it
 * (docs/08-OFFLINE-SYNC.md section 30).
 */
function change(
  entityType: SyncEntityType,
  entity: { id: string; clientId: string; syncVersion: number; updatedAt: Date },
  deleted: boolean,
  record: Record<string, unknown>,
): SyncChange {
  return {
    entityType,
    entityId: entity.id,
    clientId: entity.clientId,
    syncVersion: entity.syncVersion,
    updatedAt: entity.updatedAt.toISOString(),
    deleted,
    ...(deleted ? {} : { record }),
  };
}

function accountChange(account: Account): SyncChange {
  return change("account", account, false, {
    name: account.name,
    type: account.type,
    currency: account.currency,
    // Amounts leave as decimal strings, the same shape the client stores.
    openingBalance: account.openingBalance.toJSON(),
    institutionName: account.institutionName,
    creditLimit: account.creditCard?.creditLimit.toJSON() ?? null,
    statementDay: account.creditCard?.statementDay ?? null,
    paymentDueDay: account.creditCard?.paymentDueDay ?? null,
    archivedAt: account.archivedAt?.toISOString() ?? null,
  });
}

function personChange(person: Person): SyncChange {
  return change("person", person, false, {
    name: person.name,
    notes: person.notes,
    archivedAt: person.archivedAt?.toISOString() ?? null,
  });
}

function categoryChange(category: Category): SyncChange {
  return change("category", category, false, {
    name: category.name,
    icon: category.icon,
    parentId: category.parentId,
    kind: category.kind,
    archivedAt: category.archivedAt?.toISOString() ?? null,
  });
}

function transactionChange(transaction: Transaction): SyncChange {
  return change("transaction", transaction, transaction.deletedAt !== null, {
    type: transaction.type,
    amount: transaction.amount.toJSON(),
    description: transaction.description,
    date: transaction.date.toISOString(),
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    fromAccountId: transaction.fromAccountId,
    toAccountId: transaction.toAccountId,
    paidByType: transaction.paidBy?.type ?? null,
    paidByPersonId: transaction.paidBy?.personId ?? null,
    notes: transaction.notes,
  });
}

function splitChange(split: ExpenseSplit): SyncChange {
  return change("expenseSplit", split, split.deletedAt !== null, {
    transactionId: split.transactionId,
    participantType: split.participantType,
    personId: split.personId,
    shareAmount: split.shareAmount.toJSON(),
  });
}

function settlementChange(settlement: Settlement): SyncChange {
  return change("settlement", settlement, settlement.deletedAt !== null, {
    personId: settlement.personId,
    direction: settlement.direction,
    amount: settlement.amount.toJSON(),
    accountId: settlement.accountId,
    date: settlement.date.toISOString(),
    notes: settlement.notes,
  });
}

function allocationChange(allocation: SettlementAllocation): SyncChange {
  return change("settlementAllocation", allocation, allocation.deletedAt !== null, {
    settlementId: allocation.settlementId,
    expenseSplitId: allocation.expenseSplitId,
    amount: allocation.amount.toJSON(),
  });
}

/**
 * The canonical server copy of one record, for resolving a conflict.
 *
 * When a push is rejected as `SYNC_CONFLICT` the client needs to see what the server
 * actually holds before it can ask the user what they meant
 * (docs/08-OFFLINE-SYNC.md section 28).
 */
export async function getCanonicalRecord(
  userId: string,
  entityType: SyncEntityType,
  entityId: string,
): Promise<SyncChange> {
  switch (entityType) {
    case "transaction": {
      const transaction = await transactionRepository().findById(userId, entityId);
      if (!transaction) throw new NotFoundError("Transaction");
      return transactionChange(transaction);
    }
    case "settlement": {
      const settlement = await settlementRepository().findById(userId, entityId);
      if (!settlement) throw new NotFoundError("Settlement");
      return settlementChange(settlement);
    }
    case "account": {
      const account = await accountRepository().findById(userId, entityId);
      if (!account) throw new NotFoundError("Account");
      return accountChange(account);
    }
    case "person": {
      const person = await personRepository().findById(userId, entityId);
      if (!person) throw new NotFoundError("Person");
      return personChange(person);
    }
    case "category": {
      const category = await categoryRepository().findById(userId, entityId);
      if (!category) throw new NotFoundError("Category");
      return categoryChange(category);
    }
    default:
      throw new ValidationError("That record type cannot be fetched individually.", {
        fieldErrors: { entityType: ["Unsupported entity type."] },
      });
  }
}
