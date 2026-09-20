"use client";

import { useEffect } from "react";
import { Text } from "@chakra-ui/react";
import { ErrorState } from "@/components/feedback/ErrorState";

/**
 * Boundary for the authenticated shell.
 *
 * Placed inside the `(app)` group on purpose: the group's layout stays mounted, so a
 * failure on one screen leaves the header, the navigation and the sync status bar working.
 * The user can move to another screen instead of being stranded — which is what section 45
 * means by "a component crash should not destroy the entire application's usable state".
 *
 * It also means the sync engine keeps running, so anything queued offline continues to
 * upload while this is on screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled render error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <ErrorState
      title="This page could not be displayed"
      // Here the reassurance is accurate and worth making: local records are durable in
      // IndexedDB and the queue is untouched by a render failure.
      description="Your saved data is safe. Anything waiting to sync is still queued."
      digest={error.digest}
      onRetry={reset}
    >
      <Text fontSize="xs" color="content.subtle" maxW="sm">
        You can also use the navigation below to go somewhere else.
      </Text>
    </ErrorState>
  );
}
