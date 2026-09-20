import type { Money } from "@/lib/money";
import type { ArchiveMeta, EntityBase, SyncMeta } from "@/domain/shared/entities";
import type { AccountType } from "@/types/common";

/**
 * A financial account: where the user's money or liability sits.
 *
 * `openingBalance` and `creditLimit` are the only persisted monetary facts. The
 * current balance, the card outstanding and the available credit are all derived
 * from transactions (docs/02-DATA-MODEL.md sections 20-21).
 */
export type Account = EntityBase &
  SyncMeta &
  ArchiveMeta & {
    userId: string;
    name: string;
    type: AccountType;
    currency: string;
    openingBalance: Money;
    institutionName: string | null;
    /** Present only for credit-card accounts. */
    creditCard: CreditCardTerms | null;
  };

export type CreditCardTerms = {
  creditLimit: Money;
  /** Day of month the statement is generated, if the user recorded it. */
  statementDay: number | null;
  /** Day of month the payment is due, if the user recorded it. */
  paymentDueDay: number | null;
};

export function isCreditCard(account: Account): boolean {
  return account.type === "credit_card";
}

/** Bank and cash accounts hold money; a credit card holds a liability. */
export function isAssetAccount(account: Account): boolean {
  return account.type === "bank" || account.type === "cash";
}

export function isArchived(account: Account): boolean {
  return account.archivedAt !== null;
}

export const ACCOUNT_TYPES: readonly AccountType[] = ["bank", "cash", "credit_card"];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank",
  cash: "Cash",
  credit_card: "Credit card",
};
