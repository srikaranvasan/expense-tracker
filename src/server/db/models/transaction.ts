import type { Decimal128, ObjectId } from "mongodb";
import type { ExpenseSplit, PaidBy, Transaction } from "@/domain/transactions/entities";
import type { ParticipantType, TransactionType } from "@/types/common";
import { fromDecimal128 } from "../decimal128";
import { fromObjectId, optionalFromObjectId } from "../object-id";

export type PaidByEmbedded = {
  type: ParticipantType;
  /** Null when the user paid. */
  personId: ObjectId | null;
};

export type TransactionDocument = {
  _id: ObjectId;
  userId: ObjectId;
  clientId: string;
  type: TransactionType;
  amount: Decimal128;
  currency: string;
  description: string;
  date: Date;
  categoryId?: ObjectId | null;
  accountId?: ObjectId | null;
  fromAccountId?: ObjectId | null;
  toAccountId?: ObjectId | null;
  paidBy?: PaidByEmbedded | null;
  notes?: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
};

export type ExpenseSplitDocument = {
  _id: ObjectId;
  userId: ObjectId;
  clientId: string;
  transactionId: ObjectId;
  participantType: ParticipantType;
  personId?: ObjectId | null;
  shareAmount: Decimal128;
  /** Denormalised from the transaction so a split can be read on its own. */
  currency: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
};

function toPaidBy(embedded: PaidByEmbedded | null | undefined): PaidBy | null {
  if (!embedded) return null;
  if (embedded.type === "person" && embedded.personId) {
    return { type: "person", personId: fromObjectId(embedded.personId) };
  }
  return { type: "user", personId: null };
}

export function toTransactionEntity(document: TransactionDocument): Transaction {
  return {
    id: fromObjectId(document._id),
    userId: fromObjectId(document.userId),
    clientId: document.clientId,
    type: document.type,
    amount: fromDecimal128(document.amount, document.currency),
    description: document.description,
    date: document.date,
    categoryId: optionalFromObjectId(document.categoryId),
    accountId: optionalFromObjectId(document.accountId),
    fromAccountId: optionalFromObjectId(document.fromAccountId),
    toAccountId: optionalFromObjectId(document.toAccountId),
    paidBy: toPaidBy(document.paidBy),
    notes: document.notes ?? null,
    deletedAt: document.deletedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    syncVersion: document.syncVersion,
  };
}

export function toExpenseSplitEntity(document: ExpenseSplitDocument): ExpenseSplit {
  return {
    id: fromObjectId(document._id),
    userId: fromObjectId(document.userId),
    clientId: document.clientId,
    transactionId: fromObjectId(document.transactionId),
    participantType: document.participantType,
    personId: optionalFromObjectId(document.personId),
    shareAmount: fromDecimal128(document.shareAmount, document.currency),
    deletedAt: document.deletedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    syncVersion: document.syncVersion,
  };
}
