import type { ArchiveMeta, EntityBase, SyncMeta } from "@/domain/shared/entities";

export type CategoryKind = "expense" | "income";

/**
 * A user-defined classification for transactions.
 *
 * Supports one level of nesting via `parentId` (docs/01-MVP-SCOPE.md section 5).
 */
export type Category = EntityBase &
  SyncMeta &
  ArchiveMeta & {
    userId: string;
    name: string;
    icon: string | null;
    parentId: string | null;
    kind: CategoryKind;
  };

/** A category with its children, for rendering a grouped picker. */
export type CategoryTreeNode = Category & {
  children: Category[];
};

/**
 * Groups a flat list into parents with children.
 *
 * A child whose parent is missing (archived, for instance) is promoted to the top
 * level rather than being silently dropped from the picker.
 */
export function buildCategoryTree(categories: readonly Category[]): CategoryTreeNode[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const nodes = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const category of categories) {
    if (category.parentId === null || !byId.has(category.parentId)) {
      const node: CategoryTreeNode = { ...category, children: [] };
      nodes.set(category.id, node);
      roots.push(node);
    }
  }

  for (const category of categories) {
    if (category.parentId === null) continue;
    const parent = nodes.get(category.parentId);
    if (parent) {
      parent.children.push(category);
    }
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  roots.sort(byName);
  for (const root of roots) root.children.sort(byName);

  return roots;
}
