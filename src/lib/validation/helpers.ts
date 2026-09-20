import { z } from "zod";
import { LIMITS, PAGINATION, SUPPORTED_CURRENCIES } from "@/config/constants";
import { Decimal, isDecimalLike, toDecimal } from "@/lib/money";

/**
 * Reusable Zod primitives.
 *
 * Runtime validation is mandatory at every boundary because TypeScript cannot
 * check data arriving from HTTP, MongoDB or IndexedDB
 * (docs/06-CODING-PRACTICES.md section 10).
 */

/** 24-character hexadecimal MongoDB ObjectId. */
export const objectIdString = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid id.");

/** Stable client-generated identifier for offline-created records. */
export const clientIdString = z
  .string()
  .trim()
  .min(8, "clientId is too short.")
  .max(64, "clientId is too long.")
  .regex(/^[A-Za-z0-9_-]+$/, "clientId may only contain letters, digits, '-' and '_'.");

export const operationIdString = clientIdString;

const maxAmount = new Decimal(LIMITS.maxTransactionAmount);

/**
 * A monetary amount transported as a decimal string.
 *
 * Numbers are accepted for convenience but immediately normalised to a string so
 * no float ever becomes the authoritative value.
 */
export const moneyString = z
  .union([z.string(), z.number()])
  .superRefine((value, ctx) => {
    if (!isDecimalLike(value)) {
      ctx.addIssue({ code: "custom", message: "Must be a valid decimal amount." });
      return;
    }
    const decimal = toDecimal(value);
    if (!decimal.isFinite()) {
      ctx.addIssue({ code: "custom", message: "Amount must be a finite number." });
      return;
    }
    if (decimal.abs().greaterThan(maxAmount)) {
      ctx.addIssue({
        code: "custom",
        message: `Amount must not exceed ${LIMITS.maxTransactionAmount}.`,
      });
    }
    if (decimal.decimalPlaces() > 6) {
      ctx.addIssue({ code: "custom", message: "Amount has too many decimal places." });
    }
  })
  .transform((value) => toDecimal(value).toFixed());

/** A monetary amount that must be strictly greater than zero. */
export const positiveMoneyString = moneyString.refine(
  (value) => toDecimal(value).greaterThan(0),
  "Amount must be greater than zero.",
);

/** A monetary amount that may be zero but not negative. */
export const nonNegativeMoneyString = moneyString.refine(
  (value) => !toDecimal(value).isNegative(),
  "Amount must not be negative.",
);

/** Opening balances may be negative (e.g. an overdrawn account). */
export const signedMoneyString = moneyString;

export const percentageString = moneyString.superRefine((value, ctx) => {
  const decimal = toDecimal(value);
  if (decimal.isNegative()) {
    ctx.addIssue({ code: "custom", message: "Percentage must not be negative." });
  }
  if (decimal.greaterThan(100)) {
    ctx.addIssue({ code: "custom", message: "Percentage must not exceed 100." });
  }
});

export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => SUPPORTED_CURRENCIES.includes(value), "Unsupported currency.");

/** Accepts an ISO-8601 string or a Date and yields a Date. */
export const isoDate = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Must be a valid date." });
      return z.NEVER;
    }
    return parsed;
  })
  .refine((date) => {
    const year = date.getUTCFullYear();
    return year >= 1970 && year <= 2200;
  }, "Date is out of the supported range.");

export const entityName = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(LIMITS.nameMaxLength, `Name must be at most ${LIMITS.nameMaxLength} characters.`);

export const description = z
  .string()
  .trim()
  .max(
    LIMITS.descriptionMaxLength,
    `Description must be at most ${LIMITS.descriptionMaxLength} characters.`,
  );

export const optionalNotes = z
  .string()
  .trim()
  .max(LIMITS.notesMaxLength, `Notes must be at most ${LIMITS.notesMaxLength} characters.`)
  .optional();

export const emailAddress = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.emailMaxLength)
  .email("Must be a valid email address.");

export const password = z
  .string()
  .min(
    LIMITS.passwordMinLength,
    `Password must be at least ${LIMITS.passwordMinLength} characters.`,
  )
  .max(LIMITS.passwordMaxLength, "Password is too long.");

export const searchTerm = z.string().trim().max(LIMITS.searchMaxLength).optional();

/** Cursor-based pagination, capped server-side. */
export const paginationQuery = z.object({
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
});

export const dayOfMonth = z.coerce
  .number()
  .int()
  .min(LIMITS.statementDayMin)
  .max(LIMITS.statementDayMax);

/**
 * Parses `URLSearchParams` with a Zod object schema.
 *
 * Repeated keys collapse to an array so `?type=a&type=b` still validates.
 */
export function searchParamsToObject(params: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }

  return result;
}
