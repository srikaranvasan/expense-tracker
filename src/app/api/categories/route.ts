import {
  createCategorySchema,
  listCategoriesQuerySchema,
} from "@/features/categories/schemas/category-schemas";
import {
  toCategoryTreeView,
  toCategoryView,
  toCategoryViews,
} from "@/features/categories/view-models/category-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiCreated, apiSuccess } from "@/server/api/response";
import { createCategory, listCategories } from "@/server/services/categories/category-service";

export const runtime = "nodejs";

/**
 * GET /api/categories
 *
 * Returns both a flat list and the parent/child tree. The tree is what a picker
 * needs, and building it twice on the client would be wasteful.
 */
export const GET = withAuthApi({ operation: "categories.list", rateLimit: "read" }, async (ctx) => {
  const query = ctx.query(listCategoriesQuerySchema);

  const categories = await listCategories(ctx.userId, {
    includeArchived: query.includeArchived,
    ...(query.kind ? { kind: query.kind } : {}),
  });

  return apiSuccess(
    { items: toCategoryViews(categories), tree: toCategoryTreeView(categories) },
    { requestId: ctx.requestId },
  );
});

/** POST /api/categories - adds a custom category, optionally under a parent. */
export const POST = withAuthApi(
  { operation: "categories.create", rateLimit: "write" },
  async (ctx) => {
    const input = await ctx.body(createCategorySchema);

    const category = await createCategory(ctx.userId, {
      clientId: input.clientId,
      name: input.name,
      icon: input.icon ?? null,
      parentId: input.parentId ?? null,
      kind: input.kind,
    });

    return apiCreated(toCategoryView(category), { requestId: ctx.requestId });
  },
);
