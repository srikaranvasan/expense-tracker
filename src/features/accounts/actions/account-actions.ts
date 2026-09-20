"use server";

import { revalidatePath } from "next/cache";
import { fromZodError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { requireUser } from "@/server/auth/session";
import {
  archiveAccount,
  createAccount,
  restoreAccount,
  updateAccount,
} from "@/server/services/accounts/account-service";
import { createAccountSchema, updateAccountSchema } from "../schemas/account-schemas";

/**
 * Server actions for the account screens.
 *
 * Each one resolves the user from the session, runs the use case, and returns a
 * serialisable result so the form can show field-level errors instead of throwing
 * an error boundary.
 */

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set on success so the client can navigate. */
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

function failure(error: unknown, operation: string): ActionState {
  const appError = toAppError(error);

  if (!isAppError(error)) {
    logger.error("account action failed", { operation, errorCode: appError.code });
  }

  return { ok: false, message: appError.userMessage };
}

/** Null when the field was left empty, so "clear this value" is expressible. */
function optionalString(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function optionalNumber(value: FormDataEntryValue | null): number | null | undefined {
  const text = optionalString(value);
  if (text === undefined) return undefined;
  if (text === null) return null;
  return Number(text);
}

export async function createAccountAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createAccountSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency") ?? user.currency,
    openingBalance: optionalString(formData.get("openingBalance")) ?? "0",
    institutionName: optionalString(formData.get("institutionName")),
    creditLimit: optionalString(formData.get("creditLimit")),
    statementDay: optionalNumber(formData.get("statementDay")),
    paymentDueDay: optionalNumber(formData.get("paymentDueDay")),
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const account = await createAccount(user.id, user.currency, {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency,
      openingBalance: parsed.data.openingBalance,
      institutionName: parsed.data.institutionName ?? null,
      creditLimit: parsed.data.creditLimit ?? null,
      statementDay: parsed.data.statementDay ?? null,
      paymentDueDay: parsed.data.paymentDueDay ?? null,
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { ok: true, entityId: account.id, message: "Account created." };
  } catch (error) {
    return failure(error, "accounts.create");
  }
}

export async function updateAccountAction(
  accountId: string,
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updateAccountSchema.safeParse({
    name: optionalString(formData.get("name")) ?? undefined,
    openingBalance: optionalString(formData.get("openingBalance")) ?? undefined,
    institutionName: optionalString(formData.get("institutionName")),
    creditLimit: optionalString(formData.get("creditLimit")),
    statementDay: optionalNumber(formData.get("statementDay")),
    paymentDueDay: optionalNumber(formData.get("paymentDueDay")),
    expectedSyncVersion: optionalNumber(formData.get("expectedSyncVersion")) ?? undefined,
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await updateAccount(user.id, accountId, user.currency, parsed.data);

    revalidatePath("/accounts");
    revalidatePath(`/accounts/${accountId}`);
    revalidatePath("/dashboard");

    return { ok: true, entityId: accountId, message: "Account updated." };
  } catch (error) {
    return failure(error, "accounts.update");
  }
}

export async function archiveAccountAction(accountId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    await archiveAccount(user.id, accountId);

    revalidatePath("/accounts");
    revalidatePath(`/accounts/${accountId}`);
    revalidatePath("/dashboard");

    return { ok: true, message: "Account archived." };
  } catch (error) {
    return failure(error, "accounts.archive");
  }
}

export async function restoreAccountAction(accountId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    await restoreAccount(user.id, accountId);

    revalidatePath("/accounts");
    revalidatePath(`/accounts/${accountId}`);
    revalidatePath("/dashboard");

    return { ok: true, message: "Account restored." };
  } catch (error) {
    return failure(error, "accounts.restore");
  }
}
