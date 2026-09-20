"use client";

import { Box, HStack, List, Stack, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/Button";
import { useInstallPrompt } from "@/offline/hooks/useInstallPrompt";

/**
 * Invitation to install the app.
 *
 * Two shapes, because the platforms differ. Where the browser supports a programmatic
 * prompt there is a button. On iOS there is no event and no API, so the only honest thing
 * is to describe the Share menu — a button that cannot work would be worse than no button
 * (docs/13-MVP-TASK-GROUP.md group 16 requires iPhone installation, and this is the only
 * route Safari offers).
 *
 * Dismissible and remembered. Installation is a nicety; nagging about it on every visit
 * would make the app feel like it wants something from the user.
 */
export function InstallPrompt() {
  const { canPrompt, needsManualSteps, steps, install, dismiss, platform } = useInstallPrompt();

  if (!canPrompt && !needsManualSteps) return null;

  return (
    <Box borderBottomWidth="1px" borderColor="line" bg="surface.muted" px="4" py="3">
      <Stack maxW="content" mx="auto" w="full" gap="2">
        <HStack justify="space-between" align="flex-start" gap="3">
          <Box minW="0">
            <Text fontSize="sm" fontWeight="medium">
              Install Expense Tracker
            </Text>
            <Text fontSize="xs" color="content.muted">
              {/* The offline capability is the reason to install, so it leads. */}
              Add it to your home screen to open it faster and record expenses offline.
            </Text>
          </Box>

          <HStack gap="2" flexShrink="0">
            {canPrompt ? (
              <Button size="sm" onClick={() => void install()}>
                Install
              </Button>
            ) : null}
            <Button size="sm" tone="ghost" onClick={dismiss} aria-label="Dismiss install prompt">
              Not now
            </Button>
          </HStack>
        </HStack>

        {needsManualSteps ? (
          <List.Root as="ol" fontSize="xs" color="content.muted" ps="4" gap="0.5">
            {steps.map((step) => (
              <List.Item key={step}>{step}</List.Item>
            ))}
          </List.Root>
        ) : null}

        {needsManualSteps && platform === "ios" ? (
          <Text fontSize="xs" color="content.subtle">
            Safari is the only browser on iPhone that can add apps to the home screen.
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
