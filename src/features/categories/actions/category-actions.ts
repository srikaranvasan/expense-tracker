"use server";

import { revalidatePath } from "next/cache";
import { fromZodError, isAppError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { requireUser } from "@/server/auth/session";
import {
  archiveCategory,
  createCategory,
  restoreCategory,
  updateCategory,
} from "@/server/services/categories/category-service";
import { createCategorySchema, updateCategorySchema } from "../schemas/category-schemas";

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
    logger.error("category action failed", { operation, errorCode: appError.code });
  }
  return { ok: false, message: appError.userMessage };
}

/** Empty string means "no parent"; the select uses "" for the top-level option. */
function optionalId(value: FormDataEntryValue | null): string | null {
  const text = value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}

function optionalString(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function revalidateCategories(): void {
  revalidatePath("/categories");
  // Every expense form reads the category picker.
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function createCategoryAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createCategorySchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    icon: optionalString(formData.get("icon")),
    parentId: optionalId(formData.get("parentId")),
    kind: formData.get("kind") ?? undefined,
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    const category = await createCategory(user.id, {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      icon: parsed.data.icon ?? null,
      parentId: parsed.data.parentId ?? null,
      kind: parsed.data.kind,
    });

    revalidateCategories();
    return { ok: true, entityId: category.id, message: `"${category.name}" added.` };
  } catch (error) {
    return failure(error, "categories.create");
  }
}

export async function updateCategoryAction(
  categoryId: string,
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = updateCategorySchema.safeParse({
    name: optionalString(formData.get("name")) ?? undefined,
    icon: optionalString(formData.get("icon")),
    parentId: optionalId(formData.get("parentId")),
    expectedSyncVersion: formData.get("expectedSyncVersion")
      ? Number(formData.get("expectedSyncVersion"))
      : undefined,
  });

  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await updateCategory(user.id, categoryId, parsed.data);
    revalidateCategories();
    return { ok: true, entityId: categoryId, message: "Category updated." };
  } catch (error) {
    return failure(error, "categories.update");
  }
}

export async function archiveCategoryAction(categoryId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    const result = await archiveCategory(user.id, categoryId);
    revalidateCategories();

    const suffix =
      result.archivedChildren > 0
        ? ` ${result.archivedChildren} sub-${result.archivedChildren === 1 ? "category was" : "categories were"} archived too.`
        : "";

    return { ok: true, message: `"${result.category.name}" archived.${suffix}` };
  } catch (error) {
    return failure(error, "categories.archive");
  }
}

export async function restoreCategoryAction(categoryId: string): Promise<ActionState> {
  const user = await requireUser();

  try {
    await restoreCategory(user.id, categoryId);
    revalidateCategories();
    return { ok: true, message: "Category restored." };
  } catch (error) {
    return failure(error, "categories.restore");
  }
}
