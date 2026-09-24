import { Flex, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

/**
 * A small bordered chip stating what a record is, or where it stands.
 *
 * Section 7.4. Five kinds, and the list is closed on purpose: a badge that can say anything says
 * nothing, and an activity list where every row carries a different chip is noise rather than
 * structure.
 *
 * Three families live here and they are worth distinguishing when reading a row:
 *
 * - **Settlement status** — `settled`, `partSettled`. These are *derived*, recomputed on load like
 *   every other number in this app (9.1). Nothing caches them.
 * - **Record type** — `split`, `transfer`, `cardPayment`. These are facts about the record.
 * - **Account condition** — `overLimit`. Added in group 34 for the dashboard's account rows.
 *
 * There is deliberately no `unsettled` badge. An unsettled split is the default state of a shared
 * expense, and badging the normal case would put a chip on almost every row in the list.
 */

export type StatusBadgeKind =
  "settled" | "partSettled" | "split" | "transfer" | "cardPayment" | "overLimit" | "archived";

type BadgeStyle = {
  label: string;
  bg: string;
  icon: IconName;
  /**
   * Overrides the ink-in-both-modes foreground.
   *
   * Only `archived` needs it. Every other fill is one of the five swatch colours, which are bright in
   * both palettes; `surface.sunken` is not — it is paper in light mode and `darkPaper` in dark — so
   * fixed ink on it would vanish the moment the theme flipped.
   */
  fg?: string;
};

/**
 * Every fill here **except `archived`** is one of the five swatch colours, so the ink foreground is
 * safe in both colour modes (measured 7.1:1 to 13.4:1). That is not true of the *tints* — see
 * `components/feedback/Alert.tsx` for the case where it was not.
 *
 * Labels are sentence-cased here and uppercased by `textStyle="badge"`, so the accessible name stays
 * "Card payment" rather than "C A R D   P A Y M E N T".
 */
const BADGES: Record<StatusBadgeKind, BadgeStyle> = {
  settled: { label: "Settled", bg: "positive.surface", icon: "check" },
  partSettled: { label: "Part settled", bg: "warning.surface", icon: "alert-triangle" },
  /** "Split", not "Shared expense" — the type label decided in group 21 section 3.10. */
  split: { label: "Split", bg: "brand.solid", icon: "split" },
  transfer: { label: "Transfer", bg: "info.surface", icon: "transfer" },
  /** "Card payment" as a type label; "Pay card" is the *action* label. */
  cardPayment: { label: "Card payment", bg: "info.surface", icon: "card" },
  /**
   * A credit card carrying more than its limit.
   *
   * Its own kind rather than reusing `partSettled`, which happens to share the butter fill and the
   * triangle: `kind` names the *meaning*, and an account condition relabelled as a settlement state
   * would be a lie the label override could not fix.
   */
  overLimit: { label: "Over limit", bg: "warning.surface", icon: "alert-triangle" },
  /**
   * A record withdrawn from use but not deleted.
   *
   * The one quiet badge, and deliberately so: archiving is a housekeeping state, not news. It is the
   * only kind that does **not** sit on a swatch fill, which is why it carries its own foreground —
   * see `fg` above.
   */
  archived: {
    label: "Archived",
    bg: "surface.sunken",
    icon: "archive",
    fg: "content.subtle",
  },
};

export type StatusBadgeProps = {
  kind: StatusBadgeKind;
  /**
   * Overrides the label text.
   *
   * For the rare row that needs to be more specific — "2 of 3 settled". The icon and fill stay
   * tied to `kind`, so an override cannot make a settled badge look like a transfer.
   */
  label?: string;
};

export function StatusBadge({ kind, label }: StatusBadgeProps) {
  const badge = BADGES[kind];

  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      gap="5px"
      bg={badge.bg}
      // Ink in both modes, like anything drawn on a swatch fill — unless the kind says otherwise.
      color={badge.fg ?? "content.onSwatch"}
      borderWidth="thin"
      borderStyle="solid"
      // `archived` is quiet enough that a full ink outline would shout; the soft card line matches it.
      borderColor={badge.fg ? "line.card" : "line"}
      paddingInline="8px"
      paddingBlock="3px"
      flexShrink="0"
      // The label is short and must not wrap inside an 8px-padded chip.
      whiteSpace="nowrap"
    >
      <Icon name={badge.icon} size="11px" />
      {/*
        The text is the badge. The icon repeats it visually, which is why the icon is decorative and
        this is not — a badge that were icon-only would be unreadable to a screen reader and a
        guessing game for everyone else.
      */}
      <Text as="span" textStyle="badge">
        {label ?? badge.label}
      </Text>
    </Flex>
  );
}
