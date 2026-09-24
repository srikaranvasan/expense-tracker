import type { ReactNode } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { OfflineBanner } from "@/components/feedback/OfflineBanner";
import { InstallPrompt } from "@/features/pwa/components/InstallPrompt";
import { SyncStatusBar } from "@/features/sync/components/SyncStatusBar";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { QuickAdd } from "./QuickAdd";

export type AppShellProps = {
  user: { id: string; name: string; email: string };
  children: ReactNode;
};

/**
 * Application chrome.
 *
 * One component tree at two breakpoints rather than two navigation implementations: links live in the
 * header from `md` upwards and in the bottom bar below it (docs/04-USER-FLOWS.md section 2).
 *
 * The page background is plain `surface.muted` — the graph-paper grid belongs to the unauthenticated
 * layout only (5.5). An app you spend time in should not have a texture behind every screen.
 */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <Flex direction="column" minH="100dvh">
      <Box
        as="header"
        position="sticky"
        top="0"
        zIndex="sticky"
        // 2px full ink. In this design the header rule and the tab-bar rule are the two edges of the
        // frame, and both are drawn at full strength.
        borderBottomWidth="thick"
        borderColor="line"
        bg="surface"
      >
        <AppHeader user={user} />

        {/* Inside the sticky header so the notice stays visible while scrolling. */}
        <OfflineBanner />

        {/* Also the sync engine's mount point, so it starts exactly once per session. */}
        <SyncStatusBar userId={user.id} />

        {/* Last, because it is the least urgent thing in the header: an invitation, not a status.
            Renders nothing once installed or dismissed. */}
        <InstallPrompt />
      </Box>

      <Box
        as="main"
        id="main"
        maxW="content"
        mx="auto"
        w="full"
        flex="1"
        /*
         * 18px mobile, 40px desktop — the page gutters from section 8. Wider than the header's own,
         * because the header runs to the window edge and the content does not.
         */
        paddingInline={{ base: "18px", md: "40px" }}
        pt={{ base: "22px", md: "28px" }}
        /*
         * Clears both fixed things at the bottom of a phone screen: the 64px tab bar, the 20px gap
         * above it and the 52px quick-add button — 136px, plus the home-indicator inset the bar grows
         * by. The previous `28` (112px) left the last row of a page under the button.
         */
        pb={{ base: "calc(136px + env(safe-area-inset-bottom))", md: "60px" }}
      >
        {children}
      </Box>

      <BottomNav />

      {/* Fixed, and mounted here rather than in page content — see the comment in `QuickAdd.tsx`. */}
      <QuickAdd />
    </Flex>
  );
}
