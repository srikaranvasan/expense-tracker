import { z } from "zod";
import { LIMITS } from "@/config/constants";
import {
  clientIdString,
  currencyCode,
  dayOfMonth,
  entityName,
  nonNegativeMoneyString,
  objectIdString,
  signedMoneyString,
} from "@/lib/validation/helpers";

/**
 * Account request schemas.
 *
 * Schema validation covers structure and basic constraints; the business rules
 * (credit limit required for a card, currency must match the user's) live in
 * `domain/accounts/rules.ts` and run afterwards
 * (docs/06-CODING-PRACTICES.md section 11).
 */

const accountTypeSchema = z.enum(["bank", "cash", "credit_card"]);

export const createAccountSchema = z.object({
  /** Supplied by the client so a retried create is idempotent. */
  clientId: clientIdString,
  name: entityName,
  type: accountTypeSchema,
  currency: currencyCode,
  /** May be negative for an overdrawn bank account. */
  openingBalance: signedMoneyString.default("0"),
  institutionName: z.string().trim().max(LIMITS.nameMaxLength).nullish(),
  /** Credit cards only. */
  creditLimit: nonNegativeMoneyString.nullish(),
  statementDay: dayOfMonth.nullish(),
  paymentDueDay: dayOfMonth.nullish(),
});

export type CreateAccountRequest = z.infer<typeof createAccountSchema>;

/**
 * `type` and `currency` are deliberately not updatable: changing either would
 * reinterpret every amount already recorded against the account.
 */
export const updateAccountSchema = z
  .object({
    name: entityName.optional(),
    openingBalance: signedMoneyString.optional(),
    institutionName: z.string().trim().max(LIMITS.nameMaxLength).nullish(),
    creditLimit: nonNegativeMoneyString.nullish(),
    statementDay: dayOfMonth.nullish(),
    paymentDueDay: dayOfMonth.nullish(),
    expectedSyncVersion: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) => key !== "expectedSyncVersion" && value[key as keyof typeof value] !== undefined,
      ),
    "Provide at least one field to update.",
  );

export type UpdateAccountRequest = z.infer<typeof updateAccountSchema>;

export const listAccountsQuerySchema = z.object({
  type: accountTypeSchema.optional(),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type ListAccountsRequest = z.infer<typeof listAccountsQuerySchema>;

export const accountIdParamSchema = z.object({ id: objectIdString });
