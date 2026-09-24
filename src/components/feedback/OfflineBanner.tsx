"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
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
      // Full-strength ink, matching the header's own bottom rule: this is a band across the chrome,
      // not a card, so it should read as part of the frame.
      borderBottomWidth="thick"
      borderColor="line"
      paddingInline="16px"
      paddingBlock="8px"
    >
      <Flex align="center" justify="center" gap="8px" color="content.onSwatch">
        {/* Ink on butter in both modes, like anything drawn on one of the five fills. */}
        <Icon name="offline" size="inline" />
        <Text fontFamily="mono" fontSize="eyebrow" letterSpacing="badge" fontWeight="500">
          Offline — changes are saved on this device and will sync when you reconnect.
        </Text>
      </Flex>
    </Box>
  );
}
