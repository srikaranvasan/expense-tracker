"use client";

import { Box, Text } from "@chakra-ui/react";
import { useIsOffline } from "@/offline/hooks/useConnectivity";

/**
 * Tells the user they are offline, without alarming them.
 *
 * The wording matters. "Offline — changes are saved on this device" is a statement of
 * fact that invites the user to carry on; "NETWORK ERROR" implies their work is at risk
 * and stops them (docs/08-OFFLINE-SYNC.md sections 21 and 49).
 *
 * Renders nothing when online, so the sync machinery stays invisible in the normal case.
 */
export function OfflineBanner() {
  const offline = useIsOffline();

  if (!offline) return null;

  return (
    <Box
      // Announced by screen readers when it appears, but not urgently: nothing is
      // broken, and interrupting the user's current task would be wrong.
      role="status"
      aria-live="polite"
      bg="warning.surface"
      borderBottomWidth="1px"
      borderColor="line"
      px="4"
      py="2"
    >
      <Text fontSize="xs" color="warning" fontWeight="medium" textAlign="center">
        Offline — changes are saved on this device and will sync when you reconnect.
      </Text>
    </Box>
  );
}
