import type { ClientSession } from "mongodb";
import { DEFAULT_CATEGORIES } from "@/config/constants";
import type { Category } from "@/domain/categories/entities";
import { logger } from "@/lib/logging/logger";
import { newClientId } from "@/lib/utils/client-id";
import type { CategoryRepository } from "@/server/repositories/interfaces/category-repository";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";

/**
 * Seeds a new user's starting categories.
 *
 * A brand-new account with an empty category list makes the first expense harder
 * than it needs to be, so registration creates a usable set the user can then edit
 * or archive (docs/01-MVP-SCOPE.md section 5).
 *
 * These are ordinary user-owned categories with no "system" flag: the user must be
 * free to rename or archive any of them. Marking them undeletable would be a
 * limitation with no purpose.
 */
export async function createDefaultCategories(
  userId: string,
  options: { session?: ClientSession; categories?: CategoryRepository } = {},
): Promise<Category[]> {
  const categories = options.categories ?? categoryRepository();

  const created = await categories.createMany(
    userId,
    DEFAULT_CATEGORIES.map((category) => ({
      // Server-generated: these are not the result of a client operation, so there
      // is no client id to reuse.
      clientId: newClientId(),
      name: category.name,
      icon: category.icon,
      parentId: null,
      kind: "expense" as const,
    })),
    options.session ? { session: options.session } : undefined,
  );

  logger.info("default categories created", {
    operation: "categories.seedDefaults",
    userId,
    count: created.length,
  });

  return created;
}
