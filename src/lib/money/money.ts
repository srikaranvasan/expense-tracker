import { CURRENCY_SCALES, DEFAULT_CURRENCY_SCALE } from "@/config/constants";
import { Decimal, decimalToString, toDecimal } from "./decimal";
import type { DecimalLike, DecimalValue } from "./decimal";

/**
 * An immutable monetary amount tied to a currency.
 *
 * Different parts of the application must not invent their own money
 * representation (docs/06-CODING-PRACTICES.md section 8), so every amount that
 * crosses a layer boundary is a `Money`.
 */
export class Money {
  readonly amount: DecimalValue;
  readonly currency: string;

  private constructor(amount: DecimalValue, currency: string) {
    this.amount = amount;
    this.currency = currency;
    Object.freeze(this);
  }

  static of(value: DecimalLike | Money, currency?: string): Money {
    if (value instanceof Money) {
      if (currency && currency !== value.currency) {
        throw new CurrencyMismatchError(value.currency, currency);
      }
      return value;
    }
    if (!currency) throw new MissingCurrencyError();
    return new Money(toDecimal(value), normalizeCurrency(currency));
  }

  static zero(currency: string): Money {
    return new Money(new Decimal(0), normalizeCurrency(currency));
  }

  /** Scale (number of minor-unit digits) for this money's currency. */
  get scale(): number {
    return currencyScale(this.currency);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isPositive(): boolean {
    return this.amount.greaterThan(0);
  }

  isNegative(): boolean {
    return this.amount.lessThan(0);
  }

  negated(): Money {
    return new Money(this.amount.negated(), this.currency);
  }

  abs(): Money {
    return new Money(this.amount.abs(), this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  /** Exact, non-exponential decimal string, e.g. "1200.5". */
  toString(): string {
    return decimalToString(this.amount);
  }

  /** Decimal string padded to the currency scale, e.g. "1200.50". */
  toFixedString(): string {
    return this.amount.toFixed(this.scale);
  }

  toJSON(): { amount: string; currency: string } {
    return { amount: this.toString(), currency: this.currency };
  }

  /** Internal constructor used by the arithmetic helpers in this module. */
  static unsafeFrom(amount: DecimalValue, currency: string): Money {
    return new Money(amount, currency);
  }
}

export class CurrencyMismatchError extends Error {
  constructor(left: string, right: string) {
    super(`Cannot combine amounts in different currencies: ${left} and ${right}.`);
    this.name = "CurrencyMismatchError";
  }
}

export class MissingCurrencyError extends Error {
  constructor() {
    super("A currency is required to construct a monetary amount.");
    this.name = "MissingCurrencyError";
  }
}

export function normalizeCurrency(currency: string): string {
  const upper = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) {
    throw new Error(`"${currency}" is not a valid 3-letter currency code.`);
  }
  return upper;
}

export function currencyScale(currency: string): number {
  return CURRENCY_SCALES[normalizeCurrency(currency)] ?? DEFAULT_CURRENCY_SCALE;
}

export function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new CurrencyMismatchError(left.currency, right.currency);
  }
}

/** Convenience factory: `money("1200.50", "INR")`. */
export function money(value: DecimalLike, currency: string): Money {
  return Money.of(value, currency);
}
