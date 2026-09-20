import { Decimal128 } from "mongodb";
import { Money, toDecimal } from "@/lib/money";
import { InternalError } from "@/lib/errors";

/**
 * Money <-> Decimal128 conversion.
 *
 * Monetary values are persisted as Decimal128, never as a double, so stored
 * amounts are exact (docs/09-DATABASE-SCHEMA.md section 29). This module is the
 * only place that conversion happens.
 */

export function toDecimal128(value: Money): Decimal128 {
  // Money.toString() is guaranteed to be plain decimal notation; Decimal128
  // cannot parse the exponential form JS numbers produce for large values.
  return Decimal128.fromString(value.toString());
}

export function optionalToDecimal128(value: Money | null | undefined): Decimal128 | null {
  return value ? toDecimal128(value) : null;
}

/**
 * Reads a stored amount back as Money.
 *
 * The currency comes from the owning record rather than from the Decimal128,
 * which carries no currency of its own.
 */
export function fromDecimal128(value: Decimal128 | number | string, currency: string): Money {
  if (typeof value === "number") {
    // A double here means something wrote money without going through this
    // module. Refuse rather than silently accept a lossy value.
    throw new InternalError("A monetary field was stored as a double instead of Decimal128.");
  }

  const raw = typeof value === "string" ? value : value.toString();
  return Money.of(toDecimal(raw), currency);
}

export function optionalFromDecimal128(
  value: Decimal128 | number | string | null | undefined,
  currency: string,
): Money | null {
  if (value === null || value === undefined) return null;
  return fromDecimal128(value, currency);
}

export { Decimal128 };
