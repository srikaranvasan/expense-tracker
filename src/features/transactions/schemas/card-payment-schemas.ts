import { z } from "zod";
import { LIMITS } from "@/config/constants";
import {
  clientIdString,
  description,
  isoDate,
  objectIdString,
  paginationQuery,
  positiveMoneyString,
  searchTerm,
} from "@/lib/validation/helpers";

/**
 * Credit-card payment request schemas.
 *
 * Structural validation only. Whether the destination really is a card, whether the
 * source is not, and whether either is archived are business rules enforced in
 * `domain/transactions/card-payment-rules.ts`.
 */

const notes = z.string().trim().max(LIMITS.notesMaxLength).nullish();

export const createCardPaymentSchema = z
  .object({
    clientId: clientIdString,
    amount: positiveMoneyString,
    /** Bank or cash account the money comes from. */
    fromAccountId: objectIdString,
    /** The credit card being paid. */
    toAccountId: objectIdString,
    date: isoDate,
    /** Optional: defaults to "Credit card payment". */
    description: description.optional(),
    notes,
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "A card cannot pay itself.",
    path: ["toAccountId"],
  });

export type CreateCardPaymentRequest = z.infer<typeof createCardPaymentSchema>;

export const updateCardPaymentSchema = z
  .object({
    amount: positiveMoneyString.optional(),
    fromAccountId: objectIdString.optional(),
    toAccountId: objectIdString.optional(),
    date: isoDate.optional(),
    description: description.optional(),
    notes,
    expectedSyncVersion: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (value) =>
      value.amount !== undefined ||
      value.fromAccountId !== undefined ||
      value.toAccountId !== undefined ||
      value.date !== undefined ||
      value.description !== undefined ||
      value.notes !== undefined,
    "Provide at least one field to update.",
  )
  .refine(
    (value) =>
      // Only comparable when both sides are supplied. A request changing one side is
      // checked against the stored other side by the service.
      value.fromAccountId === undefined ||
      value.toAccountId === undefined ||
      value.fromAccountId !== value.toAccountId,
    { message: "A card cannot pay itself.", path: ["toAccountId"] },
  );

export type UpdateCardPaymentRequest = z.infer<typeof updateCardPaymentSchema>;

export const listCardPaymentsQuerySchema = paginationQuery.extend({
  accountId: objectIdString.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: searchTerm,
});

export type ListCardPaymentsRequest = z.infer<typeof listCardPaymentsQuerySchema>;

export const cardPaymentIdParamSchema = z.object({ id: objectIdString });
