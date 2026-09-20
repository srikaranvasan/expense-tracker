import { LIMITS } from "@/config/constants";
import type { Money } from "@/lib/money";
import { InvalidAccountError } from "@/domain/shared/errors";
import {
  assertAmountWithinLimits,
  assertNonNegativeAmount,
  assertRoundedToCurrency,
} from "@/domain/shared/invariants";
import type { AccountType } from "@/types/common";
import type { Account } from "./entities";

/**
 * Business rules for accounts.
 *
 * These run server-side on every write, independently of whatever the form
 * already checked (docs/06-CODING-PRACTICES.md section 12).
 */

export type AccountDraft = {
  type: AccountType;
  currency: string;
  openingBalance: Money;
  creditLimit?: Money | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
};

/** Validates a new or edited account. */
export function assertValidAccountDraft(draft: AccountDraft, userCurrency: string): void {
  if (draft.currency !== userCurrency) {
    // Multi-currency conversion is out of MVP scope; allowing a second currency
    // would silently produce sums that cannot be added together.
    throw new InvalidAccountError(`Accounts must use your currency (${userCurrency}) for now.`, {
      currency: draft.currency,
      userCurrency,
    });
  }

  if (draft.openingBalance.currency !== draft.currency) {
    throw new InvalidAccountError("The opening balance must be in the account's currency.");
  }

  assertAmountWithinLimits(draft.openingBalance, "Opening balance");
  assertRoundedToCurrency(draft.openingBalance, "Opening balance");

  if (draft.type === "credit_card") {
    assertValidCreditCardTerms(draft);
    return;
  }

  // Card-only fields on a non-card account are a client bug worth surfacing
  // rather than quietly discarding.
  if (draft.creditLimit) {
    throw new InvalidAccountError("Only credit-card accounts have a credit limit.");
  }
  if (draft.statementDay != null || draft.paymentDueDay != null) {
    throw new InvalidAccountError(
      "Only credit-card accounts have a statement day or payment due day.",
    );
  }

  // A negative opening balance is legitimate for a bank account (overdraft), so
  // no sign check here.
}

function assertValidCreditCardTerms(draft: AccountDraft): void {
  if (!draft.creditLimit) {
    throw new InvalidAccountError("A credit card needs a credit limit.");
  }
  if (draft.creditLimit.currency !== draft.currency) {
    throw new InvalidAccountError("The credit limit must be in the account's currency.");
  }

  assertNonNegativeAmount(draft.creditLimit, "Credit limit");
  assertRoundedToCurrency(draft.creditLimit, "Credit limit");

  if (!draft.creditLimit.isPositive()) {
    throw new InvalidAccountError("The credit limit must be greater than zero.");
  }

  // The opening balance of a card is the amount already outstanding on it.
  assertNonNegativeAmount(draft.openingBalance, "Opening outstanding balance");

  assertValidDayOfMonth(draft.statementDay, "Statement day");
  assertValidDayOfMonth(draft.paymentDueDay, "Payment due day");
}

function assertValidDayOfMonth(day: number | null | undefined, label: string): void {
  if (day == null) return;

  if (!Number.isInteger(day) || day < LIMITS.statementDayMin || day > LIMITS.statementDayMax) {
    throw new InvalidAccountError(
      `${label} must be a day between ${LIMITS.statementDayMin} and ${LIMITS.statementDayMax}.`,
    );
  }
}

/**
 * An archived account may not be used for new transactions.
 *
 * Historical records keep referring to it, which is why it is archived rather
 * than deleted.
 */
export function assertAccountUsable(account: Account, purpose = "this transaction"): void {
  if (account.archivedAt !== null) {
    throw new InvalidAccountError(
      `"${account.name}" is archived and cannot be used for ${purpose}.`,
      { accountId: account.id },
    );
  }
}

export function assertAccountIsCreditCard(account: Account): void {
  if (account.type !== "credit_card") {
    throw new InvalidAccountError(`"${account.name}" is not a credit-card account.`, {
      accountId: account.id,
      type: account.type,
    });
  }
}

export function assertAccountIsNotCreditCard(account: Account, reason: string): void {
  if (account.type === "credit_card") {
    throw new InvalidAccountError(`"${account.name}" is a credit card and ${reason}.`, {
      accountId: account.id,
    });
  }
}

/** Every account referenced by one operation must share a currency. */
export function assertAccountCurrencyMatches(account: Account, amount: Money): void {
  if (account.currency !== amount.currency) {
    throw new InvalidAccountError(
      `"${account.name}" is a ${account.currency} account, so the amount must also be in ${account.currency}.`,
      { accountId: account.id, accountCurrency: account.currency, amountCurrency: amount.currency },
    );
  }
}
