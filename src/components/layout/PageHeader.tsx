import type { ReactNode } from "react";
import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { BackLink } from "./BackLink";

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Buttons or links. Stacks below the title at mobile widths — see the note below. */
  action?: ReactNode;
  /**
   * A quiet note on the far side of the title.
   *
   * Built for the dashboard's `AS OF 21 SEP 2026, 06:00` eyebrow, which is a *render timestamp* and
   * nothing more. It is deliberately separate from `action`: this side of the header is not
   * interactive, and putting a timestamp where a button goes would make it look like one.
   */
  meta?: ReactNode;
  /**
   * Where "up" goes. Renders a `BackLink` above the title.
   *
   * Optional, and genuinely so — the five nav destinations and the two `(app)` boundary screens have
   * no parent. Unlike `FormActions.onCancel`, which is required because a form without a way out is
   * always a bug, a page without a parent is a real case here.
   *
   * For a record's child page the label is the record's name, so `/accounts/[id]/edit` reads
   * `‹ HDFC SAVINGS` rather than `‹ ACCOUNTS`: one hop, to the thing being edited.
   */
  parent?: { href: string; label: string };
};

/**
 * The title block at the top of a page.
 *
 * ## The stacking is a bug fix, not a preference
 *
 * `direction={{ base: "column", md: "row" }}` on the **title row** is half the fix for the
 * **crushed mobile title** (`docs/design-tasks/01-DESIGN-SYSTEM.md` 9.2). At 402px, a title and an
 * action button sharing a row left the title about 150px, so "Record shared expense" wrapped to one
 * word per line. Below 768px they are now stacked, and the title gets the full width.
 *
 * The other half is the slim mobile header in `AppHeader`, which no longer contributes a wide text
 * button of its own.
 *
 * ## Why the parent link is in a wrapper and not in the title row
 *
 * Group 44 added `parent`, and where it goes was the only real decision in that group.
 *
 * It is **not** a child of the title row, because that row is `align="baseline"` on desktop and
 * baseline alignment uses each flex item's *first* baseline. Putting the back link above the
 * heading inside the title's `Box` would make the back link's baseline the one that `meta` and
 * `action` align to — so the dashboard's `AS OF` eyebrow would line up with the back link instead
 * of with the title. Measured before choosing; it is a visible 20px drop on desktop.
 *
 * So the component is now an outer `Stack` (always a column) holding the optional back link and
 * then the title row. The row keeps its responsive direction, its baseline alignment and its
 * `space-between` untouched, which is what keeps the crushed-title fix intact.
 *
 * The `mb` moved to the outer `Stack`, so the 22px/28px gap between a page header and the first
 * block below it is measured from the whole header — unchanged whether or not there is a parent.
 */
export function PageHeader({ title, description, action, meta, parent }: PageHeaderProps) {
  return (
    <Stack
      as="header"
      // The back link sits close to the title it belongs to: tighter than the app's 16/24px block
      // rhythm, because these two are one unit.
      gap={{ base: "8px", md: "10px" }}
      // 22px mobile, 28px desktop — the gap between a page header and the first block (section 8).
      mb={{ base: "22px", md: "28px" }}
    >
      {/*
        First in the DOM, and therefore announced before the `h1`. That is the point of putting it
        inside the `header` element rather than above it: a screen-reader user reaches "Back to
        Accounts" as part of the page's header landmark, not as stray content preceding it.
      */}
      {parent ? <BackLink href={parent.href} label={parent.label} /> : null}

      <Flex
        direction={{ base: "column", md: "row" }}
        // `baseline` on desktop so the eyebrow sits on the title's baseline rather than floating above
        // it; `flex-start` when stacked, where a baseline has nothing to align to.
        align={{ base: "flex-start", md: "baseline" }}
        justify="space-between"
        gap={{ base: "3", md: "6" }}
      >
        <Box minW="0">
          <Heading
            as="h1"
            fontFamily="heading"
            fontWeight="700"
            fontSize={{ base: "pageTitleSm", md: "pageTitle" }}
            color="content"
            lineHeight="1.15"
          >
            {title}
          </Heading>

          {description ? (
            <Text mt="6px" fontSize={{ base: "subtitle", md: "control" }} color="content.muted">
              {description}
            </Text>
          ) : null}
        </Box>

        {meta ? <Box flexShrink="0">{meta}</Box> : null}

        {/*
          `flex-shrink: 0` so the action keeps its full width on desktop. When stacked it is already on
          its own line, so nothing competes with it.
        */}
        {action ? <Box flexShrink="0">{action}</Box> : null}
      </Flex>
    </Stack>
  );
}
