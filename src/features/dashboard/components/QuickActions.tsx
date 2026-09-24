import { SimpleGrid } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import { QUICK_ADD_ACTIONS } from "@/components/layout/QuickAddActions";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";

/**
 * The four things a user comes here to record.
 *
 * "Add expense" is the primary action because it is by far the most frequent
 * (docs/04-USER-FLOWS.md). The other three are the record types that exist but are
 * easy to reach for by mistake, so each is named for the business event rather than
 * the mechanism: "Pay card", not "transfer to card".
 *
 * The list itself now comes from `components/layout/QuickAddActions.ts`, shared with the mobile
 * quick-add button added in group 31. Two controls offering the same four actions had two copies of
 * the labels and routes between them, which is how "Pay card" here becomes "Card payment" there.
 *
 * ## Desktop only
 *
 * `Mobile-Dashboard-Light.html` goes straight from the page header to the summary tiles: on a phone
 * these four actions are the quick-add button, and nothing else. Shipping both put eight controls for
 * four routes on one 393px screen. The row survives above `md`, where there is no floating button.
 */
export function QuickActions() {
  // `repeat(4, minmax(0, 1fr))` with a 16px gap, per section 8. No responsive column pair, because
  // desktop is the only width this renders at.
  return (
    <SimpleGrid hideBelow="md" columns={4} gap="3">
      {QUICK_ADD_ACTIONS.map((action) => (
        <AppLink key={action.href} href={action.href} textDecoration="none">
          {/*
            The leading glyph is the same one the mobile quick-add pill uses for this action, from the
            one shared list — so the two affordances for the same route cannot end up with different
            icons. `Button` has no `leadingIcon` prop by design (group 27): a child and a `gap` say it
            with no new API.
          */}
          <Button
            tone={action.primary ? "primary" : "secondary"}
            size="lg"
            fullWidth
            gap="7px"
            justifyContent="center"
          >
            <Icon name={action.icon} size="inline" />
            {action.label}
          </Button>
        </AppLink>
      ))}
    </SimpleGrid>
  );
}
