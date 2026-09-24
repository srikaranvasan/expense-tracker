"use client";

import { Box, HStack, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/Button";
import { useSyncStatus } from "@/offline/hooks/useSyncStatus";
import { describeSyncState } from "@/offline/sync/sync-status";

export type SyncStatusBarProps = {
  userId: string;
};

/**
 * Sync state, and the engine's mount point.
 *
 * Two rules from `docs/08-OFFLINE-SYNC.md` section 21 shape this:
 *
 * 1. **The sync UI must not dominate the app.** When everything is synced this renders
 *    nothing at all. Offline shows a quiet line; only a rejected change gets a colour and
 *    a button.
 * 2. **Offline is not an error.** "Offline · will sync later" is a statement of fact. A
 *    user recording expenses on the underground has nothing to fix.
 *
 * Mounting `useSyncStatus` here is what actually starts the engine, so this component
 * must be rendered exactly once, in the shell.
 */
export function SyncStatusBar({ userId }: SyncStatusBarProps) {
  const { status, retryFailed } = useSyncStatus(userId);

  // Nothing to say. The common case should be invisible.
  if (status.state === "synced") return null;

  const needsAttention = status.state === "attention";

  return (
    <Box
      role="status"
      aria-live="polite"
      bg={needsAttention ? "negative.surface" : "surface.sunken"}
      borderBottomWidth="1px"
      borderColor="line"
      px="4"
      py="1.5"
    >
      <HStack maxW="content" mx="auto" w="full" justify="space-between" gap="3">
        {/*
         * `content.onSwatch` on the coral fill, not `negative`.
         *
         * Coral text on a coral fill measures 3.2:1 in light mode and 1.1:1 in dark, where both
         * token and fill lighten together. The fill is the signal here; the words only have to be
         * readable. Group 40.
         */}
        <Text fontSize="xs" color={needsAttention ? "content.onSwatch" : "content.muted"}>
          {describeSyncState(status)}
          {status.state === "syncing" && status.pending > 0 ? ` · ${status.pending} queued` : ""}
        </Text>

        {needsAttention ? (
          // Same reason, for the same fill: `ghost` labels itself `content`, which inverts in dark
          // mode and would leave a near-white label on bright coral.
          <Button size="sm" tone="ghost" color="content.onSwatch" onClick={retryFailed}>
            Try again
          </Button>
        ) : null}
      </HStack>
    </Box>
  );
}
