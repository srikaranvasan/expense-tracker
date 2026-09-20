import { Decimal, toDecimal } from "./decimal";
import type { DecimalLike } from "./decimal";
import { Money, assertSameCurrency } from "./money";

/**
 * Decimal-safe monetary arithmetic.
 *
 * All financial calculations in the application funnel through these helpers so
 * arithmetic is never scattered as raw `+`/`*` on numbers
 * (docs/05-FOLDER-STRUCTURE.md section 14).
 */

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return Money.unsafeFrom(left.amount.plus(right.amount), left.currency);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return Money.unsafeFrom(left.amount.minus(right.amount), left.currency);
}

export function multiplyMoney(value: Money, factor: DecimalLike): Money {
  return Money.unsafeFrom(value.amount.times(toDecimal(factor)), value.currency);
}

export function divideMoney(value: Money, divisor: DecimalLike): Money {
  const d = toDecimal(divisor);
  if (d.isZero()) throw new Error("Cannot divide a monetary amount by zero.");
  return Money.unsafeFrom(value.amount.dividedBy(d), value.currency);
}

/** Unrounded percentage of an amount. Round explicitly when persisting. */
export function percentageOf(value: Money, percentage: DecimalLike): Money {
  const pct = toDecimal(percentage);
  return Money.unsafeFrom(value.amount.times(pct).dividedBy(100), value.currency);
}

/** Returns -1, 0 or 1. Throws when currencies differ. */
export function compareMoney(left: Money, right: Money): -1 | 0 | 1 {
  assertSameCurrency(left, right);
  return left.amount.comparedTo(right.amount) as -1 | 0 | 1;
}

export function isZeroMoney(value: Money): boolean {
  return value.isZero();
}

export function isPositiveMoney(value: Money): boolean {
  return value.isPositive();
}

export function isNegativeMoney(value: Money): boolean {
  return value.isNegative();
}

export function moneyGreaterThan(left: Money, right: Money): boolean {
  return compareMoney(left, right) === 1;
}

export function moneyGreaterThanOrEqual(left: Money, right: Money): boolean {
  return compareMoney(left, right) >= 0;
}

export function moneyLessThan(left: Money, right: Money): boolean {
  return compareMoney(left, right) === -1;
}

export function moneyLessThanOrEqual(left: Money, right: Money): boolean {
  return compareMoney(left, right) <= 0;
}

export function minMoney(left: Money, right: Money): Money {
  return moneyLessThanOrEqual(left, right) ? left : right;
}

export function maxMoney(left: Money, right: Money): Money {
  return moneyGreaterThanOrEqual(left, right) ? left : right;
}

/**
 * Sums a list of amounts.
 *
 * `currency` is required so an empty list still yields a well-typed zero rather
 * than an ambiguous value.
 */
export function sumMoney(values: readonly Money[], currency: string): Money {
  return values.reduce((total, value) => addMoney(total, value), Money.zero(currency));
}

/** Clamps at zero. Used for "remaining" values that must never go negative. */
export function clampNonNegative(value: Money): Money {
  return value.isNegative() ? Money.zero(value.currency) : value;
}

export { Decimal };
