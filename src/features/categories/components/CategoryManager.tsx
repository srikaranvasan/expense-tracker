"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
          <Stack gap="0" separator={<Box borderTopWidth="1px" borderColor="line" />}>
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
  if (isEditing) {
    return (
      <Box
        p="4"
        bg="surface.sunken"
        borderTopWidth={isChild ? "1px" : undefined}
        borderColor="line"
      >
        <Text mb="3" fontSize="sm" fontWeight="medium">
          Edit “{category.name}”
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
      py="3"
      pe="4"
      // Children are indented so the hierarchy is visible without a tree control.
      ps={isChild ? "10" : "4"}
      borderTopWidth={isChild ? "1px" : undefined}
      borderColor="line"
    >
      <Text fontSize="sm" fontWeight={isChild ? "normal" : "medium"} truncate>
        {category.name}
        {category.isArchived ? (
          <Badge ml="2" variant="subtle" bg="surface.sunken" color="content.muted">
            Archived
          </Badge>
        ) : null}
      </Text>

      <HStack gap="1" flexShrink="0">
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
