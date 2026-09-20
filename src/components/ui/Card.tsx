import type { ReactNode } from "react";
import { Box, DataList, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";

/**
 * Surface primitives.
 *
 * A thin wrapper over Box rather than Chakra's Card, because the project needs the
 * same surface treatment on panels, list containers and detail blocks, and one
 * definition keeps them identical.
 */

export type CardProps = BoxProps & { children: ReactNode };

export function Card({ children, ...rest }: CardProps) {
  return (
    <Box
      borderWidth="1px"
      borderColor="line"
      bg="surface"
      rounded="card"
      overflow="hidden"
      {...rest}
    >
      {children}
    </Box>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Flex
      align="flex-start"
      justify="space-between"
      gap="3"
      borderBottomWidth="1px"
      borderColor="line"
      p="4"
    >
      <Box minW="0">
        <Heading as="h2" size="sm" truncate>
          {title}
        </Heading>
        {subtitle ? (
          <Text mt="0.5" fontSize="xs" color="content.muted">
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {action}
    </Flex>
  );
}

export function CardBody({ children, ...rest }: CardProps) {
  return (
    <Box p="4" {...rest}>
      {children}
    </Box>
  );
}

/** Vertically divided list of rows inside a Card. */
export function CardList({ children }: { children: ReactNode }) {
  return (
    <Stack gap="0" separator={<Box borderTopWidth="1px" borderColor="line" />}>
      {children}
    </Stack>
  );
}

/**
 * Label/value pair for detail panels.
 *
 * Renders as a real description list so the label/value relationship is exposed
 * to assistive technology, and values use tabular figures so a column of amounts
 * lines up.
 */
export function DetailList({ children }: { children: ReactNode }) {
  return (
    <DataList.Root orientation="horizontal" gap="1.5">
      {children}
    </DataList.Root>
  );
}

export function DetailRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <DataList.Item justifyContent="space-between" gap="4">
      <DataList.ItemLabel fontSize="sm" color="content.muted" flex="none">
        {label}
      </DataList.ItemLabel>
      <DataList.ItemValue
        fontSize="sm"
        textStyle="amount"
        textAlign="end"
        justifyContent="flex-end"
        fontWeight={emphasis ? "semibold" : "normal"}
        color="content"
        flex="none"
      >
        {value}
      </DataList.ItemValue>
    </DataList.Item>
  );
}
