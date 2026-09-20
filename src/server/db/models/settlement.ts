import type { Decimal128, ObjectId } from "mongodb";
import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import type { SettlementDirection } from "@/types/common";
import { fromDecimal128 } from "../decimal128";
import { fromObjectId, optionalFromObjectId } from "../object-id";

export type SettlementDocument = {
  _id: ObjectId;
  userId: ObjectId;
  clientId: string;
  personId: ObjectId;
  direction: SettlementDirection;
  amount: Decimal128;
  currency: string;
  accountId?: ObjectId | null;
  date: Date;
  notes?: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
};

export type SettlementAllocationDocument = {
  _id: ObjectId;
  userId: ObjectId;
  clientId: string;
  settlementId: ObjectId;
  expenseSplitId: ObjectId;
  amount: Decimal128;
  currency: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
};

export function toSettlementEntity(document: SettlementDocument): Settlement {
  return {
    id: fromObjectId(document._id),
    userId: fromObjectId(document.userId),
    clientId: document.clientId,
    personId: fromObjectId(document.personId),
    direction: document.direction,
    amount: fromDecimal128(document.amount, document.currency),
    accountId: optionalFromObjectId(document.accountId),
    date: document.date,
    notes: document.notes ?? null,
    deletedAt: document.deletedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    syncVersion: document.syncVersion,
  };
}

export function toSettlementAllocationEntity(
  document: SettlementAllocationDocument,
): SettlementAllocation {
  return {
    id: fromObjectId(document._id),
    userId: fromObjectId(document.userId),
    clientId: document.clientId,
    settlementId: fromObjectId(document.settlementId),
    expenseSplitId: fromObjectId(document.expenseSplitId),
    amount: fromDecimal128(document.amount, document.currency),
    deletedAt: document.deletedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    syncVersion: document.syncVersion,
  };
}
