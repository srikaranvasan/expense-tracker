"use client";

import type { ReactNode } from "react";
import NextLink from "next/link";
import { Box, Code, Heading, Stack, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/Button";

export type ErrorStateProps = {
  title?: string;
  description?: string;
  /**
   * Next's error digest.
   *
   * In production the real message is stripped from a server error and replaced with this
   * hash — it is the *only* thing linking what the user saw to a line in the server log.
   * Showing it is not a technical leak; it is the difference between a bug report that can
   * be investigated and "it broke".
   */
  digest?: string;
  /** Retries the failed render. Provided by a Next error boundary as `reset`. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Where "safe ground" is. Defaults to the dashboard. */
  homeHref?: string;
  homeLabel?: string;
  children?: ReactNode;
};

/**
 * The shared presentation for a failed render.
 *
 * Every error boundary in the app renders this, so a crash looks the same wherever it
 * happens. Section 45 of docs/12-SECURITY-AND-ERROR-HANDLING.md asks for three things and
 * this provides exactly them: a friendly state, a retry, and a way back to safe ground.
 *
 * What it deliberately does **not** do is reassure the user that their data is fine. This
 * component does not know that. The boundaries that *do* know — the ones inside the
 * authenticated shell, where local records are already durable in IndexedDB — pass that
 * message in.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "The page could not be displayed. Nothing you have already saved is affected.",
  digest,
  onRetry,
  retryLabel = "Try again",
  homeHref = "/dashboard",
  homeLabel = "Go to dashboard",
  children,
}: ErrorStateProps) {
  return (
    <Stack
      // `alert` rather than `status`: a crashed screen is the one thing worth interrupting a
      // screen reader for.
      role="alert"
      gap="5"
      py="10"
      maxW="md"
      mx="auto"
      textAlign="center"
      align="center"
    >
      <Stack gap="2">
        <Heading as="h1" size="lg">
          {title}
        </Heading>
        <Text fontSize="sm" color="content.muted">
          {description}
        </Text>
      </Stack>

      {children}

      <Stack direction={{ base: "column", sm: "row" }} gap="3" pt="1">
        {onRetry ? <Button onClick={onRetry}>{retryLabel}</Button> : null}
        <Button tone="secondary" asChild>
          <NextLink href={homeHref}>{homeLabel}</NextLink>
        </Button>
      </Stack>

      {digest ? (
        <Box pt="2">
          <Text fontSize="xs" color="content.subtle">
            Reference for support
          </Text>
          {/* Selectable, so it can be copied into a bug report. */}
          <Code fontSize="xs" userSelect="all">
            {digest}
          </Code>
        </Box>
      ) : null}
    </Stack>
  );
}
