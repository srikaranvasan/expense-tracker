import NextLink from "next/link";
import { Box } from "@chakra-ui/react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/Button";

/**
 * "Not found" inside the authenticated shell.
 *
 * `notFound()` resolves to the nearest `not-found.tsx`, so this catches the calls that
 * matter most in practice: a detail page for a record that no longer exists. Because it sits
 * inside the `(app)` group, the header and navigation stay on screen and the user can move
 * on with one tap instead of being sent back to the dashboard.
 *
 * The wording leads with deletion rather than with the URL. Opening a link to an expense
 * that was removed on another device is the ordinary way to arrive here, and it is not a
 * mistake the user made.
 *
 * Restyled in group 35 onto `EmptyState` rather than a hand-rolled stack. The eyebrow does the work a
 * large illustrated "404" would do elsewhere — in the ledger register, and in the same voice as the
 * `AS OF` stamp and the end-of-list notice. There is no artboard for this screen.
 */
export default function AppNotFound() {
  return (
    <Box as="section" maxW="46rem" mx="auto" paddingBlock={{ base: "22px", md: "40px" }}>
      <EmptyState
        eyebrow="Record not found"
        title="This record was not found"
        // No `PageHeader` on this route either, so this is the page's `h1`.
        titleAs="h1"
        description="It may have been deleted, possibly on another device. Nothing else has been affected."
        action={
          <Button asChild>
            <NextLink href="/transactions">Back to transactions</NextLink>
          </Button>
        }
      />
    </Box>
  );
}
