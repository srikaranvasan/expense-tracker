import type { Metadata } from "next";
import NextLink from "next/link";
import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { Button } from "@/components/ui/Button";

/**
 * 404 page.
 *
 * Reached by an unknown URL, and by any `notFound()` call that is not caught by a closer
 * boundary. Without this the user gets Next's built-in page, which is unstyled and offers no
 * way onward.
 *
 * A server component: there is nothing interactive here beyond a link, and nothing to
 * recover from.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Box as="main" id="main" maxW="content" mx="auto" w="full" px="4" py="6">
      <Stack gap="5" py="10" maxW="md" mx="auto" textAlign="center" align="center">
        <Stack gap="2">
          <Heading as="h1" size="lg">
            Page not found
          </Heading>
          <Text fontSize="sm" color="content.muted">
            {/*
              Worth being explicit about deletion: a record that was removed on another device
              is a normal way to arrive here, and "not found" on its own reads like a fault.
            */}
            This page does not exist. If you followed a link to a record, it may have been deleted.
          </Text>
        </Stack>

        <Button asChild>
          <NextLink href="/dashboard">Go to dashboard</NextLink>
        </Button>
      </Stack>
    </Box>
  );
}
