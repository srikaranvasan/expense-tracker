import type { Account } from "@/domain/accounts/entities";
import type { Category } from "@/domain/categories/entities";
import type { Person } from "@/domain/people/entities";
import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";
import { money } from "@/lib/money";
import type { Money } from "@/lib/money";
import type { MoneyDto } from "@/types/common";
import type {
  LocalAccount,
  LocalCategory,
  LocalExpenseSplit,
  LocalPerson,
  LocalRecordMeta,
  LocalSettlement,
  LocalSettlementAllocation,
  LocalTransaction,
} from "./schema";

/**
 * Conversion between domain entities and stored local records.
 *
 * This is the only place `Money` becomes a plain `{ amount, currency }` and back.
 * Keeping it in one file means a stored record can never accidentally hold a class
 * instance - structured clone would strip its prototype and every method call on the
 * way back out would fail.
 *
 * These functions are pure, so they are unit-testable without a browser.
 */

export function toMoneyDto(value: Money): MoneyDto {
  return value.toJSON();
}

export function fromMoneyDto(value: MoneyDto): Money {
  return money(value.amount, value.currency);
}

export function fromNullableMoneyDto(value: MoneyDto | null): Money | null {
  return value ? fromMoneyDto(value) : null;
}

/**
 * Sync metadata for a record that came **from the server**, so it is by definition
 * synced.
 */
function syncedMeta(
  entity: { id: string; clientId: string; userId: string; updatedAt: Date; syncVersion: number },
  deletedAt: Date | null,
): LocalRecordMeta {
  return {
    clientId: entity.clientId,
    serverId: entity.id,
    userId: entity.userId,
    syncStatus: "synced",
    serverUpdatedAt: entity.updatedAt,
    localUpdatedAt: entity.updatedAt,
    syncVersion: entity.syncVersion,
    deletedAt,
  };
}

export function toLocalAccount(account: Account): LocalAccount {
  return {
    ...syncedMeta(account, null),
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalance: toMoneyDto(account.openingBalance),
    institutionName: account.institutionName,
    creditLimit: account.creditCard ? toMoneyDto(account.creditCard.creditLimit) : null,
    statementDay: account.creditCard?.statementDay ?? null,
    paymentDueDay: account.creditCard?.paymentDueDay ?? null,
    archivedAt: account.archivedAt,
  };
}

/**
 * Rebuilds an `Account` from a local record.
 *
 * Returns null when the record has no `serverId`, because a domain `Account` requires
 * an id. An account created offline is not usable as a domain entity until the server
 * has accepted it - which is fine, since accounts are created online in the MVP.
 */
export function fromLocalAccount(record: LocalAccount): Account | null {
  if (!record.serverId) return null;

  return {
    id: record.serverId,
    clientId: record.clientId,
    userId: record.userId,
    name: record.name,
    type: record.type,
    currency: record.currency,
    openingBalance: fromMoneyDto(record.openingBalance),
    institutionName: record.institutionName,
    creditCard: record.creditLimit
      ? {
          creditLimit: fromMoneyDto(record.creditLimit),
          statementDay: record.statementDay,
          paymentDueDay: record.paymentDueDay,
        }
      : null,
    archivedAt: record.archivedAt,
    createdAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    updatedAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    syncVersion: record.syncVersion ?? 1,
  };
}

export function toLocalPerson(person: Person): LocalPerson {
  return {
    ...syncedMeta(person, null),
    name: person.name,
    notes: person.notes,
    archivedAt: person.archivedAt,
  };
}

export function fromLocalPerson(record: LocalPerson): Person | null {
  if (!record.serverId) return null;

  return {
    id: record.serverId,
    clientId: record.clientId,
    userId: record.userId,
    name: record.name,
    notes: record.notes,
    archivedAt: record.archivedAt,
    createdAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    updatedAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    syncVersion: record.syncVersion ?? 1,
  };
}

export function toLocalCategory(category: Category): LocalCategory {
  return {
    ...syncedMeta(category, null),
    name: category.name,
    icon: category.icon,
    parentId: category.parentId,
    kind: category.kind,
    archivedAt: category.archivedAt,
  };
}

export function fromLocalCategory(record: LocalCategory): Category | null {
  if (!record.serverId) return null;

  return {
    id: record.serverId,
    clientId: record.clientId,
    userId: record.userId,
    name: record.name,
    icon: record.icon,
    parentId: record.parentId,
    kind: record.kind,
    archivedAt: record.archivedAt,
    createdAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    updatedAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    syncVersion: record.syncVersion ?? 1,
  };
}

export function toLocalTransaction(transaction: Transaction): LocalTransaction {
  return {
    ...syncedMeta(transaction, transaction.deletedAt),
    type: transaction.type,
    amount: toMoneyDto(transaction.amount),
    description: transaction.description,
    date: transaction.date,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    fromAccountId: transaction.fromAccountId,
    toAccountId: transaction.toAccountId,
    paidByType: transaction.paidBy?.type ?? null,
    paidByPersonId: transaction.paidBy?.personId ?? null,
    notes: transaction.notes,
  };
}

export function fromLocalTransaction(record: LocalTransaction): Transaction | null {
  if (!record.serverId) return null;

  return {
    id: record.serverId,
    clientId: record.clientId,
    userId: record.userId,
    type: record.type,
    amount: fromMoneyDto(record.amount),
    description: record.description,
    date: record.date,
    categoryId: record.categoryId,
    accountId: record.accountId,
    fromAccountId: record.fromAccountId,
    toAccountId: record.toAccountId,
    paidBy: toPaidBy(record),
    notes: record.notes,
    deletedAt: record.deletedAt,
    createdAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    updatedAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    syncVersion: record.syncVersion ?? 1,
  };
}

function toPaidBy(record: LocalTransaction): Transaction["paidBy"] {
  if (record.paidByType === null) return null;
  return record.paidByType === "person" && record.paidByPersonId !== null
    ? { type: "person", personId: record.paidByPersonId }
    : { type: "user", personId: null };
}

export function toLocalExpenseSplit(
  split: ExpenseSplit,
  /** The owning transaction's `clientId`, which the split entity does not carry. */
  transactionClientId: string,
): LocalExpenseSplit {
  return {
    ...syncedMeta(split, split.deletedAt),
    transactionClientId,
    transactionId: split.transactionId,
    participantType: split.participantType,
    personId: split.personId,
    shareAmount: toMoneyDto(split.shareAmount),
  };
}

export function fromLocalExpenseSplit(record: LocalExpenseSplit): ExpenseSplit | null {
  if (!record.serverId || !record.transactionId) return null;

  return {
    id: record.serverId,
    clientId: record.clientId,
    userId: record.userId,
    transactionId: record.transactionId,
    participantType: record.participantType,
    personId: record.personId,
    shareAmount: fromMoneyDto(record.shareAmount),
    deletedAt: record.deletedAt,
    createdAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    updatedAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    syncVersion: record.syncVersion ?? 1,
  };
}

export function toLocalSettlement(settlement: Settlement): LocalSettlement {
  return {
    ...syncedMeta(settlement, settlement.deletedAt),
    personId: settlement.personId,
    direction: settlement.direction,
    amount: toMoneyDto(settlement.amount),
    accountId: settlement.accountId,
    date: settlement.date,
    notes: settlement.notes,
  };
}

export function fromLocalSettlement(record: LocalSettlement): Settlement | null {
  if (!record.serverId) return null;

  return {
    id: record.serverId,
    clientId: record.clientId,
    userId: record.userId,
    personId: record.personId,
    direction: record.direction,
    amount: fromMoneyDto(record.amount),
    accountId: record.accountId,
    date: record.date,
    notes: record.notes,
    deletedAt: record.deletedAt,
    createdAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    updatedAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    syncVersion: record.syncVersion ?? 1,
  };
}

export function toLocalSettlementAllocation(
  allocation: SettlementAllocation,
  settlementClientId: string,
): LocalSettlementAllocation {
  return {
    ...syncedMeta(allocation, allocation.deletedAt),
    settlementClientId,
    settlementId: allocation.settlementId,
    expenseSplitId: allocation.expenseSplitId,
    amount: toMoneyDto(allocation.amount),
  };
}

export function fromLocalSettlementAllocation(
  record: LocalSettlementAllocation,
): SettlementAllocation | null {
  if (!record.serverId || !record.settlementId) return null;

  return {
    id: record.serverId,
    clientId: record.clientId,
    userId: record.userId,
    settlementId: record.settlementId,
    expenseSplitId: record.expenseSplitId,
    amount: fromMoneyDto(record.amount),
    deletedAt: record.deletedAt,
    createdAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    updatedAt: record.serverUpdatedAt ?? record.localUpdatedAt,
    syncVersion: record.syncVersion ?? 1,
  };
}

/**
 * Metadata for a record created **locally**, which has not reached the server.
 *
 * Exported because every offline create path needs it and each rebuilding it
 * separately is how `syncStatus` ends up inconsistent.
 */
export function pendingMeta(options: {
  clientId: string;
  userId: string;
  now?: Date;
}): LocalRecordMeta {
  return {
    clientId: options.clientId,
    serverId: null,
    userId: options.userId,
    syncStatus: "pending",
    serverUpdatedAt: null,
    localUpdatedAt: options.now ?? new Date(),
    syncVersion: null,
    deletedAt: null,
  };
}
