"use server";

import { revalidatePath } from "next/cache";
import { fromZodError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { requireUser } from "@/server/auth/session";
import {
  createTransfer,
  deleteTransfer,
  updateTransfer,
} from "@/server/services/transactions/transfer-service";
import { createTransferSchema, updateTransferSchema } from "../schemas/transfer-schemas";
import type { ActionState } from "./expense-actions";

/**
 * Server actions for the transfer screens.
 *
 * Shares `ActionState` with the expense actions so one form component contract works
 * for both.
 */

function validationFailure(error: Parameters<typeof fromZodError>[0]): ActionState {
  const appError = fromZodError(error);
  return {
    ok: false,
    message: "Please check the details you entered.",
    fieldErrors: (appError.details?.fieldErrors as Record<string, string[]>) ?? {},
  };
}

/**
 * Attaches a domain error to the field it is about.
 *
 * A transfer error is nearly always about the destination - the same account, an
 * archived one, or a credit card - so `INVALID_TRANSFER` points there. The message
 * still appears in the banner, so nothing is hidden if the real cause was the source.
 */
const FIELD_BY_ERROR_CODE: Record<string, string> = {
  INVALID_TRANSFER: "toAccountId",
  INVALID_ACCOUNT: "toAccountId",
  INVALID_AMOUNT: "amount",
};

function failure(error: unknown, operation: string): ActionState {
  const appError = toAppError(error);

  if (!isAppError(error)) {
    logger.error("transfer action failed", { operation, errorCode: appError.code });
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

/**
 * A transfer touches two accounts, so both the account list and the dashboard
 * change even though no spending total does.
 */
function revalidateTransfer(transferId?: string): void {
  revalidatePath("/transactions");
  if (transferId) revalidatePath(`/transactions/${transferId}`);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function createTransferAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createTransferSchema.safeParse({
    clientId: formData.get("clientId"),
    amount: formData.get("amount"),
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId"),
    date: formData.get("date"),
    description: optionalString(formData.get("description")) ?? undefined,
    notes: optionalString(formData.get("notes")),
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const transfer = await createTransfer(user.id, user.currency, {
      clientId: parsed.data.clientId,
      amount: parsed.data.amount,
      fromAccountId: parsed.data.fromAccountId,
      toAccountId: parsed.data.toAccountId,
      date: parsed.data.date,
      description: parsed.data.description ?? null,
      notes: parsed.data.notes ?? null,
    });

    revalidateTransfer(transfer.id);
    return { ok: true, entityId: transfer.id, message: "Transfer recorded." };
  } catch (error) {
    return failure(error, "transfers.create");
  }
}

export async function updateTransferAction(
  transferId: string,
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updateTransferSchema.safeParse({
    amount: optionalString(formData.get("amount")) ?? undefined,
    fromAccountId: optionalString(formData.get("fromAccountId")) ?? undefined,
    toAccountId: optionalString(formData.get("toAccountId")) ?? undefined,
    date: optionalString(formData.get("date")) ?? undefined,
    description: optionalString(formData.get("description")) ?? undefined,
    notes: optionalString(formData.get("notes")),
    expectedSyncVersion: formData.get("expectedSyncVersion")
      ? Number(formData.get("expectedSyncVersion"))
      : undefined,
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await updateTransfer(user.id, transferId, user.currency, parsed.data);

    revalidateTransfer(transferId);
    return { ok: true, entityId: transferId, message: "Transfer updated." };
  } catch (error) {
    return failure(error, "transfers.update");
  }
}

export async function deleteTransferAction(transferId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    await deleteTransfer(user.id, transferId);
    revalidateTransfer(transferId);
    return { ok: true, message: "Transfer deleted." };
  } catch (error) {
    return failure(error, "transfers.delete");
  }
}
