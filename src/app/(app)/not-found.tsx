import NextLink from "next/link";
import { Heading, Stack, Text } from "@chakra-ui/react";
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
 */
export default function AppNotFound() {
  return (
    <Stack gap="5" py="10" maxW="md" mx="auto" textAlign="center" align="center">
      <Stack gap="2">
        <Heading as="h1" size="lg">
          This record was not found
        </Heading>
        <Text fontSize="sm" color="content.muted">
          It may have been deleted, possibly on another device. Nothing else has been affected.
        </Text>
      </Stack>

      <Button asChild>
        <NextLink href="/transactions">Back to transactions</NextLink>
      </Button>
    </Stack>
  );
}
