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
 * Transfer request schemas.
 *
 * Structural validation only. Whether the two accounts may be paired - not the same
 * account, not archived, same currency, destination not a credit card - is a business
 * rule enforced in `domain/transactions/transfer-rules.ts`.
 *
 * The one exception is the same-account check, which is duplicated here so the form
 * can point at the offending field instead of showing a generic error banner. The
 * server still enforces it: a client check is a convenience, never the guarantee
 * (docs/06-CODING-PRACTICES.md section 12).
 */

const notes = z.string().trim().max(LIMITS.notesMaxLength).nullish();

export const createTransferSchema = z
  .object({
    clientId: clientIdString,
    amount: positiveMoneyString,
    fromAccountId: objectIdString,
    toAccountId: objectIdString,
    date: isoDate,
    /** Optional: "Transfer" is a complete description for a transfer. */
    description: description.optional(),
    notes,
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "Choose two different accounts.",
    path: ["toAccountId"],
  });

export type CreateTransferRequest = z.infer<typeof createTransferSchema>;

export const updateTransferSchema = z
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
      // Only comparable when the request supplies both. A request that changes one
      // side is checked against the stored other side by the service.
      value.fromAccountId === undefined ||
      value.toAccountId === undefined ||
      value.fromAccountId !== value.toAccountId,
    { message: "Choose two different accounts.", path: ["toAccountId"] },
  );

export type UpdateTransferRequest = z.infer<typeof updateTransferSchema>;

export const listTransfersQuerySchema = paginationQuery.extend({
  accountId: objectIdString.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: searchTerm,
});

export type ListTransfersRequest = z.infer<typeof listTransfersQuerySchema>;

export const transferIdParamSchema = z.object({ id: objectIdString });
