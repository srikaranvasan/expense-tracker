import type { CategoryKind } from "@/domain/categories/entities";
import { listCategories } from "@/server/services/categories/category-service";
import type {
  CategoryOption,
  CategoryTreeView,
  CategoryView,
} from "../view-models/category-view-model";
import {
  toCategoryOptions,
  toCategoryTreeView,
  toCategoryViews,
  toParentOptions,
} from "../view-models/category-view-model";

/** Read models for the category screens and for any expense form's picker. */

export async function getCategoryTreeView(
  userId: string,
  options: { includeArchived?: boolean; kind?: CategoryKind } = {},
): Promise<CategoryTreeView[]> {
  const categories = await listCategories(userId, {
    includeArchived: options.includeArchived ?? false,
    ...(options.kind ? { kind: options.kind } : {}),
  });

  return toCategoryTreeView(categories);
}

export async function getCategoryListView(
  userId: string,
  options: { includeArchived?: boolean; kind?: CategoryKind } = {},
): Promise<CategoryView[]> {
  const categories = await listCategories(userId, {
    includeArchived: options.includeArchived ?? false,
    ...(options.kind ? { kind: options.kind } : {}),
  });

  return toCategoryViews(categories);
}

/**
 * Options for an expense form's category picker.
 *
 * Active categories only: an archived category must not be selectable for a new
 * transaction.
 */
export async function getCategoryOptions(
  userId: string,
  kind: CategoryKind = "expense",
): Promise<CategoryOption[]> {
  return toCategoryOptions(await listCategories(userId, { kind, includeArchived: false }));
}

/** Top-level categories, for the parent picker on the category form. */
export async function getParentCategoryOptions(
  userId: string,
  kind: CategoryKind = "expense",
): Promise<CategoryOption[]> {
  return toParentOptions(await listCategories(userId, { kind, includeArchived: false }));
}
