"use client";

import { Box, HStack, List, Stack, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
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
    <Box
      // A bordered band across the chrome rather than a card: it belongs to the frame, like the
      // offline banner above it, so it takes the same full-ink rule.
      borderBottomWidth="thick"
      borderColor="line"
      bg="surface.muted"
      paddingInline={{ base: "16px", md: "32px" }}
      paddingBlock="12px"
    >
      <Stack maxW="content" mx="auto" w="full" gap="10px">
        <HStack justify="space-between" align="flex-start" gap="3">
          <HStack align="flex-start" gap="10px" minW="0">
            {/* Decorative: the heading beside it says the same thing. */}
            <Box color="content.muted" mt="2px">
              <Icon name="install" size="inline" />
            </Box>

            <Box minW="0">
              <Text fontFamily="heading" fontWeight="700" fontSize="row" color="content">
                Install Expense Tracker
              </Text>
              <Text fontSize="subtitle" color="content.subtle">
                {/* The offline capability is the reason to install, so it leads. */}
                Add it to your home screen to open it faster and record expenses offline.
              </Text>
            </Box>
          </HStack>

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
          // Mono and numbered: these are steps to follow in a menu, and a monospaced list reads as
          // instructions rather than prose.
          <List.Root
            as="ol"
            fontFamily="mono"
            fontSize="eyebrow"
            color="content.muted"
            ps="18px"
            gap="4px"
          >
            {steps.map((step) => (
              <List.Item key={step}>{step}</List.Item>
            ))}
          </List.Root>
        ) : null}

        {needsManualSteps && platform === "ios" ? (
          <Text fontSize="meta" color="content.subtle">
            Safari is the only browser on iPhone that can add apps to the home screen.
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
