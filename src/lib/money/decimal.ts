import { Decimal } from "decimal.js";

/**
 * A single configured Decimal constructor for the whole application.
 *
 * JavaScript's `number` cannot represent arbitrary monetary values exactly, so
 * every authoritative financial calculation goes through this type
 * (docs/06-CODING-PRACTICES.md section 7).
 *
 * `toExpNeg`/`toExpPos` are pushed out so `toString()` never produces
 * exponential notation, which would corrupt values on their way to
 * MongoDB's Decimal128.
 */
const Money128 = Decimal.clone({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -1e9,
  toExpPos: 1e9,
});

export { Money128 as Decimal };
export type DecimalValue = InstanceType<typeof Money128>;

/** Values that can be safely interpreted as a decimal number. */
export type DecimalLike = string | number | DecimalValue;

const DECIMAL_STRING = /^-?(\d+(\.\d*)?|\.\d+)$/;

export class InvalidDecimalError extends Error {
  readonly value: unknown;

  constructor(value: unknown) {
    super(`"${String(value)}" is not a valid decimal number.`);
    this.name = "InvalidDecimalError";
    this.value = value;
  }
}

/**
 * Converts an untrusted value into a Decimal.
 *
 * Numbers are accepted only when they are finite and safe integers or have an
 * exact string representation; strings are preferred at every boundary because
 * they cannot lose precision.
 */
export function toDecimal(value: DecimalLike): DecimalValue {
  if (value instanceof Money128) return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new InvalidDecimalError(value);
    return new Money128(value.toString());
  }

  const trimmed = value.trim();
  if (trimmed === "" || !DECIMAL_STRING.test(trimmed)) {
    throw new InvalidDecimalError(value);
  }

  const decimal = new Money128(trimmed);
  if (!decimal.isFinite()) throw new InvalidDecimalError(value);

  return decimal;
}

/** Returns true when the value can be parsed as a decimal. */
export function isDecimalLike(value: unknown): value is DecimalLike {
  if (value instanceof Money128) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  return DECIMAL_STRING.test(value.trim());
}

/** Plain, non-exponential string form suitable for persistence and transport. */
export function decimalToString(value: DecimalValue): string {
  return value.toFixed();
}
