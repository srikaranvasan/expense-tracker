"use server";

import { revalidatePath } from "next/cache";
import { fromZodError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { requireUser } from "@/server/auth/session";
import {
  createSettlement,
  deleteSettlement,
} from "@/server/services/settlements/settlement-service";
import type { AllocationInput } from "@/server/services/settlements/settlement-service";
import { createSettlementSchema } from "../schemas/settlement-schemas";

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

/** Settlement errors are nearly all about the allocation list, so they surface there. */
const FIELD_BY_ERROR_CODE: Record<string, string> = {
  INVALID_AMOUNT: "amount",
  INVALID_ACCOUNT: "accountId",
  INVALID_PERSON: "personId",
  INVALID_SETTLEMENT: "allocations",
  INVALID_SETTLEMENT_ALLOCATION: "allocations",
  OVER_SETTLEMENT: "allocations",
};

function failure(error: unknown, operation: string): ActionState {
  const appError = toAppError(error);

  if (!isAppError(error)) {
    logger.error("settlement action failed", { operation, errorCode: appError.code });
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
 * Reads the allocation rows out of the flat form payload.
 *
 * The form emits `allocations[0].expenseSplitId` and `allocations[0].amount`. Rows with
 * an empty or zero amount are dropped: leaving an expense blank means the user chose not
 * to settle it, which is different from settling zero.
 */
function readAllocations(formData: FormData): AllocationInput[] {
  const allocations: AllocationInput[] = [];

  for (let index = 0; ; index += 1) {
    if (!formData.has(`allocations[${index}].expenseSplitId`)) break;

    const expenseSplitId = optionalId(formData.get(`allocations[${index}].expenseSplitId`));
    const amount = optionalString(formData.get(`allocations[${index}].amount`));

    if (!expenseSplitId || !amount || Number(amount) === 0) continue;

    allocations.push({ expenseSplitId, amount });
  }

  return allocations;
}

function revalidateSettlement(personId: string, settlementId?: string): void {
  revalidatePath("/people");
  revalidatePath(`/people/${personId}`);
  revalidatePath("/settlements");
  if (settlementId) revalidatePath(`/settlements/${settlementId}`);
  // Balances and the account the payment moved through both change.
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function createSettlementAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createSettlementSchema.safeParse({
    clientId: formData.get("clientId"),
    personId: formData.get("personId"),
    direction: formData.get("direction"),
    amount: formData.get("amount"),
    accountId: optionalId(formData.get("accountId")),
    date: formData.get("date"),
    notes: optionalString(formData.get("notes")),
    allocations: readAllocations(formData),
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const { settlement } = await createSettlement(user.id, user.currency, {
      clientId: parsed.data.clientId,
      personId: parsed.data.personId,
      direction: parsed.data.direction,
      amount: parsed.data.amount,
      accountId: parsed.data.accountId ?? null,
      date: parsed.data.date,
      notes: parsed.data.notes ?? null,
      allocations: parsed.data.allocations,
    });

    revalidateSettlement(settlement.personId, settlement.id);
    return { ok: true, entityId: settlement.id, message: "Settlement recorded." };
  } catch (error) {
    return failure(error, "settlements.create");
  }
}

export async function deleteSettlementAction(
  settlementId: string,
  personId: string,
): Promise<ActionState> {
  const user = await requireUser();

  try {
    await deleteSettlement(user.id, settlementId);
    revalidateSettlement(personId, settlementId);
    return { ok: true, message: "Settlement removed. The balance has been restored." };
  } catch (error) {
    return failure(error, "settlements.delete");
  }
}
