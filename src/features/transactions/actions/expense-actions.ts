"use server";

import { revalidatePath } from "next/cache";
import { fromZodError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { requireUser } from "@/server/auth/session";
import {
  createPersonalExpense,
  deleteExpense,
  updatePersonalExpense,
} from "@/server/services/transactions/expense-service";
import {
  createPersonalExpenseSchema,
  updatePersonalExpenseSchema,
} from "../schemas/expense-schemas";

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

/**
 * Turns a domain error into a field error where the field is obvious.
 *
 * "Choose the account you paid from" belongs next to the account picker, not in a
 * banner at the top of the form.
 */
const FIELD_BY_ERROR_CODE: Record<string, string> = {
  INVALID_ACCOUNT: "accountId",
  INVALID_CATEGORY: "categoryId",
  INVALID_AMOUNT: "amount",
};

function failure(error: unknown, operation: string): ActionState {
  const appError = toAppError(error);

  if (!isAppError(error)) {
    logger.error("expense action failed", { operation, errorCode: appError.code });
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

/** Empty string from a select means "no selection". */
function optionalId(value: FormDataEntryValue | null): string | null {
  const text = value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}

function revalidateExpense(expenseId?: string): void {
  revalidatePath("/transactions");
  if (expenseId) revalidatePath(`/transactions/${expenseId}`);
  // Balances and spending totals both change.
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function createPersonalExpenseAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createPersonalExpenseSchema.safeParse({
    clientId: formData.get("clientId"),
    splitClientId: formData.get("splitClientId") ?? undefined,
    amount: formData.get("amount"),
    description: formData.get("description"),
    date: formData.get("date"),
    accountId: formData.get("accountId"),
    categoryId: optionalId(formData.get("categoryId")),
    notes: optionalString(formData.get("notes")),
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const { transaction } = await createPersonalExpense(user.id, user.currency, {
      clientId: parsed.data.clientId,
      ...(parsed.data.splitClientId ? { splitClientId: parsed.data.splitClientId } : {}),
      amount: parsed.data.amount,
      description: parsed.data.description,
      date: parsed.data.date,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId ?? null,
      notes: parsed.data.notes ?? null,
    });

    revalidateExpense(transaction.id);
    return { ok: true, entityId: transaction.id, message: "Expense recorded." };
  } catch (error) {
    return failure(error, "expenses.createPersonal");
  }
}

export async function updatePersonalExpenseAction(
  expenseId: string,
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updatePersonalExpenseSchema.safeParse({
    amount: optionalString(formData.get("amount")) ?? undefined,
    description: optionalString(formData.get("description")) ?? undefined,
    date: optionalString(formData.get("date")) ?? undefined,
    accountId: optionalString(formData.get("accountId")) ?? undefined,
    categoryId: optionalId(formData.get("categoryId")),
    notes: optionalString(formData.get("notes")),
    expectedSyncVersion: formData.get("expectedSyncVersion")
      ? Number(formData.get("expectedSyncVersion"))
      : undefined,
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await updatePersonalExpense(user.id, expenseId, user.currency, parsed.data);

    revalidateExpense(expenseId);
    return { ok: true, entityId: expenseId, message: "Expense updated." };
  } catch (error) {
    return failure(error, "expenses.updatePersonal");
  }
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    await deleteExpense(user.id, expenseId);
    revalidateExpense(expenseId);
    return { ok: true, message: "Expense deleted." };
  } catch (error) {
    return failure(error, "expenses.delete");
  }
}
