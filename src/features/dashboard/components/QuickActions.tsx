import { SimpleGrid } from "@chakra-ui/react";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";

/**
 * The four things a user comes here to record.
 *
 * "Add expense" is the primary action because it is by far the most frequent
 * (docs/04-USER-FLOWS.md). The other three are the record types that exist but are
 * easy to reach for by mistake, so each is named for the business event rather than
 * the mechanism: "Pay card", not "transfer to card".
 */
export function QuickActions() {
  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} gap="3">
      <AppLink href="/transactions/new" textDecoration="none">
        <Button fullWidth>Add expense</Button>
      </AppLink>
      <AppLink href="/transactions/new/shared" textDecoration="none">
        <Button tone="secondary" fullWidth>
          Split a bill
        </Button>
      </AppLink>
      <AppLink href="/transactions/new/transfer" textDecoration="none">
        <Button tone="secondary" fullWidth>
          Transfer
        </Button>
      </AppLink>
      <AppLink href="/transactions/new/card-payment" textDecoration="none">
        <Button tone="secondary" fullWidth>
          Pay card
        </Button>
      </AppLink>
    </SimpleGrid>
  );
}
