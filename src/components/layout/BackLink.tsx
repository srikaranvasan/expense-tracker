import NextLink from "next/link";
import { Link } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";

/**
 * The one hop upward, above a page title.
 *
 * ## Why this exists
 *
 * Before group 43 the application had **no back affordance of any kind** — no back button, no
 * breadcrumb, and no page that named its own parent
 * (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 3). Fifteen of twenty-eight screens had
 * no on-screen way back to where they came from, and three could not be left at all except by the
 * browser's own back button. This is the primitive that closes all of them.
 *
 * ## Why it is a link and never `router.back()`
 *
 * This is the whole design, so it is worth being blunt about it: **there is no history call
 * anywhere in this component.** It navigates to a fixed `href`, which makes it behave identically
 * whether the user clicked in from a list, followed a shared URL, refreshed the page, or arrived
 * from the quick-add button on some unrelated screen.
 *
 * `router.back()` is the thing being replaced. It was the app's only upward affordance (via
 * `FormActions`' Cancel) and it fails in three ordinary situations — a cold URL with no history, a
 * refresh, and the floating quick-add which is present on every authenticated screen and therefore
 * can send Cancel back to anywhere at all (audit 4.3). A hierarchy link has no such failure mode.
 *
 * A real anchor also means it middle-clicks, opens in a new tab, and shows a destination in the
 * status bar — none of which a button pretending to be navigation can do.
 *
 * ## The two names
 *
 * ```text
 * visible          [‹] ACCOUNTS
 * accessible name  "Back to Accounts"
 * ```
 *
 * Both, deliberately (group 42 section 3.4). The visible form is compact and conventional, and
 * does not spend a phone's header width on the word "Back". But a screen-reader user hearing a
 * flat list of links needs each one to stand alone, and "Accounts" alone does not say it goes
 * anywhere — so the accessible name prefixes it.
 *
 * This satisfies WCAG 2.5.3 *Label in Name*: the visible string is contained in the accessible
 * name, so speech input ("click Accounts") still activates it. Doing it the other way round —
 * visible "Back", name "Accounts" — would fail that criterion.
 *
 * ## Why it reuses `CardActionLink`'s register but not its code
 *
 * Mono, uppercase, tracked, `brand.fg`, no underline at rest. The argument in `AppLink.tsx` for
 * the card action applies unchanged: a bordered button here would compete with the page header's
 * own primary action ("Edit", "Settle up", "Pay card"), while the eyebrow treatment reads as a
 * quiet way onward.
 *
 * It does not *wrap* `CardActionLink`, because it needs a leading glyph and its own
 * accessible-name rule, and threading both through that component would make its contract worse
 * for the eight callers that do not want either. What is shared is `textStyle="eyebrow"` — a
 * token, which is the right unit of sharing for a visual register.
 */

export type BackLinkProps = {
  /** Where "up" goes. A route, not a history offset. */
  href: string;
  /**
   * The destination's own name — "Accounts", or a record's name on an edit form.
   *
   * Matches the nav item's wording exactly where the parent is a nav destination, so the back
   * link and the tab bar cannot describe the same place differently.
   */
  label: string;
};

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      asChild
      textStyle="eyebrow"
      color="brand.fg"
      display="inline-flex"
      alignItems="center"
      gap="5px"
      // Comfortable to hit without adding visible padding above the page title. The row it sits in
      // is only as tall as this, so `minH` here sets the row's height too.
      minH="touch"
      textDecoration="none"
      outline="none"
      /*
       * Never wraps. At 402px a long record name beside a chevron could break onto a second line,
       * and a two-line back link reads as a heading rather than a control. It truncates instead —
       * the accessible name carries the full destination either way.
       */
      whiteSpace="nowrap"
      minW="0"
      _hover={{ color: "brand.fg", textDecoration: "underline", textUnderlineOffset: "4px" }}
      _focusVisible={{ boxShadow: "hardFocus", textDecoration: "underline" }}
    >
      <NextLink href={href} aria-label={`Back to ${label}`}>
        {/*
          `aria-hidden` by default, from `Icon`. The chevron is the conventional signal for "up and
          out" and carries no information the accessible name does not already state.
        */}
        <Icon name="chevron-left" size="inline" />
        {/*
          `truncate` on the text and not on the link, so the chevron keeps its full 14px when a
          record name is too long for the width.
        */}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {label}
        </span>
      </NextLink>
    </Link>
  );
}
