import { HStack } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import { QUICK_ADD_ACTIONS } from "@/components/layout/QuickAddActions";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";

/**
 * "The other three record types", in a transaction form's page header.
 *
 * `AddExpense-Light.html` draws `Split instead · Transfer · Pay card` up there, and the reason is a
 * real failure mode: a user who has started typing an expense and then realises it was a transfer has
 * to be able to say so without going back to a menu. Every transaction form offers the other three.
 *
 * Reads `QUICK_ADD_ACTIONS` so the labels and glyphs match the dashboard row and the mobile quick-add
 * exactly — three places offering these four routes, one list.
 *
 * ## "Split instead", not "Split a bill"
 *
 * The one place the action label changes, and group 21 settled it (2.7). In a header beside a form you
 * have already begun, "instead" is the whole point of the control; on a dashboard with nothing in
 * progress there is no "instead" to speak of. The exception is narrow and named, rather than a free
 * hand to reword any of them.
 */

const SWITCH_LABELS: Record<string, string> = {
  "/transactions/new/shared": "Split instead",
};

export type FormSwitcherProps = {
  /** The form the user is already on, which is left out of its own switcher. */
  current: string;
};

export function FormSwitcher({ current }: FormSwitcherProps) {
  const others = QUICK_ADD_ACTIONS.filter((action) => action.href !== current);

  return (
    // Wraps rather than shrinking: three bordered buttons at 402px need two rows, and a squeezed
    // "Pay card" is the crushed-title bug again in miniature.
    <HStack gap="12px" wrap="wrap">
      {others.map((action) => (
        <AppLink key={action.href} href={action.href} textDecoration="none">
          <Button tone="secondary" size="md" gap="7px">
            <Icon name={action.icon} size="inline" />
            {SWITCH_LABELS[action.href] ?? action.label}
          </Button>
        </AppLink>
      ))}
    </HStack>
  );
}
