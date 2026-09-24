import { Box } from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";

/**
 * A rotated dashed confirmation stamp — `BALANCED`, `AUDITED · OK`.
 *
 * The fourth audit motif (5.4), and the one with a rule attached rather than just a geometry.
 *
 * ## It is for derived confirmations, never for errors
 *
 * A rotated dashed stamp saying something is *wrong* reads as decoration: the visual language of a
 * rubber stamp is "checked and approved", and using it for a failure makes the failure look
 * ornamental. Validation failures and unbalanced states use `Alert` (7.6). The design system says
 * this in section 5.4 and it is repeated here because this is the component someone will reach for.
 *
 * ## It must never be the only carrier of its message
 *
 * Rotated text is harder to read, and at `-7deg` with 0.1em tracking it is harder still. The
 * settle-up screen is the model: `BALANCED` sits next to the allocated figure that already proves
 * it, so a user who cannot read the stamp has lost nothing. If you find yourself adding a stamp to
 * communicate something not stated in plain text nearby, the stamp is the wrong component.
 *
 * `aria-hidden` is therefore the **default**, not an option: the accompanying text is what assistive
 * technology should read, and announcing a decorative duplicate is noise. `announce` exists for the
 * rare case where the stamp genuinely is the only text — and if you need it, reconsider first.
 */

export type StampTone = "positive" | "neutral";

export type StampProps = Omit<BoxProps, "children"> & {
  /** Short, and uppercase by the text style — "BALANCED", "AUDITED · OK". */
  label: string;
  tone?: StampTone;
  /** Announce the stamp to assistive technology. Almost always wrong; see above. */
  announce?: boolean;
};

const TONE_COLORS = {
  positive: "positive",
  neutral: "content.muted",
} as const;

export function Stamp({ label, tone = "positive", announce, ...rest }: StampProps) {
  return (
    <Box
      display="inline-block"
      fontFamily="mono"
      fontSize="badge"
      fontWeight="600"
      letterSpacing="stamp"
      textTransform="uppercase"
      color={TONE_COLORS[tone]}
      borderWidth="thick"
      borderStyle="dashed"
      borderColor={TONE_COLORS[tone]}
      paddingInline="10px"
      paddingBlock="5px"
      // Between -6 and -8 per 5.4. -7 is the middle; there is no reason for each stamp to pick its
      // own angle, and a page with three different rotations looks like a mistake rather than a
      // motif.
      transform="rotate(-7deg)"
      // Rotation is decoration and must not push the layout around.
      transformOrigin="center"
      whiteSpace="nowrap"
      {...(announce ? {} : { "aria-hidden": "true" })}
      {...rest}
    >
      {label}
    </Box>
  );
}
