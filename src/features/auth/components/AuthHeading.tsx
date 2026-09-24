import { Box, Heading, Text } from "@chakra-ui/react";

/**
 * The eyebrow and title at the top of an auth card.
 *
 * `Login.html` draws `LEDGER ACCESS` in tracked teal mono above a 26px `Sign in`. Shared between the
 * two auth screens — and whatever third one arrives — so the pair cannot drift: the eyebrow is the
 * ledger framing and the heading is the page's `h1`, and getting either wrong on one screen and right
 * on the other is the kind of thing nobody notices until both are on a designer's monitor.
 *
 * The title is an `h1` deliberately. The product name above the card is a wordmark, not a heading
 * (see `app/(auth)/layout.tsx`): a page's `h1` should name the page.
 */

export type AuthHeadingProps = {
  /** Tracked mono above the title. Uppercased by the theme, so pass it in sentence case. */
  eyebrow: string;
  title: string;
};

export function AuthHeading({ eyebrow, title }: AuthHeadingProps) {
  return (
    <Box mb="28px">
      {/*
        `brand.fg`, not the eyebrow default of `content.muted` — the handoff draws this one in teal
        (`#1D7A6C`), which is the only eyebrow in the app that is not grey. `stamp` tracking (0.1em)
        rather than the eyebrow's 0.08em, also as drawn.
      */}
      <Text textStyle="eyebrow" color="brand.fg" letterSpacing="stamp">
        {eyebrow}
      </Text>

      <Heading
        as="h1"
        fontFamily="heading"
        fontWeight="700"
        /*
          26px at both widths. `pageTitleSm` is the mobile page-title step, but this is a heading
          inside a 440px card rather than a page header, and the artboard draws it at 26px on a
          1440px screen — so it does not grow.
        */
        fontSize="pageTitleSm"
        color="content"
        mt="8px"
      >
        {title}
      </Heading>
    </Box>
  );
}
