import type { Decimal128, ObjectId } from "mongodb";
import type { Account } from "@/domain/accounts/entities";
import type { AccountType } from "@/types/common";
import { fromDecimal128, optionalFromDecimal128 } from "../decimal128";
import { fromObjectId } from "../object-id";

export type AccountDocument = {
  _id: ObjectId;
  userId: ObjectId;
  /** Stable client-generated id; unique per user. */
  clientId: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: Decimal128;
  institutionName?: string | null;
  /** Only credit cards carry these terms. */
  creditLimit?: Decimal128 | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
};

export function toAccountEntity(document: AccountDocument): Account {
  const currency = document.currency;
  const creditLimit = optionalFromDecimal128(document.creditLimit, currency);

  return {
    id: fromObjectId(document._id),
    userId: fromObjectId(document.userId),
    clientId: document.clientId,
    name: document.name,
    type: document.type,
    currency,
    openingBalance: fromDecimal128(document.openingBalance, currency),
    institutionName: document.institutionName ?? null,
    creditCard:
      document.type === "credit_card" && creditLimit
        ? {
            creditLimit,
            statementDay: document.statementDay ?? null,
            paymentDueDay: document.paymentDueDay ?? null,
          }
        : null,
    archivedAt: document.archivedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    syncVersion: document.syncVersion,
  };
}
