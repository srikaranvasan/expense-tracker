import type { ReactNode } from "react";
import { Box, Stack, Text } from "@chakra-ui/react";

export type EmptyStateProps = {
  title: string;
  /**
   * The heading level the title renders at. `h2` by default.
   *
   * Group 40 found the title was a `<p>`: the group 28 restyle replaced a `Heading` with a styled
   * `Text` and the visual result was identical, so nothing caught it. It matters twice over — a
   * screen-reader user navigating by heading skips straight past the only sentence on the page, and
   * on the two not-found pages that sentence *is* the page.
   *
   * `h2` is the default because most empty states sit under a `PageHeader`, which owns the `h1`. The
   * two not-found pages have no `PageHeader`, so they pass `h1`.
   */
  titleAs?: "h1" | "h2";
  description?: string;
  /**
   * A mono status line above the headline — `RECORD NOT FOUND`, `ERROR 404`.
   *
   * Added in group 35 for the two not-found pages, where the ledger register does the work a big
   * illustrated "404" would do in another design: it names the condition in the same voice as the
   * `AS OF` stamp and the end-of-list notice. Optional, because an empty *list* is not a condition —
   * it is just a list with nothing in it, and stamping it would overstate the case.
   */
  eyebrow?: string;
  /** Route to the next useful step, so an empty list is never a dead end. */
  action?: ReactNode;
};

/**
 * An empty list, said plainly.
 *
 * Restyled in group 28 (section 7.6): headline in Space Grotesk, description in Manrope, a primary
 * action.
 *
 * ## The border is solid, not dashed
 *
 * It was dashed before, which is a common convention for an empty container and is wrong here:
 * **a dashed border is this design's stamp motif** (5.4), reserved for rotated status
 * confirmations. Using it for an empty list would mean the one place dashes appear is no longer the
 * one place dashes mean something. So this is an ordinary container card — `1.5px` at `line.card`,
 * no shadow — and the emptiness is carried by the words and the generous padding.
 *
 * It is deliberately **not** a `Card`: an empty state is centred text rather than a surface holding
 * rows, and reusing `Card` would invite someone to put a `CardHeader` on it.
 */
export function EmptyState({
  title,
  titleAs = "h2",
  description,
  eyebrow,
  action,
}: EmptyStateProps) {
  return (
    <Stack
      align="center"
      gap="10px"
      textAlign="center"
      bg="surface"
      borderWidth="thin"
      borderStyle="solid"
      borderColor="line.card"
      paddingInline={{ base: "20px", md: "24px" }}
      paddingBlock={{ base: "32px", md: "40px" }}
    >
      {eyebrow ? (
        <Text textStyle="eyebrow" letterSpacing="stamp" color="content.subtle">
          {eyebrow}
        </Text>
      ) : null}

      <Text
        as={titleAs}
        fontFamily="heading"
        fontWeight="700"
        fontSize={{ base: "control", md: "cardTitle" }}
        // Explicit rather than inherited. It would inherit correctly from the body, but a heading
        // that depends on an ancestor is a heading that goes wrong the first time this is rendered
        // inside a tinted panel.
        color="content"
      >
        {title}
      </Text>

      {description ? (
        <Text
          fontSize={{ base: "subtitle", md: "control" }}
          color="content.subtle"
          // Roughly 60 characters, which is where a centred paragraph stops being easy to read.
          maxW="46ch"
        >
          {description}
        </Text>
      ) : null}

      {action ? <Box pt="6px">{action}</Box> : null}
    </Stack>
  );
}
