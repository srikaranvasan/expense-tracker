import type { Metadata } from "next";
import { Box, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { CategoryManager } from "@/features/categories/components/CategoryManager";
import {
  getCategoryTreeView,
  getParentCategoryOptions,
} from "@/features/categories/queries/category-queries";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  const { archived } = await searchParams;
  const includeArchived = archived === "true";

  const [tree, parentOptions] = await Promise.all([
    getCategoryTreeView(user.id, { includeArchived, kind: "expense" }),
    getParentCategoryOptions(user.id, "expense"),
  ]);

  return (
    <Box as="section">
      <PageHeader
        title="Categories"
        description="Classify your expenses. Sub-categories can be nested one level deep."
      />

      <CategoryManager
        tree={tree}
        parentOptions={parentOptions}
        showingArchived={includeArchived}
      />

      <Text mt="5" fontSize="sm">
        <AppLink href={includeArchived ? "/categories" : "/categories?archived=true"}>
          {includeArchived ? "Hide archived categories" : "Show archived categories"}
        </AppLink>
      </Text>
    </Box>
  );
}
