import type { Category, CategoryKind } from "@/domain/categories/entities";
import { buildCategoryTree } from "@/domain/categories/entities";

/**
 * Category view models.
 *
 * The picker needs a grouped shape and the management screen needs a tree, so both
 * are derived here rather than in the components.
 */

export type CategoryView = {
  id: string;
  clientId: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  parentName: string | null;
  kind: CategoryKind;
  isArchived: boolean;
  syncVersion: number;
};

export function toCategoryView(category: Category, parentName: string | null = null): CategoryView {
  return {
    id: category.id,
    clientId: category.clientId,
    name: category.name,
    icon: category.icon,
    parentId: category.parentId,
    parentName,
    kind: category.kind,
    isArchived: category.archivedAt !== null,
    syncVersion: category.syncVersion,
  };
}

export function toCategoryViews(categories: readonly Category[]): CategoryView[] {
  const namesById = new Map(categories.map((category) => [category.id, category.name] as const));

  return categories.map((category) =>
    toCategoryView(category, category.parentId ? (namesById.get(category.parentId) ?? null) : null),
  );
}

export type CategoryTreeView = CategoryView & {
  children: CategoryView[];
};

export function toCategoryTreeView(categories: readonly Category[]): CategoryTreeView[] {
  return buildCategoryTree(categories).map((node) => ({
    ...toCategoryView(node),
    children: node.children.map((child) => toCategoryView(child, node.name)),
  }));
}

/**
 * Flat option list for a `<select>`, with children grouped under their parent.
 *
 * `depth` lets the picker indent a child without needing a nested control.
 */
export type CategoryOption = {
  id: string;
  /** "Restaurants" */
  name: string;
  /** "Food › Restaurants" - unambiguous when two parents share a child name. */
  label: string;
  depth: 0 | 1;
  parentId: string | null;
};

export function toCategoryOptions(categories: readonly Category[]): CategoryOption[] {
  const options: CategoryOption[] = [];

  for (const parent of buildCategoryTree(categories)) {
    options.push({
      id: parent.id,
      name: parent.name,
      label: parent.name,
      depth: 0,
      parentId: null,
    });

    for (const child of parent.children) {
      options.push({
        id: child.id,
        name: child.name,
        label: `${parent.name} › ${child.name}`,
        depth: 1,
        parentId: parent.id,
      });
    }
  }

  return options;
}

/** Top-level categories only, for choosing a parent. */
export function toParentOptions(categories: readonly Category[]): CategoryOption[] {
  return toCategoryOptions(categories).filter((option) => option.depth === 0);
}
