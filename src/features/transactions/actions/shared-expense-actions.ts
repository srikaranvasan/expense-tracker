"use server";

import { revalidatePath } from "next/cache";
import { fromZodError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { requireUser } from "@/server/auth/session";
import {
  createSharedExpense,
  updateSharedExpense,
} from "@/server/services/transactions/shared-expense-service";
import type { ParticipantInput } from "@/server/services/transactions/shared-expense-service";
import {
  createSharedExpenseSchema,
  updateSharedExpenseSchema,
} from "../schemas/shared-expense-schemas";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  entityId?: string;
};

function validationFailure(error: Parameters<typeof fromZodError>[0]): ActionState {
  const appError = fromZodError(error);
  return {
    ok: false,
    message: "Please check the details you entered.",
    fieldErrors: (appError.details?.fieldErrors as Record<string, string[]>) ?? {},
  };
}

/** Puts a domain error next to the control that caused it, where that is knowable. */
const FIELD_BY_ERROR_CODE: Record<string, string> = {
  INVALID_ACCOUNT: "accountId",
  INVALID_CATEGORY: "categoryId",
  INVALID_AMOUNT: "amount",
  INVALID_PERSON: "participants",
  INVALID_PARTICIPANT: "participants",
  INVALID_SPLIT: "participants",
  INVALID_SPLIT_TOTAL: "participants",
};

function failure(error: unknown, operation: string): ActionState {
  const appError = toAppError(error);

  if (!isAppError(error)) {
    logger.error("shared expense action failed", { operation, errorCode: appError.code });
  }

  const field = FIELD_BY_ERROR_CODE[appError.code];

  return {
    ok: false,
    message: appError.userMessage,
    ...(field ? { fieldErrors: { [field]: [appError.userMessage] } } : {}),
  };
}

function optionalString(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function optionalId(value: FormDataEntryValue | null): string | null {
  const text = value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}

/**
 * Reads the participant rows out of the flat form payload.
 *
 * The editor emits `participants[0].personId`, `participants[0].amount`, and so on.
 * Indexes are read in order until one is missing, so a removed row cannot leave a hole
 * that silently truncates the list.
 */
function readParticipants(
  formData: FormData,
  method: "equal" | "custom" | "percentage",
): ParticipantInput[] {
  const participants: ParticipantInput[] = [];

  for (let index = 0; ; index += 1) {
    if (!formData.has(`participants[${index}].personId`)) break;

    const personId = optionalId(formData.get(`participants[${index}].personId`));
    const amount = optionalString(formData.get(`participants[${index}].amount`));
    const percentage = optionalString(formData.get(`participants[${index}].percentage`));

    participants.push({
      personId,
      ...(method === "custom" && amount ? { amount } : {}),
      ...(method === "percentage" && percentage ? { percentage } : {}),
    });
  }

  return participants;
}

function revalidateExpense(expenseId?: string): void {
  revalidatePath("/transactions");
  if (expenseId) revalidatePath(`/transactions/${expenseId}`);
  revalidatePath("/accounts");
  revalidatePath("/people");
  revalidatePath("/dashboard");
}

export async function createSharedExpenseAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const splitMethod = (formData.get("splitMethod") ?? "equal") as "equal" | "custom" | "percentage";

  const parsed = createSharedExpenseSchema.safeParse({
    clientId: formData.get("clientId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    date: formData.get("date"),
    accountId: optionalId(formData.get("accountId")),
    categoryId: optionalId(formData.get("categoryId")),
    notes: optionalString(formData.get("notes")),
    paidByPersonId: optionalId(formData.get("paidByPersonId")),
    splitMethod,
    participants: readParticipants(formData, splitMethod),
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const { transaction } = await createSharedExpense(user.id, user.currency, {
      clientId: parsed.data.clientId,
      amount: parsed.data.amount,
      description: parsed.data.description,
      date: parsed.data.date,
      accountId: parsed.data.accountId ?? null,
      categoryId: parsed.data.categoryId ?? null,
      notes: parsed.data.notes ?? null,
      paidByPersonId: parsed.data.paidByPersonId ?? null,
      splitMethod: parsed.data.splitMethod,
      participants: parsed.data.participants,
    });

    revalidateExpense(transaction.id);
    return { ok: true, entityId: transaction.id, message: "Shared expense recorded." };
  } catch (error) {
    return failure(error, "expenses.createShared");
  }
}

export async function updateSharedExpenseAction(
  expenseId: string,
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const splitMethod = (formData.get("splitMethod") ?? "custom") as
    "equal" | "custom" | "percentage";

  const parsed = updateSharedExpenseSchema.safeParse({
    amount: optionalString(formData.get("amount")) ?? undefined,
    description: optionalString(formData.get("description")) ?? undefined,
    date: optionalString(formData.get("date")) ?? undefined,
    accountId: optionalId(formData.get("accountId")),
    categoryId: optionalId(formData.get("categoryId")),
    notes: optionalString(formData.get("notes")),
    paidByPersonId: optionalId(formData.get("paidByPersonId")),
    splitMethod,
    participants: readParticipants(formData, splitMethod),
    expectedSyncVersion: formData.get("expectedSyncVersion")
      ? Number(formData.get("expectedSyncVersion"))
      : undefined,
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await updateSharedExpense(user.id, expenseId, user.currency, parsed.data);

    revalidateExpense(expenseId);
    return { ok: true, entityId: expenseId, message: "Shared expense updated." };
  } catch (error) {
    return failure(error, "expenses.updateShared");
  }
}
