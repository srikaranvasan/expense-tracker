import type { ReactNode } from "react";
import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { publicConfig } from "@/config/env";
import { OfflineBanner } from "@/components/feedback/OfflineBanner";
import { AppLink } from "@/components/ui/AppLink";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { InstallPrompt } from "@/features/pwa/components/InstallPrompt";
import { SyncStatusBar } from "@/features/sync/components/SyncStatusBar";
import { BottomNav } from "./BottomNav";

export type AppShellProps = {
  user: { id: string; name: string; email: string };
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/transactions", label: "Activity" },
  { href: "/accounts", label: "Accounts" },
  { href: "/people", label: "People" },
  { href: "/categories", label: "Categories" },
] as const;

/**
 * Application chrome.
 *
 * One component tree at two breakpoints rather than two navigation
 * implementations: links live in the header from `md` upwards and in the bottom bar
 * below it (docs/04-USER-FLOWS.md section 2).
 */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <Flex direction="column" minH="100dvh">
      <Box
        as="header"
        position="sticky"
        top="0"
        zIndex="sticky"
        borderBottomWidth="1px"
        borderColor="line"
        bg="surface"
      >
        <Flex
          maxW="content"
          mx="auto"
          w="full"
          align="center"
          justify="space-between"
          gap="3"
          px="4"
          py="3"
        >
          <HStack gap="6">
            <Text fontSize="md" fontWeight="semibold">
              {publicConfig.appName}
            </Text>

            <HStack as="nav" aria-label="Primary" gap="4" hideBelow="md">
              {NAV_ITEMS.map((item) => (
                <AppLink
                  key={item.href}
                  href={item.href}
                  fontSize="sm"
                  color="content.muted"
                  textDecoration="none"
                  _hover={{ color: "brand.fg" }}
                >
                  {item.label}
                </AppLink>
              ))}
            </HStack>
          </HStack>

          <HStack gap="3">
            <Text fontSize="sm" color="content.muted" hideBelow="sm" title={user.email}>
              {user.name}
            </Text>
            <SignOutButton />
          </HStack>
        </Flex>

        {/* Inside the sticky header so the notice stays visible while scrolling. */}
        <OfflineBanner />

        {/* Also the sync engine's mount point, so it starts exactly once per session. */}
        <SyncStatusBar userId={user.id} />

        {/* Last, because it is the least urgent thing in the header: an invitation, not a
            status. Renders nothing once installed or dismissed. */}
        <InstallPrompt />
      </Box>

      <Box
        as="main"
        id="main"
        maxW="content"
        mx="auto"
        w="full"
        flex="1"
        px="4"
        pt="4"
        // Leaves room for the fixed bottom navigation on phones.
        pb={{ base: "24", md: "8" }}
      >
        {children}
      </Box>

      <BottomNav />
    </Flex>
  );
}
