import type { Account } from "@/domain/accounts/entities";
import {
  assertAccountCurrencyMatches,
  assertAccountIsCreditCard,
  assertAccountIsNotCreditCard,
  assertAccountUsable,
} from "@/domain/accounts/rules";
import { InvalidCreditCardPaymentError } from "@/domain/shared/errors";
import { assertPositiveAmount, assertRoundedToCurrency } from "@/domain/shared/invariants";
import type { Money } from "@/lib/money";

/**
 * Business rules for paying down a credit card.
 *
 * A card payment is not spending. The spending happened when the card was used; the
 * payment settles the liability that purchase created. Counting it again would
 * double-count every card purchase (docs/09-DATABASE-SCHEMA.md section 36).
 * `isSpending()` already excludes the type.
 *
 * This is the mirror image of `transfer-rules.ts`: there the destination must *not*
 * be a card, here it must be.
 */

export function assertValidCardPaymentAmount(amount: Money): void {
  assertPositiveAmount(amount, "Payment amount");
  assertRoundedToCurrency(amount, "Payment amount");
}

/**
 * Validates the source and destination of a card payment.
 *
 * The destination must be a credit card and the source must not be. A card cannot
 * pay a card: no liability is discharged by moving one debt onto another, and
 * recording it would reduce one card's outstanding balance without any money having
 * been paid to anyone. A balance transfer between cards is a real product, but it is
 * a different event and is out of MVP scope.
 */
export function assertValidCardPaymentAccounts(from: Account, to: Account, amount: Money): void {
  if (from.id === to.id) {
    throw new InvalidCreditCardPaymentError("A card cannot pay itself.", { accountId: from.id });
  }

  assertAccountUsable(from, "this payment");
  assertAccountUsable(to, "this payment");

  assertAccountIsCreditCard(to);
  assertAccountIsNotCreditCard(from, "cannot be used to pay another card");

  if (from.currency !== to.currency) {
    throw new InvalidCreditCardPaymentError(
      "The account and the card must use the same currency.",
      { fromCurrency: from.currency, toCurrency: to.currency },
    );
  }

  assertAccountCurrencyMatches(from, amount);
  assertAccountCurrencyMatches(to, amount);
}

/** Default description when the user does not supply one. */
export const DEFAULT_CARD_PAYMENT_DESCRIPTION = "Credit card payment";

/**
 * Whether a payment exceeds what is currently owed.
 *
 * Overpaying is **allowed**, not blocked. It happens legitimately - a refund lands
 * after the payment was scheduled, or the user rounds up - and the result is a credit
 * balance on the card, which `calculateCreditCardOutstanding()` already represents as
 * a negative outstanding amount.
 *
 * Rejecting it would be worse than permitting it: the user genuinely paid that money,
 * and refusing to record it would make the bank statement and the app disagree. This
 * predicate exists so the UI can *warn* before submitting
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md - inform, do not obstruct).
 */
export function isOverpayment(amount: Money, outstanding: Money): boolean {
  return amount.amount.greaterThan(outstanding.amount);
}
