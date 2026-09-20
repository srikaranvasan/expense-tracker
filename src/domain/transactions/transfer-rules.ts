import type { Account } from "@/domain/accounts/entities";
import { assertAccountCurrencyMatches, assertAccountUsable } from "@/domain/accounts/rules";
import { InvalidTransferError } from "@/domain/shared/errors";
import { assertPositiveAmount, assertRoundedToCurrency } from "@/domain/shared/invariants";
import type { Money } from "@/lib/money";

/**
 * Business rules for transfers between the user's own accounts.
 *
 * A transfer is not spending: nothing was consumed, the money simply moved
 * (docs/09-DATABASE-SCHEMA.md section 36). `isSpending()` already excludes it, so the
 * rules here are only about which movements are meaningful.
 */

export function assertValidTransferAmount(amount: Money): void {
  assertPositiveAmount(amount, "Transfer amount");
  assertRoundedToCurrency(amount, "Transfer amount");
}

/**
 * Validates the source and destination.
 *
 * Three things must hold, and the third is the interesting one.
 */
export function assertValidTransferAccounts(from: Account, to: Account, amount: Money): void {
  if (from.id === to.id) {
    throw new InvalidTransferError("Choose two different accounts.", {
      accountId: from.id,
    });
  }

  assertAccountUsable(from, "this transfer");
  assertAccountUsable(to, "this transfer");

  // Compared to each other before either is compared to the amount. A transfer
  // across currencies needs an exchange rate to mean anything, and that is out of
  // MVP scope - saying so plainly is more useful than complaining that the amount
  // does not match the destination.
  if (from.currency !== to.currency) {
    throw new InvalidTransferError("Both accounts must use the same currency for a transfer.", {
      fromCurrency: from.currency,
      toCurrency: to.currency,
    });
  }

  // One amount leaves the source and the identical amount arrives at the
  // destination, so both sides must be able to hold it.
  assertAccountCurrencyMatches(from, amount);
  assertAccountCurrencyMatches(to, amount);

  assertDestinationIsNotCreditCard(to);
}

/**
 * Money moving into a credit card is a card payment, not a transfer.
 *
 * The two are different business events and must stay separate
 * (docs/00-README.md, Non-Negotiable Accounting Principle). Allowing both to express
 * "bank to card" would give the user two ways to record one thing, and a card's
 * outstanding balance would be reduced by records that mean different things.
 *
 * Moving money *off* a card is a genuine transfer - a cash advance - so only the
 * destination is restricted.
 */
export function assertDestinationIsNotCreditCard(to: Account): void {
  if (to.type === "credit_card") {
    throw new InvalidTransferError(
      `Paying "${to.name}" is a credit-card payment, not a transfer. Record it as a card payment instead.`,
      { accountId: to.id, accountType: to.type },
    );
  }
}

/** Default description when the user does not supply one. */
export const DEFAULT_TRANSFER_DESCRIPTION = "Transfer";
