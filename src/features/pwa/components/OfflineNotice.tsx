"use client";

import NextLink from "next/link";
import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/Button";
import { useServerReachable } from "@/offline/hooks/useServerReachable";

/**
 * What the user sees when a page could not be reached and nothing was cached for it.
 *
 * The tone is set by docs/08-OFFLINE-SYNC.md section 49: offline is a fact, not an error.
 * So this reassures first — anything already saved is safe — and only then explains the
 * limitation. There is no red, no warning icon, and no exclamation mark.
 *
 * It reports recovery from `useServerReachable`, not from `navigator.onLine`. The
 * difference is the whole point: this page is only ever reached because a request failed,
 * and `onLine` is true on a device sitting behind a captive portal or pointed at a server
 * that is down. Announcing "back online" on the strength of a hint would contradict what
 * the user just experienced (section 15).
 */
export function OfflineNotice() {
  const { status, checking, check } = useServerReachable();

  const reachable = status === "reachable";

  return (
    <Stack gap="5" py="10" maxW="md" mx="auto" textAlign="center" align="center">
      <Box aria-hidden="true" fontSize="3xl">
        {/* Decorative only. The state is carried by the heading, never by the glyph or a
            colour alone (docs/06-CODING-PRACTICES.md section 40). */}
        {reachable ? "◍" : "◌"}
      </Box>

      <Stack gap="2">
        <Heading as="h1" size="lg">
          {reachable ? "You are back online" : "This page is not available offline"}
        </Heading>

        <Text fontSize="sm" color="content.muted">
          {reachable
            ? "The connection has returned. Anything saved on this device is syncing now."
            : "Anything you saved on this device is safe. It will sync automatically when you reconnect."}
        </Text>
      </Stack>

      {reachable ? null : (
        <Text fontSize="xs" color="content.subtle" maxW="sm">
          Pages you have already visited stay available. This one has not been opened on this device
          yet, so there is nothing stored to show.
        </Text>
      )}

      <Stack direction={{ base: "column", sm: "row" }} gap="3" pt="2">
        {reachable ? (
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
        ) : (
          // Re-probes rather than reloading: a reload while still offline would replace this
          // page with itself and tell the user nothing.
          <Button onClick={check} loading={checking}>
            Try again
          </Button>
        )}

        {/* asChild so the button renders as a real link: it navigates, and it can be
            opened in a new tab like any other. */}
        <Button tone="secondary" asChild>
          <NextLink href="/dashboard">Go to dashboard</NextLink>
        </Button>
      </Stack>
    </Stack>
  );
}
