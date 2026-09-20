import { Decimal, toDecimal } from "./decimal";
import type { DecimalLike, DecimalValue } from "./decimal";
import { Money, currencyScale } from "./money";

export type RoundingMode = "half_up" | "half_even" | "down" | "up";

const ROUNDING_MODES = {
  half_up: Decimal.ROUND_HALF_UP,
  half_even: Decimal.ROUND_HALF_EVEN,
  down: Decimal.ROUND_DOWN,
  up: Decimal.ROUND_UP,
} satisfies Record<RoundingMode, number>;

/** Rounds an amount to its currency's minor-unit scale. */
export function roundMoney(value: Money, mode: RoundingMode = "half_up"): Money {
  const rounded = value.amount.toDecimalPlaces(value.scale, ROUNDING_MODES[mode]);
  return Money.unsafeFrom(rounded, value.currency);
}

/** True when the amount has no digits beyond its currency's scale. */
export function isRoundedToCurrency(value: Money): boolean {
  return value.amount.decimalPlaces() <= value.scale;
}

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllocationError";
  }
}

/**
 * Splits an amount across weights so that the parts sum *exactly* to the total.
 *
 * Uses the largest-remainder method on integer minor units. Naive per-part
 * rounding loses or invents money: ₹1000 across 3 people would produce three
 * ₹333.33 shares totalling ₹999.99. Here the leftover minor units are handed to
 * the parts with the largest fractional remainders instead, so the split total
 * always matches the expense total (docs/02-DATA-MODEL.md section 13).
 */
export function allocateMoney(total: Money, weights: readonly DecimalLike[]): Money[] {
  if (weights.length === 0) {
    throw new AllocationError("Cannot allocate an amount across zero participants.");
  }

  const scale = currencyScale(total.currency);
  const factor = new Decimal(10).pow(scale);

  const decimalWeights = weights.map((weight) => toDecimal(weight));
  if (decimalWeights.some((weight) => weight.isNegative())) {
    throw new AllocationError("Allocation weights must not be negative.");
  }

  const weightSum = decimalWeights.reduce((sum, weight) => sum.plus(weight), new Decimal(0));
  if (weightSum.isZero()) {
    throw new AllocationError("Allocation weights must not all be zero.");
  }

  const sign = total.amount.isNegative() ? -1 : 1;
  const totalMinor = total.amount.abs().times(factor).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  type Part = { index: number; base: DecimalValue; remainder: DecimalValue };

  const parts: Part[] = decimalWeights.map((weight, index) => {
    const exact = totalMinor.times(weight).dividedBy(weightSum);
    const base = exact.floor();
    return { index, base, remainder: exact.minus(base) };
  });

  const distributed = parts.reduce((sum, part) => sum.plus(part.base), new Decimal(0));
  let leftover = totalMinor.minus(distributed).toNumber();

  // Largest fractional remainder wins; index order breaks ties deterministically
  // so the same input always produces the same split.
  const byRemainder = [...parts].sort((a, b) => {
    const comparison = b.remainder.comparedTo(a.remainder);
    return comparison !== 0 ? comparison : a.index - b.index;
  });

  let cursor = 0;
  while (leftover > 0 && byRemainder.length > 0) {
    const part = byRemainder[cursor % byRemainder.length]!;
    part.base = part.base.plus(1);
    leftover -= 1;
    cursor += 1;
  }

  return parts.map((part) =>
    Money.unsafeFrom(part.base.dividedBy(factor).times(sign), total.currency),
  );
}

/** Splits an amount into `parts` equal shares that sum exactly to the total. */
export function splitEqually(total: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new AllocationError("The number of parts must be a positive integer.");
  }
  return allocateMoney(total, new Array<number>(parts).fill(1));
}
