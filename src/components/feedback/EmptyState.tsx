import type { ReactNode } from "react";
import { Box, Stack, Text } from "@chakra-ui/react";

export type EmptyStateProps = {
  title: string;
  description?: string;
  /** Route to the next useful step, so an empty list is never a dead end. */
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Stack
      align="center"
      gap="2"
      textAlign="center"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="line"
      bg="surface"
      rounded="card"
      px="6"
      py="10"
    >
      <Text fontSize="sm" fontWeight="semibold">
        {title}
      </Text>
      {description ? (
        <Text fontSize="sm" color="content.muted" maxW="sm">
          {description}
        </Text>
      ) : null}
      {action ? <Box mt="2">{action}</Box> : null}
    </Stack>
  );
}
