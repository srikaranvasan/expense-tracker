import { categoryIdParamSchema } from "@/features/categories/schemas/category-schemas";
import { toCategoryView } from "@/features/categories/view-models/category-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { restoreCategory } from "@/server/services/categories/category-service";

export const runtime = "nodejs";

/**
 * POST /api/categories/:id/restore
 *
 * A child whose parent is still archived is promoted to the top level, so it does
 * not reappear inside a group the user cannot see.
 */
export const POST = withAuthApi(
  { operation: "categories.restore", rateLimit: "write" },
  async (ctx) => {
    const { id } = categoryIdParamSchema.parse(ctx.params);
    const category = await restoreCategory(ctx.userId, id);

    return apiSuccess(toCategoryView(category), { requestId: ctx.requestId });
  },
);
