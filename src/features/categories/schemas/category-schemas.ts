import { z } from "zod";
import { clientIdString, entityName, objectIdString } from "@/lib/validation/helpers";

/**
 * Category request schemas.
 *
 * Structural validation only. Nesting depth, duplicate sibling names and parent
 * ownership need to see other categories, so they are enforced in
 * `server/services/categories/category-service.ts`.
 */

const categoryKindSchema = z.enum(["expense", "income"]);

/** A short icon name, not arbitrary markup. */
const iconName = z
  .string()
  .trim()
  .max(40)
  .regex(/^[a-z0-9-]*$/, "Icon must be a lowercase name using letters, digits and '-'.");

export const createCategorySchema = z.object({
  clientId: clientIdString,
  name: entityName,
  icon: iconName.nullish(),
  /** Null or omitted creates a top-level category. */
  parentId: objectIdString.nullish(),
  kind: categoryKindSchema.default("expense"),
});

export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;

/**
 * `kind` is deliberately not updatable: an expense category may already classify
 * expenses, and flipping it to income would misfile every one of them.
 */
export const updateCategorySchema = z
  .object({
    name: entityName.optional(),
    icon: iconName.nullish(),
    parentId: objectIdString.nullish(),
    expectedSyncVersion: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.icon !== undefined || value.parentId !== undefined,
    "Provide at least one field to update.",
  );

export type UpdateCategoryRequest = z.infer<typeof updateCategorySchema>;

export const listCategoriesQuerySchema = z.object({
  kind: categoryKindSchema.optional(),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const categoryIdParamSchema = z.object({ id: objectIdString });
