"use client";

import { Box, HStack, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/Button";
import { useServiceWorker } from "@/offline/hooks/useServiceWorker";

/**
 * Registers the service worker, and offers the reload when a new shell is waiting.
 *
 * Rendered once from the root layout — not from the authenticated shell — for two reasons:
 * the worker should be installed before sign-in so the very first offline visit already
 * works, and the sign-in page itself needs to be cached or an offline user sees the
 * browser's error page instead of ours.
 *
 * Renders nothing in the normal case. A service worker is infrastructure; the only time
 * the user should hear about it is when they need to act.
 */
export function ServiceWorkerManager() {
  const { updateReady, applyUpdate } = useServiceWorker();

  if (!updateReady) return null;

  return (
    <Box
      // Polite, not assertive: a pending update is information, and interrupting someone
      // mid-expense to announce it would be worse than the stale shell.
      role="status"
      aria-live="polite"
      bg="brand.muted"
      borderBottomWidth="1px"
      borderColor="line"
      px="4"
      py="2"
    >
      <HStack maxW="content" mx="auto" w="full" justify="space-between" gap="3">
        <Text fontSize="xs" color="brand.fg">
          A new version is ready. Your saved changes are not affected.
        </Text>

        {/*
          The reload is the user's choice. Applying it automatically would discard a
          half-entered expense, and the whole point of this app is not losing those.
        */}
        <Button size="sm" tone="ghost" onClick={applyUpdate}>
          Reload
        </Button>
      </HStack>
    </Box>
  );
}
