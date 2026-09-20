import {
  categoryIdParamSchema,
  updateCategorySchema,
} from "@/features/categories/schemas/category-schemas";
import { toCategoryView } from "@/features/categories/view-models/category-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import {
  archiveCategory,
  getCategory,
  updateCategory,
} from "@/server/services/categories/category-service";

export const runtime = "nodejs";

function categoryIdOf(params: Record<string, string | string[]>): string {
  return categoryIdParamSchema.parse(params).id;
}

/** GET /api/categories/:id */
export const GET = withAuthApi({ operation: "categories.get", rateLimit: "read" }, async (ctx) => {
  const category = await getCategory(ctx.userId, categoryIdOf(ctx.params));
  return apiSuccess(toCategoryView(category), { requestId: ctx.requestId });
});

/** PATCH /api/categories/:id - rename, change icon, or move under a parent. */
export const PATCH = withAuthApi(
  { operation: "categories.update", rateLimit: "write" },
  async (ctx) => {
    const categoryId = categoryIdOf(ctx.params);
    const input = await ctx.body(updateCategorySchema);

    const category = await updateCategory(ctx.userId, categoryId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.expectedSyncVersion !== undefined
        ? { expectedSyncVersion: input.expectedSyncVersion }
        : {}),
    });

    return apiSuccess(toCategoryView(category), { requestId: ctx.requestId });
  },
);

/**
 * DELETE /api/categories/:id
 *
 * Archives the category and any sub-categories. Transactions already classified
 * under it keep their reference, so nothing is deleted. The response reports how
 * many transactions still use it, which the UI shows as confirmation that the
 * history is intact.
 */
export const DELETE = withAuthApi(
  { operation: "categories.archive", rateLimit: "write" },
  async (ctx) => {
    const categoryId = categoryIdOf(ctx.params);
    const result = await archiveCategory(ctx.userId, categoryId);

    return apiSuccess(
      {
        ...toCategoryView(result.category),
        archivedChildren: result.archivedChildren,
        transactionCount: result.transactionCount,
      },
      { requestId: ctx.requestId },
    );
  },
);
