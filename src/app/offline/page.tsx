import type { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import { OfflineNotice } from "@/features/pwa/components/OfflineNotice";

/**
 * Offline fallback, served by the service worker when a navigation fails and nothing is
 * cached for that URL.
 *
 * Deliberately outside both route groups. `(app)` would require a session — and a page
 * whose entire purpose is to work with no network cannot depend on a server call — while
 * `(auth)` would frame it as a sign-in screen. It is also in `PUBLIC_PATH_PREFIXES`, so
 * middleware does not redirect the service worker's precache request to /login and cache
 * the login page under this URL.
 */
export const metadata: Metadata = {
  title: "Offline",
  // Nothing here is worth indexing, and it must never be served as a search result for
  // the app itself.
  robots: { index: false, follow: false },
};

/**
 * Forced static so the precached copy is the same bytes every time. A dynamic render
 * would make the shipped fallback depend on whatever the server happened to return during
 * install.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <Box as="main" id="main" maxW="content" mx="auto" w="full" px="4" py="6">
      <OfflineNotice />
    </Box>
  );
}
