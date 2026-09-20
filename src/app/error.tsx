"use client";

import { useEffect } from "react";
import { Box } from "@chakra-ui/react";
import { ErrorState } from "@/components/feedback/ErrorState";

/**
 * Boundary for the root segment.
 *
 * Catches a render failure on any page that is not inside the `(app)` group — sign-in,
 * register, the offline page. The root layout survives, so Chakra and the theme are still
 * available here.
 *
 * Errors inside the authenticated shell are caught closer to where they happen, by
 * `(app)/error.tsx`, which keeps the navigation on screen.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /*
     * Logged from the client because a client-side render failure never reaches the server
     * on its own. In production `error.message` is replaced by Next with a generic string
     * and only `digest` is meaningful — it matches the server log entry for the same failure
     * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 40).
     */
    console.error("Unhandled render error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <Box as="main" id="main" maxW="content" mx="auto" w="full" px="4" py="6">
      <ErrorState
        digest={error.digest}
        onRetry={reset}
        // Not the dashboard: an unauthenticated user landing here cannot reach it.
        homeHref="/"
        homeLabel="Start again"
      />
    </Box>
  );
}
