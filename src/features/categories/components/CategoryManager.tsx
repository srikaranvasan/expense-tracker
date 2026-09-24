"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CategorySwatch } from "./CategorySwatch";
import { archiveCategoryAction, restoreCategoryAction } from "../actions/category-actions";
import type {
  CategoryOption,
  CategoryTreeView,
  CategoryView,
} from "../view-models/category-view-model";
import { CategoryForm } from "./CategoryForm";

export type CategoryManagerProps = {
  tree: readonly CategoryTreeView[];
  parentOptions: readonly CategoryOption[];
  showingArchived: boolean;
};

/**
 * Category management surface.
 *
 * Add, rename, move, archive and restore in one place. Editing happens inline rather
 * than on a separate page: categories are small records and the user is usually
 * adjusting several in one sitting.
 */
export function CategoryManager({ tree, parentOptions, showingArchived }: CategoryManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function run(operation: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await operation();
      setNotice({
        tone: result.ok ? "success" : "error",
        text: result.message ?? (result.ok ? "Done." : "That did not work."),
      });
      if (result.ok) router.refresh();
    });
  }

  function closeForms() {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  }

  return (
    <Stack gap="4">
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      {adding ? (
        <Card>
          <CardHeader title="New category" />
          <CardBody>
            <CategoryForm parentOptions={parentOptions} onDone={closeForms} />
          </CardBody>
        </Card>
      ) : (
        <Box>
          <Button onClick={() => setAdding(true)}>Add category</Button>
        </Box>
      )}

      {tree.length === 0 ? (
        <EmptyState
          title={showingArchived ? "No categories" : "No active categories"}
          description="Add a category to classify your expenses."
        />
      ) : (
        <Card>
          <Stack gap="0" separator={<Box borderTopWidth="hairline" borderColor="line.soft" />}>
            {tree.map((parent) => (
              <Box key={parent.id}>
                <CategoryRow
                  category={parent}
                  isEditing={editingId === parent.id}
                  parentOptions={parentOptions}
                  pending={pending}
                  onEdit={() => setEditingId(parent.id)}
                  onDone={closeForms}
                  onArchive={() => run(() => archiveCategoryAction(parent.id))}
                  onRestore={() => run(() => restoreCategoryAction(parent.id))}
                />

                {parent.children.map((child) => (
                  <CategoryRow
                    key={child.id}
                    category={child}
                    isChild
                    isEditing={editingId === child.id}
                    parentOptions={parentOptions}
                    pending={pending}
                    onEdit={() => setEditingId(child.id)}
                    onDone={closeForms}
                    onArchive={() => run(() => archiveCategoryAction(child.id))}
                    onRestore={() => run(() => restoreCategoryAction(child.id))}
                  />
                ))}
              </Box>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

type CategoryRowProps = {
  category: CategoryView;
  isChild?: boolean;
  isEditing: boolean;
  parentOptions: readonly CategoryOption[];
  pending: boolean;
  onEdit: () => void;
  onDone: () => void;
  onArchive: () => void;
  onRestore: () => void;
};

function CategoryRow({
  category,
  isChild = false,
  isEditing,
  parentOptions,
  pending,
  onEdit,
  onDone,
  onArchive,
  onRestore,
}: CategoryRowProps) {
  /*
   * Editing happens **in place**, not in a modal (9.1). The row becomes an inset block on
   * `surface.sunken` — the same treatment every other in-card control group gets — so the form appears
   * exactly where the thing it edits was.
   */
  if (isEditing) {
    return (
      <Box
        bg="surface.sunken"
        paddingInline={{ base: "16px", md: "24px" }}
        paddingBlock={{ base: "16px", md: "20px" }}
        borderTopWidth={isChild ? "hairline" : undefined}
        borderColor="line.soft"
      >
        <Text textStyle="eyebrow" mb="16px">
          Editing {category.name}
        </Text>
        <CategoryForm parentOptions={parentOptions} category={category} onDone={onDone} />
      </Box>
    );
  }

  return (
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      minH="touch"
      paddingBlock={{ base: "13px", md: "16px" }}
      paddingInlineEnd={{ base: "16px", md: "24px" }}
      /*
        One level of indent, and only one. The data model allows exactly one level of nesting, so a
        single 24px step is the whole hierarchy — a tree control with expanders would be machinery for
        a depth of two.
      */
      paddingInlineStart={{
        base: isChild ? "40px" : "16px",
        md: isChild ? "48px" : "24px",
      }}
      borderTopWidth={isChild ? "hairline" : undefined}
      borderColor="line.soft"
    >
      <HStack gap="12px" flex="1" minW="0">
        {/*
          Colour from the category's **id**, glyph from its `icon` — one resolver, so this is the same
          square the activity row, the dashboard breakdown and the picker preview show. A child gets the
          smaller size, which is the second, quieter signal of the hierarchy.
        */}
        <CategorySwatch
          categoryId={category.id}
          icon={category.icon}
          size={isChild ? "sm" : "md"}
        />

        {/* The badge stacks below the name on a phone; `StatusBadge` cannot shrink. */}
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "stretch", md: "center" }}
          gap={{ base: "6px", md: "10px" }}
          minW="0"
        >
          <Text fontSize="row" fontWeight={isChild ? "500" : "600"} truncate>
            {category.name}
          </Text>
          {category.isArchived ? (
            <HStack gap="8px" flexShrink="0">
              <StatusBadge kind="archived" />
            </HStack>
          ) : null}
        </Flex>
      </HStack>

      <HStack gap="8px" flexShrink="0">
        {category.isArchived ? (
          <Button size="sm" tone="secondary" loading={pending} onClick={onRestore}>
            Restore
          </Button>
        ) : (
          <>
            <Button size="sm" tone="ghost" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" tone="ghost" loading={pending} onClick={onArchive}>
              Archive
            </Button>
          </>
        )}
      </HStack>
    </Flex>
  );
}
