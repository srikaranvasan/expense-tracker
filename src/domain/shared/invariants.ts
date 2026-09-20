import { LIMITS } from "@/config/constants";
import type { Money } from "@/lib/money";
import { Decimal, isRoundedToCurrency, toDecimal } from "@/lib/money";
import { InvalidAmountError, InvalidCurrencyError } from "./errors";

/**
 * Assertions for the invariants listed in docs/02-DATA-MODEL.md section 30.
 *
 * These run in the domain layer, which means they run on the server for every
 * write regardless of what the client already validated.
 */

const MAX_AMOUNT = new Decimal(LIMITS.maxTransactionAmount);

/** Financial events must have a strictly positive amount. */
export function assertPositiveAmount(amount: Money, label = "Amount"): void {
  if (!amount.isPositive()) {
    throw new InvalidAmountError(`${label} must be greater than zero.`);
  }
  assertAmountWithinLimits(amount, label);
}

/** Opening balances and adjustments may be zero or negative. */
export function assertAmountWithinLimits(amount: Money, label = "Amount"): void {
  if (!amount.amount.isFinite()) {
    throw new InvalidAmountError(`${label} must be a finite number.`);
  }
  if (amount.amount.abs().greaterThan(MAX_AMOUNT)) {
    throw new InvalidAmountError(
      `${label} must not exceed ${LIMITS.maxTransactionAmount} ${amount.currency}.`,
    );
  }
}

export function assertNonNegativeAmount(amount: Money, label = "Amount"): void {
  if (amount.isNegative()) {
    throw new InvalidAmountError(`${label} must not be negative.`);
  }
  assertAmountWithinLimits(amount, label);
}

/**
 * Rejects amounts with more precision than the currency supports.
 *
 * Silently rounding the user's input would change what they recorded
 * (docs/06-CODING-PRACTICES.md section 55).
 */
export function assertRoundedToCurrency(amount: Money, label = "Amount"): void {
  if (!isRoundedToCurrency(amount)) {
    throw new InvalidAmountError(
      `${label} has more decimal places than ${amount.currency} supports.`,
    );
  }
}

/** Every amount in one financial operation must share a currency. */
export function assertSameCurrencyAll(amounts: readonly Money[], expected?: string): string {
  const currency = expected ?? amounts[0]?.currency;
  if (!currency) throw new InvalidCurrencyError("At least one amount is required.");

  for (const amount of amounts) {
    if (amount.currency !== currency) throw new InvalidCurrencyError();
  }
  return currency;
}

export function assertPercentageInRange(value: string | number, label = "Percentage"): void {
  const decimal = toDecimal(value);
  if (decimal.isNegative() || decimal.greaterThan(100)) {
    throw new InvalidAmountError(`${label} must be between 0 and 100.`);
  }
}

/** Guards array sizes so an oversized payload cannot exhaust the server. */
export function assertWithinCollectionLimit(count: number, max: number, label: string): void {
  if (count > max) {
    throw new InvalidAmountError(`${label} must not contain more than ${max} entries.`);
  }
}
