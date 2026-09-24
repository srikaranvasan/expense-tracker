import type { Metadata } from "next";
import NextLink from "next/link";
import { Box } from "@chakra-ui/react";
import { EmptyState } from "@/components/feedback/EmptyState";
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
 *
 * Outside the `(app)` group, so there is no header or navigation — which is why it carries its own
 * `main#main` for `SkipToContent`, and why the way onward is the dashboard rather than a list.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Box
      as="main"
      id="main"
      maxW="46rem"
      mx="auto"
      w="full"
      paddingInline={{ base: "16px", md: "40px" }}
      paddingBlock={{ base: "40px", md: "72px" }}
    >
      <EmptyState
        eyebrow="Error 404"
        title="Page not found"
        // No `PageHeader` on this route, so the empty state's title is the page's `h1`.
        titleAs="h1"
        /*
          Worth being explicit about deletion: a record that was removed on another device is a
          normal way to arrive here, and "not found" on its own reads like a fault.
        */
        description="This page does not exist. If you followed a link to a record, it may have been deleted."
        action={
          <Button asChild>
            <NextLink href="/dashboard">Go to dashboard</NextLink>
          </Button>
        }
      />
    </Box>
  );
}
