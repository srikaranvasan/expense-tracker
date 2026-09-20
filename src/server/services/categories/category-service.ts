import type { Category, CategoryKind } from "@/domain/categories/entities";
import {
  assertCanBecomeChild,
  assertCategoryKind,
  assertCategoryUsable,
  assertNameAvailable,
  assertNotSelfParent,
  assertValidParent,
  siblingsOf,
} from "@/domain/categories/rules";
import { InvalidCategoryError } from "@/domain/shared/errors";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { normalizeWhitespace } from "@/lib/utils/text";
import type { CategoryRepository } from "@/server/repositories/interfaces/category-repository";
import type { TransactionRepository } from "@/server/repositories/interfaces/transaction-repository";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";

/**
 * Category use cases.
 *
 * Validation that needs to see sibling categories (duplicate names) or the parent
 * (nesting depth) lives here, because the domain rules are pure and cannot query.
 */

export type CategoryServiceDependencies = {
  categories: CategoryRepository;
  transactions: TransactionRepository;
};

function defaultDependencies(): CategoryServiceDependencies {
  return { categories: categoryRepository(), transactions: transactionRepository() };
}

export type CreateCategoryCommand = {
  clientId: string;
  name: string;
  icon?: string | null;
  parentId?: string | null;
  kind?: CategoryKind;
};

export async function createCategory(
  userId: string,
  command: CreateCategoryCommand,
  dependencies: CategoryServiceDependencies = defaultDependencies(),
): Promise<Category> {
  const { categories } = dependencies;

  // Idempotency is checked before validation, not after. A retried offline create
  // carries the same clientId, and the duplicate-name rule would otherwise reject
  // the retry of a request that already succeeded
  // (docs/08-OFFLINE-SYNC.md section 18).
  const alreadyCreated = await categories.findByClientId(userId, command.clientId);
  if (alreadyCreated) return alreadyCreated;

  const name = normalizeWhitespace(command.name);
  if (name === "") throw new InvalidCategoryError("A name is required.");

  const kind = command.kind ?? "expense";
  const parentId = command.parentId ?? null;

  if (parentId !== null) {
    const parent = await categories.findById(userId, parentId);
    // A missing parent and another user's parent are the same thing here.
    if (!parent) throw new InvalidCategoryError("The selected parent category was not found.");
    assertValidParent(parent, kind);
  }

  // Archived siblings are included: reusing an archived name would produce two
  // categories with the same name as soon as the old one is restored.
  const existing = await categories.list(userId, { includeArchived: true, kind });
  assertNameAvailable(name, siblingsOf(existing, parentId));

  const category = await categories.create(userId, {
    clientId: command.clientId,
    name,
    icon: command.icon ?? null,
    parentId,
    kind,
  });

  logger.info("category created", {
    operation: "categories.create",
    userId,
    entityType: "category",
    entityId: category.id,
  });

  return category;
}

export type UpdateCategoryCommand = {
  name?: string;
  icon?: string | null;
  /** `null` promotes the category to the top level. */
  parentId?: string | null;
  expectedSyncVersion?: number;
};

export async function updateCategory(
  userId: string,
  categoryId: string,
  command: UpdateCategoryCommand,
  dependencies: CategoryServiceDependencies = defaultDependencies(),
): Promise<Category> {
  const { categories } = dependencies;

  const existing = await categories.findById(userId, categoryId);
  if (!existing) throw new NotFoundError("Category");

  if (existing.archivedAt !== null) {
    throw new InvalidCategoryError("Restore this category before editing it.");
  }

  const name = command.name !== undefined ? normalizeWhitespace(command.name) : existing.name;
  if (name === "") throw new InvalidCategoryError("A name is required.");

  const parentId = command.parentId !== undefined ? command.parentId : existing.parentId;

  if (parentId !== existing.parentId && parentId !== null) {
    assertNotSelfParent(categoryId, parentId);

    const parent = await categories.findById(userId, parentId);
    if (!parent) throw new InvalidCategoryError("The selected parent category was not found.");
    assertValidParent(parent, existing.kind);

    // Moving a category under a parent must not push its own children two levels deep.
    assertCanBecomeChild(await categories.hasChildren(userId, categoryId), existing.name);
  }

  const siblings = await categories.list(userId, { includeArchived: true, kind: existing.kind });
  assertNameAvailable(name, siblingsOf(siblings, parentId), categoryId);

  const category = await categories.update(userId, categoryId, {
    ...(command.name !== undefined ? { name } : {}),
    ...(command.icon !== undefined ? { icon: command.icon } : {}),
    ...(command.parentId !== undefined ? { parentId } : {}),
    ...(command.expectedSyncVersion !== undefined
      ? { expectedSyncVersion: command.expectedSyncVersion }
      : {}),
  });

  logger.info("category updated", {
    operation: "categories.update",
    userId,
    entityType: "category",
    entityId: categoryId,
  });

  return category;
}

/**
 * Archives a category.
 *
 * Transactions already classified under it keep their reference, so the category is
 * archived rather than deleted. Archiving a parent also archives its children:
 * leaving a child selectable while its parent is hidden produces a picker entry with
 * no visible group.
 */
export async function archiveCategory(
  userId: string,
  categoryId: string,
  dependencies: CategoryServiceDependencies = defaultDependencies(),
): Promise<{ category: Category; archivedChildren: number; transactionCount: number }> {
  const { categories, transactions } = dependencies;

  const existing = await categories.findById(userId, categoryId);
  if (!existing) throw new NotFoundError("Category");

  if (existing.archivedAt !== null) {
    return {
      category: existing,
      archivedChildren: 0,
      transactionCount: await transactions.countByCategory(userId, categoryId),
    };
  }

  const children = (await categories.list(userId, { kind: existing.kind })).filter(
    (candidate) => candidate.parentId === categoryId,
  );

  for (const child of children) {
    await categories.archive(userId, child.id);
  }

  const category = await categories.archive(userId, categoryId);
  const transactionCount = await transactions.countByCategory(userId, categoryId);

  logger.info("category archived", {
    operation: "categories.archive",
    userId,
    entityType: "category",
    entityId: categoryId,
    archivedChildren: children.length,
    transactionCount,
  });

  return { category, archivedChildren: children.length, transactionCount };
}

/**
 * Restores an archived category.
 *
 * A child whose parent is still archived is promoted to the top level rather than
 * being restored into a hidden group.
 */
export async function restoreCategory(
  userId: string,
  categoryId: string,
  dependencies: CategoryServiceDependencies = defaultDependencies(),
): Promise<Category> {
  const { categories } = dependencies;

  const existing = await categories.findById(userId, categoryId);
  if (!existing) throw new NotFoundError("Category");

  if (existing.parentId !== null) {
    const parent = await categories.findById(userId, existing.parentId);
    if (!parent || parent.archivedAt !== null) {
      await categories.update(userId, categoryId, { parentId: null });
    }
  }

  return categories.restore(userId, categoryId);
}

export async function listCategories(
  userId: string,
  query: { includeArchived?: boolean; kind?: CategoryKind } = {},
  dependencies: CategoryServiceDependencies = defaultDependencies(),
): Promise<Category[]> {
  return dependencies.categories.list(userId, query);
}

export async function getCategory(
  userId: string,
  categoryId: string,
  dependencies: CategoryServiceDependencies = defaultDependencies(),
): Promise<Category> {
  const category = await dependencies.categories.findById(userId, categoryId);
  if (!category) throw new NotFoundError("Category");
  return category;
}

/**
 * Resolves an optional category reference for another operation.
 *
 * Returns null when no category was supplied - a category is optional on an expense.
 * Verifies ownership, that the category is not archived, and that its kind matches.
 */
export async function resolveOwnedCategory(
  userId: string,
  categoryId: string | null | undefined,
  expectedKind: CategoryKind = "expense",
  dependencies: CategoryServiceDependencies = defaultDependencies(),
): Promise<Category | null> {
  if (!categoryId) return null;

  const category = await dependencies.categories.findById(userId, categoryId);
  if (!category) throw new InvalidCategoryError("The selected category was not found.");

  assertCategoryUsable(category);
  assertCategoryKind(category, expectedKind);

  return category;
}
