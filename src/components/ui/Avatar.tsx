import { Flex } from "@chakra-ui/react";
import { initials } from "@/lib/utils/text";

/**
 * Square avatar with initials.
 *
 * **Square, never circular** — one of the four audit motifs (5.4). A circular avatar is the single
 * change that would make this design look like every other app.
 *
 * ## The fill encodes direction, so it is never the only place direction appears
 *
 * `teal` for the signed-in user, `mint` when a person owes you, `coral` when you owe them. That is
 * useful at a glance down a list and useless to anyone who cannot see the hue, so every screen
 * placing a directional avatar must also carry the direction in words — which in practice means
 * next to a `DirectionAmount`. The prop is named `relation` rather than `color` to make that
 * obligation legible at the call site.
 */

export type AvatarRelation = "self" | "owesYou" | "youOwe" | "neutral";

const RELATION_FILLS: Record<AvatarRelation, string> = {
  self: "swatch.teal",
  owesYou: "swatch.mint",
  youOwe: "swatch.coral",
  /** A person with no outstanding balance, or a context where direction is meaningless. */
  neutral: "surface.sunken",
};

/**
 * The five sizes the handoff draws, with the initials scaled to each.
 *
 * Initials are set in Space Grotesk 700, and the sizes come from the drawings rather than a ratio:
 * at 20px a proportional size would be 7.5px, which is unreadable, so the small end is deliberately
 * larger than linear.
 */
const SIZES = {
  xs: { box: "20px", font: "9px" },
  sm: { box: "24px", font: "9.5px" },
  md: { box: "28px", font: "11px" },
  lg: { box: "32px", font: "12px" },
  xl: { box: "34px", font: "12.5px" },
} as const;

export type AvatarSize = keyof typeof SIZES;

export type AvatarProps = {
  /** Full name. The initials are derived, so a call site cannot disagree with another one. */
  name: string;
  relation?: AvatarRelation;
  size?: AvatarSize;
};

export function Avatar({ name, relation = "neutral", size = "lg" }: AvatarProps) {
  const dimensions = SIZES[size];

  return (
    <Flex
      as="span"
      align="center"
      justify="center"
      width={dimensions.box}
      height={dimensions.box}
      flexShrink="0"
      bg={RELATION_FILLS[relation]}
      /*
       * Ink in both colour modes — the fixed-ink rule (6.1), which applies to initials for the same
       * reason it applies to a glyph: all three fills are bright in either mode, and `darkInk` on
       * them measures around 2:1.
       *
       * `neutral` is the exception in principle, since `surface.sunken` is dark in dark mode. It is
       * safe here because that variant is used where there is no balance to signal, and the
       * initials sit on the page background rather than on a swatch — but it is the one combination
       * worth re-measuring in group 40.
       */
      color={relation === "neutral" ? "content" : "content.onSwatch"}
      borderWidth="thin"
      borderStyle="solid"
      borderColor="line"
      fontFamily="heading"
      fontWeight="700"
      fontSize={dimensions.font}
      lineHeight="1"
      /*
       * Hidden from assistive technology, always.
       *
       * The person's name is always rendered next to it — a row with an avatar and no name would be
       * unusable — so announcing "RS" as well means hearing the same person twice, once as a
       * meaningless pair of letters.
       */
      aria-hidden="true"
    >
      {initials(name)}
    </Flex>
  );
}
