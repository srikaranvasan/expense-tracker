import type { ReactNode } from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";

export type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <Flex as="header" align="flex-start" justify="space-between" gap="3" mb="4">
      <Box minW="0">
        <Heading as="h1" size="lg">
          {title}
        </Heading>
        {description ? (
          <Text mt="0.5" fontSize="sm" color="content.muted">
            {description}
          </Text>
        ) : null}
      </Box>
      {action ? <Box flexShrink="0">{action}</Box> : null}
    </Flex>
  );
}
