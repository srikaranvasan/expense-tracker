import { z } from "zod";
import { LIMITS } from "@/config/constants";
import {
  clientIdString,
  description,
  isoDate,
  objectIdString,
  percentageString,
  positiveMoneyString,
} from "@/lib/validation/helpers";

/**
 * Shared expense request schemas.
 *
 * The schema checks shape and per-field ranges. Whether the shares add up, whether
 * the participants are the user's own people, and whether an account is allowed given
 * who paid are all business rules enforced in
 * `server/services/transactions/shared-expense-service.ts`.
 */

const splitMethodSchema = z.enum(["equal", "custom", "percentage"]);

/** `personId: null` means the user. */
const participantSchema = z.object({
  personId: objectIdString.nullable(),
  amount: positiveMoneyString.optional(),
  percentage: percentageString.optional(),
});

const participantsSchema = z
  .array(participantSchema)
  .min(1, "Add at least one participant.")
  .max(
    LIMITS.maxParticipantsPerExpense,
    `An expense can have at most ${LIMITS.maxParticipantsPerExpense} participants.`,
  );

/**
 * Each method requires its own per-participant field, so the check is done here
 * rather than leaving the service to interpret a missing value as zero.
 */
function assertMethodFieldsPresent(
  value: { splitMethod: "equal" | "custom" | "percentage"; participants: unknown[] },
  ctx: z.RefinementCtx,
): void {
  const participants = value.participants as { amount?: string; percentage?: string }[];

  if (value.splitMethod === "custom") {
    participants.forEach((participant, index) => {
      if (participant.amount === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["participants", index, "amount"],
          message: "Enter an amount for every participant.",
        });
      }
    });
  }

  if (value.splitMethod === "percentage") {
    participants.forEach((participant, index) => {
      if (participant.percentage === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["participants", index, "percentage"],
          message: "Enter a percentage for every participant.",
        });
      }
    });
  }
}

export const createSharedExpenseSchema = z
  .object({
    clientId: clientIdString,
    splitClientIds: z.array(clientIdString).optional(),
    amount: positiveMoneyString,
    description,
    date: isoDate,
    /** Must be absent when another person paid. */
    accountId: objectIdString.nullish(),
    categoryId: objectIdString.nullish(),
    notes: z.string().trim().max(LIMITS.notesMaxLength).nullish(),
    /** Absent or null means the user paid. */
    paidByPersonId: objectIdString.nullish(),
    splitMethod: splitMethodSchema,
    participants: participantsSchema,
  })
  .superRefine(assertMethodFieldsPresent);

export type CreateSharedExpenseRequest = z.infer<typeof createSharedExpenseSchema>;

export const updateSharedExpenseSchema = z
  .object({
    amount: positiveMoneyString.optional(),
    description: description.optional(),
    date: isoDate.optional(),
    accountId: objectIdString.nullish(),
    categoryId: objectIdString.nullish(),
    notes: z.string().trim().max(LIMITS.notesMaxLength).nullish(),
    paidByPersonId: objectIdString.nullish(),
    splitMethod: splitMethodSchema.optional(),
    participants: participantsSchema.optional(),
    expectedSyncVersion: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasChange = [
      value.amount,
      value.description,
      value.date,
      value.accountId,
      value.categoryId,
      value.notes,
      value.paidByPersonId,
      value.participants,
    ].some((field) => field !== undefined);

    if (!hasChange) {
      ctx.addIssue({ code: "custom", message: "Provide at least one field to update." });
    }

    // A method without participants has nothing to apply to.
    if (value.splitMethod !== undefined && value.participants === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Send the participants along with the split method.",
      });
    }

    if (value.participants !== undefined) {
      assertMethodFieldsPresent(
        { splitMethod: value.splitMethod ?? "custom", participants: value.participants },
        ctx,
      );
    }
  });

export type UpdateSharedExpenseRequest = z.infer<typeof updateSharedExpenseSchema>;
