"use server";

import { revalidatePath } from "next/cache";
import { fromZodError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { requireUser } from "@/server/auth/session";
import {
  createCardPayment,
  deleteCardPayment,
  updateCardPayment,
} from "@/server/services/transactions/card-payment-service";
import { createCardPaymentSchema, updateCardPaymentSchema } from "../schemas/card-payment-schemas";
import type { ActionState } from "./expense-actions";

/**
 * Server actions for the credit-card payment screens.
 *
 * Shares `ActionState` with the expense actions so one form contract works for all
 * the transaction types.
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
 * A card-payment error is nearly always about which account was chosen - not a card,
 * a card paying a card, or an archived one - so both codes point at the destination.
 * The message also appears in the banner, so nothing is hidden if the source was the
 * real cause.
 */
const FIELD_BY_ERROR_CODE: Record<string, string> = {
  INVALID_CREDIT_CARD_PAYMENT: "toAccountId",
  INVALID_ACCOUNT: "toAccountId",
  INVALID_AMOUNT: "amount",
};

function failure(error: unknown, operation: string): ActionState {
  const appError = toAppError(error);

  if (!isAppError(error)) {
    logger.error("card payment action failed", { operation, errorCode: appError.code });
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
 * A payment touches a bank account and a card, so balances, outstanding and available
 * credit all change - but no spending total does.
 */
function revalidateCardPayment(paymentId?: string): void {
  revalidatePath("/transactions");
  if (paymentId) revalidatePath(`/transactions/${paymentId}`);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function createCardPaymentAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createCardPaymentSchema.safeParse({
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
    const payment = await createCardPayment(user.id, user.currency, {
      clientId: parsed.data.clientId,
      amount: parsed.data.amount,
      fromAccountId: parsed.data.fromAccountId,
      toAccountId: parsed.data.toAccountId,
      date: parsed.data.date,
      description: parsed.data.description ?? null,
      notes: parsed.data.notes ?? null,
    });

    revalidateCardPayment(payment.id);
    return { ok: true, entityId: payment.id, message: "Payment recorded." };
  } catch (error) {
    return failure(error, "cardPayments.create");
  }
}

export async function updateCardPaymentAction(
  paymentId: string,
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updateCardPaymentSchema.safeParse({
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
    await updateCardPayment(user.id, paymentId, user.currency, parsed.data);

    revalidateCardPayment(paymentId);
    return { ok: true, entityId: paymentId, message: "Payment updated." };
  } catch (error) {
    return failure(error, "cardPayments.update");
  }
}

export async function deleteCardPaymentAction(paymentId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    await deleteCardPayment(user.id, paymentId);
    revalidateCardPayment(paymentId);
    return { ok: true, message: "Payment deleted." };
  } catch (error) {
    return failure(error, "cardPayments.delete");
  }
}
