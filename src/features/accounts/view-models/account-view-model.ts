import type { Account } from "@/domain/accounts/entities";
import { ACCOUNT_TYPE_LABELS } from "@/domain/accounts/entities";
import type { AccountBalanceSummary } from "@/domain/accounts/calculations";
import { formatMoney } from "@/lib/money";
import type { MoneyDto } from "@/types/common";
import type { AccountType } from "@/types/common";

/**
 * API and UI representation of an account.
 *
 * Database documents are never returned directly; the contract is designed
 * (docs/05-FOLDER-STRUCTURE.md section 16). Amounts appear both as exact decimal
 * strings, for any further calculation, and pre-formatted for display.
 */
export type AccountView = {
  id: string;
  clientId: string;
  name: string;
  type: AccountType;
  typeLabel: string;
  currency: string;
  institutionName: string | null;
  openingBalance: MoneyDto;
  /** Signed value: positive for money held, negative for a card liability. */
  balance: MoneyDto;
  formattedBalance: string;
  /** Credit cards only. */
  outstanding: MoneyDto | null;
  formattedOutstanding: string | null;
  creditLimit: MoneyDto | null;
  availableCredit: MoneyDto | null;
  formattedAvailableCredit: string | null;
  overLimit: boolean;
  statementDay: number | null;
  paymentDueDay: number | null;
  isArchived: boolean;
  syncVersion: number;
  updatedAt: string;
};

export function toAccountView(account: Account, summary: AccountBalanceSummary): AccountView {
  return {
    id: account.id,
    clientId: account.clientId,
    name: account.name,
    type: account.type,
    typeLabel: ACCOUNT_TYPE_LABELS[account.type],
    currency: account.currency,
    institutionName: account.institutionName,
    openingBalance: account.openingBalance.toJSON(),
    balance: summary.balance.toJSON(),
    formattedBalance: formatMoney(summary.balance),
    outstanding: summary.outstanding?.toJSON() ?? null,
    formattedOutstanding: summary.outstanding ? formatMoney(summary.outstanding) : null,
    creditLimit: summary.creditLimit?.toJSON() ?? null,
    availableCredit: summary.availableCredit?.toJSON() ?? null,
    formattedAvailableCredit: summary.availableCredit ? formatMoney(summary.availableCredit) : null,
    overLimit: summary.overLimit,
    statementDay: account.creditCard?.statementDay ?? null,
    paymentDueDay: account.creditCard?.paymentDueDay ?? null,
    isArchived: account.archivedAt !== null,
    syncVersion: account.syncVersion,
    updatedAt: account.updatedAt.toISOString(),
  };
}

/** Lightweight option shape for account pickers. */
export type AccountOption = {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  formattedBalance: string;
  /**
   * Amount owed, as an exact decimal string. Credit cards only.
   *
   * Carried on the option so the card-payment form can suggest "pay the full balance"
   * and warn about an overpayment without a second round trip. A string, not a number,
   * because the value is money (docs/06-CODING-PRACTICES.md section 55).
   */
  outstanding: string | null;
  formattedOutstanding: string | null;
};

export function toAccountOption(account: Account, summary: AccountBalanceSummary): AccountOption {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    formattedBalance: formatMoney(summary.balance),
    outstanding: summary.outstanding?.amount.toFixed() ?? null,
    formattedOutstanding: summary.outstanding ? formatMoney(summary.outstanding) : null,
  };
}
