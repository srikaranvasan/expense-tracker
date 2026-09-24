import type { ReactNode } from "react";
import NextLink from "next/link";
import { Link } from "@chakra-ui/react";
import type { LinkProps } from "@chakra-ui/react";

/**
 * Chakra-styled links that navigate with the Next.js router.
 *
 * `asChild` hands the rendering to `next/link`, so client-side navigation and prefetching still
 * work while the styling comes from the theme.
 *
 * Three shapes, because the design uses links for three different jobs and they look nothing
 * alike: inline text, a card's corner action, and a whole list row.
 */

export type AppLinkProps = Omit<LinkProps, "href"> & {
  href: string;
  children: ReactNode;
};

/**
 * An inline text link.
 *
 * `brand.fg` — the darker teal, not the fill — and underlined. The underline is not optional:
 * `brand.fg` against body text is a colour difference, and a link identified by colour alone
 * fails WCAG 1.4.1 for anyone who cannot see the hue (docs/06-CODING-PRACTICES.md section 40).
 *
 * Focus is the teal offset shadow, as everywhere else. A link has no border to promote, so
 * without this it would have no focus indicator at all once the theme's reset removes Chakra's.
 */
export function AppLink({ href, children, ...rest }: AppLinkProps) {
  return (
    <Link
      asChild
      color="brand.fg"
      fontWeight="600"
      textDecoration="underline"
      textUnderlineOffset="3px"
      outline="none"
      _hover={{ color: "brand.fg", textDecoration: "underline" }}
      _focusVisible={{ boxShadow: "hardFocus" }}
      {...rest}
    >
      <NextLink href={href}>{children}</NextLink>
    </Link>
  );
}

/**
 * The action in a card's header — "See all", "Add category".
 *
 * Section 7.3 is specific that this is **a mono uppercase link, not a button**, and the
 * distinction is worth keeping: a card header with a button in it competes with the primary
 * action of the page, while a tracked mono label reads as a quiet way onward.
 *
 * Not underlined at rest, unlike `AppLink`. It is safe here because the eyebrow treatment —
 * mono, uppercase, tracked — already makes it visually distinct from the body copy around it, so
 * colour is not the only signal. The underline appears on hover and focus.
 */
export function CardActionLink({ href, children, ...rest }: AppLinkProps) {
  return (
    <Link
      asChild
      textStyle="eyebrow"
      color="brand.fg"
      textDecoration="none"
      outline="none"
      // Keeps a small target comfortable to hit without adding visible padding to the card.
      minH="touch"
      display="inline-flex"
      alignItems="center"
      /*
       * Never wraps, and never gives up its width to a long title. At 393px "VIEW ALL" broke across
       * two lines beside "Spending in September 2026", which made the header look like it had a
       * two-line action in it.
       */
      whiteSpace="nowrap"
      flexShrink="0"
      _hover={{ color: "brand.fg", textDecoration: "underline", textUnderlineOffset: "4px" }}
      _focusVisible={{ boxShadow: "hardFocus", textDecoration: "underline" }}
      {...rest}
    >
      <NextLink href={href}>{children}</NextLink>
    </Link>
  );
}

/**
 * Full-width row that behaves as a link.
 *
 * Used by list rows: the whole row is the target, which is far easier to hit on a phone than a
 * small text link inside it.
 *
 * No underline and no link colour, because the row's *content* is the label — an account name
 * and its balance — and underlining all of it would be unreadable. The affordance is the row
 * itself, which is why the hover fill and the focus shadow both apply to the whole row.
 */
export function RowLink({ href, children, ...rest }: AppLinkProps) {
  return (
    <Link
      asChild
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="4"
      minH="touch"
      // 16px 24px desktop, 13px 16px mobile — the `CardList` row padding from section 7.3.
      paddingInline={{ base: "16px", md: "24px" }}
      paddingBlock={{ base: "13px", md: "16px" }}
      textDecoration="none"
      color="content"
      outline="none"
      _hover={{ bg: "surface.sunken", textDecoration: "none" }}
      // Inset, so the shadow does not spill over the row above and below it inside a card.
      _focusVisible={{ boxShadow: "hardFocus", zIndex: "1", position: "relative" }}
      {...rest}
    >
      <NextLink href={href}>{children}</NextLink>
    </Link>
  );
}
