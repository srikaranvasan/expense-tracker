import { z } from "zod";
import { LIMITS, PAGINATION } from "@/config/constants";
import {
  clientIdString,
  description,
  isoDate,
  objectIdString,
  positiveMoneyString,
  searchTerm,
} from "@/lib/validation/helpers";

/**
 * Expense request schemas.
 *
 * Structural validation only. Whether the account may be used, whether the category
 * belongs to the user, and whether a settled expense may change are business rules
 * enforced in `server/services/transactions/expense-service.ts`.
 */

export const createPersonalExpenseSchema = z.object({
  clientId: clientIdString,
  /** Client id for the user's own split, so a retried create reuses it. */
  splitClientId: clientIdString.optional(),
  amount: positiveMoneyString,
  description,
  date: isoDate,
  /** Required: the user paid, so the money left one of their accounts. */
  accountId: objectIdString,
  categoryId: objectIdString.nullish(),
  notes: z.string().trim().max(LIMITS.notesMaxLength).nullish(),
});

export type CreatePersonalExpenseRequest = z.infer<typeof createPersonalExpenseSchema>;

export const updatePersonalExpenseSchema = z
  .object({
    amount: positiveMoneyString.optional(),
    description: description.optional(),
    date: isoDate.optional(),
    accountId: objectIdString.optional(),
    categoryId: objectIdString.nullish(),
    notes: z.string().trim().max(LIMITS.notesMaxLength).nullish(),
    expectedSyncVersion: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (value) =>
      value.amount !== undefined ||
      value.description !== undefined ||
      value.date !== undefined ||
      value.accountId !== undefined ||
      value.categoryId !== undefined ||
      value.notes !== undefined,
    "Provide at least one field to update.",
  );

export type UpdatePersonalExpenseRequest = z.infer<typeof updatePersonalExpenseSchema>;

const transactionTypeSchema = z.enum(["expense", "income", "transfer", "credit_card_payment"]);

/** Accepts a single value or a repeated query parameter. */
const typeFilter = z
  .union([transactionTypeSchema, z.array(transactionTypeSchema)])
  .optional()
  .transform((value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]));

export const listExpensesQuerySchema = z.object({
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
  type: typeFilter,
  accountId: objectIdString.optional(),
  categoryId: objectIdString.optional(),
  personId: objectIdString.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: searchTerm,
  /** "true" = shared expenses only, "false" = personal only. */
  shared: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

export type ListExpensesRequest = z.infer<typeof listExpensesQuerySchema>;

export const expenseIdParamSchema = z.object({ id: objectIdString });
