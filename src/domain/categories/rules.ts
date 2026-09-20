import { InvalidCategoryError } from "@/domain/shared/errors";
import { normalizeWhitespace } from "@/lib/utils/text";
import type { Category, CategoryKind } from "./entities";

/**
 * Business rules for categories.
 *
 * Categories are reference data: they are archived rather than deleted, because
 * every transaction already classified under one keeps referring to it
 * (docs/09-DATABASE-SCHEMA.md section 25).
 */

/** An archived category may not be applied to a new transaction. */
export function assertCategoryUsable(category: Category, purpose = "this transaction"): void {
  if (category.archivedAt !== null) {
    throw new InvalidCategoryError(
      `"${category.name}" is archived and cannot be used for ${purpose}.`,
    );
  }
}

/** An expense cannot be classified under an income category, or vice versa. */
export function assertCategoryKind(category: Category, expected: CategoryKind): void {
  if (category.kind !== expected) {
    throw new InvalidCategoryError(
      `"${category.name}" is an ${category.kind} category and cannot be used for ${expected === "expense" ? "an expense" : "income"}.`,
    );
  }
}

/**
 * Validates a parent reference.
 *
 * The MVP supports exactly one level of nesting (docs/01-MVP-SCOPE.md section 5).
 * Allowing arbitrary depth would mean every spending rollup needs a recursive walk,
 * and the picker would need a tree control, for no benefit the MVP has asked for.
 */
export function assertValidParent(parent: Category, expectedKind: CategoryKind): void {
  if (parent.parentId !== null) {
    throw new InvalidCategoryError(
      `"${parent.name}" is already a sub-category, so it cannot have children.`,
    );
  }

  if (parent.archivedAt !== null) {
    throw new InvalidCategoryError(`"${parent.name}" is archived and cannot be a parent.`);
  }

  if (parent.kind !== expectedKind) {
    throw new InvalidCategoryError("A sub-category must have the same kind as its parent.");
  }
}

/** A category cannot be its own parent. */
export function assertNotSelfParent(categoryId: string, parentId: string | null): void {
  if (parentId !== null && parentId === categoryId) {
    throw new InvalidCategoryError("A category cannot be its own parent.");
  }
}

/**
 * A category with children may not become a child itself.
 *
 * Otherwise the one-level rule would be broken indirectly: the existing children
 * would silently end up two levels deep.
 */
export function assertCanBecomeChild(hasChildren: boolean, categoryName: string): void {
  if (hasChildren) {
    throw new InvalidCategoryError(
      `"${categoryName}" has sub-categories, so it cannot become a sub-category itself.`,
    );
  }
}

/**
 * Rejects a duplicate name among siblings.
 *
 * Two categories called "Food" at the top level are indistinguishable in a picker.
 * The same name under different parents is fine - "Travel > Taxi" and
 * "Commute > Taxi" are meaningfully different.
 */
export function assertNameAvailable(
  name: string,
  siblings: readonly Category[],
  excludeCategoryId?: string,
): void {
  const normalized = normalizeWhitespace(name).toLowerCase();

  const clash = siblings.some(
    (sibling) =>
      sibling.id !== excludeCategoryId &&
      normalizeWhitespace(sibling.name).toLowerCase() === normalized,
  );

  if (clash) {
    throw new InvalidCategoryError(`You already have a category called "${name}" here.`);
  }
}

/** Categories that share a parent, used for the duplicate-name check. */
export function siblingsOf(categories: readonly Category[], parentId: string | null): Category[] {
  return categories.filter((category) => category.parentId === parentId);
}
