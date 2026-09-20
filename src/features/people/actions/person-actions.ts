"use server";

import { revalidatePath } from "next/cache";
import { fromZodError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { requireUser } from "@/server/auth/session";
import {
  archivePerson,
  createPerson,
  restorePerson,
  updatePerson,
} from "@/server/services/people/person-service";
import { createPersonSchema, updatePersonSchema } from "../schemas/person-schemas";

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

function failure(error: unknown, operation: string): ActionState {
  const appError = toAppError(error);
  if (!isAppError(error)) {
    logger.error("person action failed", { operation, errorCode: appError.code });
  }
  return { ok: false, message: appError.userMessage };
}

function optionalString(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function revalidatePerson(personId?: string): void {
  revalidatePath("/people");
  if (personId) revalidatePath(`/people/${personId}`);
  revalidatePath("/dashboard");
}

export async function createPersonAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createPersonSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    notes: optionalString(formData.get("notes")),
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const person = await createPerson(user.id, {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      notes: parsed.data.notes ?? null,
    });

    revalidatePerson(person.id);
    return { ok: true, entityId: person.id, message: "Person added." };
  } catch (error) {
    return failure(error, "people.create");
  }
}

export async function updatePersonAction(
  personId: string,
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updatePersonSchema.safeParse({
    name: optionalString(formData.get("name")) ?? undefined,
    notes: optionalString(formData.get("notes")),
    expectedSyncVersion: formData.get("expectedSyncVersion")
      ? Number(formData.get("expectedSyncVersion"))
      : undefined,
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await updatePerson(user.id, personId, parsed.data);
    revalidatePerson(personId);
    return { ok: true, entityId: personId, message: "Person updated." };
  } catch (error) {
    return failure(error, "people.update");
  }
}

export async function archivePersonAction(personId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    await archivePerson(user.id, personId);
    revalidatePerson(personId);
    return { ok: true, message: "Person archived." };
  } catch (error) {
    return failure(error, "people.archive");
  }
}

export async function restorePersonAction(personId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    await restorePerson(user.id, personId);
    revalidatePerson(personId);
    return { ok: true, message: "Person restored." };
  } catch (error) {
    return failure(error, "people.restore");
  }
}
