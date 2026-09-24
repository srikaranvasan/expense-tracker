import { Box } from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";

/**
 * The diamond logo mark — a teal square with an ink border, rotated 45°.
 *
 * The first of the four audit motifs (5.4), and the one that appears most: the header at both
 * widths, the sign-in page, and — at 8px — the marker on an active filter.
 *
 * A rotated square rather than an SVG on purpose. It has no path data to get wrong, it inherits the
 * `line` and `swatch.teal` tokens so it flips with the colour mode for free, and its border scales
 * with the design's own weights rather than a stroke width that would need re-tuning per size.
 */

export type DiamondMarkSize = "sm" | "md" | "lg" | "xl";

/**
 * 8px is the filter-active marker, 14px the mobile header, 16px the desktop header, 22px the
 * sign-in page — where the lockup is the only thing above the card and `Login.html` draws it larger.
 *
 * The border thins at the small end because a 2px border on an 8px square is a quarter of it — the
 * shape stops reading as a diamond and becomes a blob. It does not thicken at the large end: the
 * handoff draws the 22px mark with the same 2px ink.
 */
const SIZES = {
  sm: { box: "8px", border: "hairline" },
  md: { box: "14px", border: "thin" },
  lg: { box: "16px", border: "thick" },
  xl: { box: "22px", border: "thick" },
} as const;

export type DiamondMarkProps = Omit<BoxProps, "children"> & {
  size?: DiamondMarkSize;
};

export function DiamondMark({ size = "lg", ...rest }: DiamondMarkProps) {
  const dimensions = SIZES[size];

  return (
    <Box
      as="span"
      display="block"
      width={dimensions.box}
      height={dimensions.box}
      flexShrink="0"
      bg="swatch.teal"
      borderWidth={dimensions.border}
      borderStyle="solid"
      borderColor="line"
      transform="rotate(45deg)"
      /*
       * Decoration. The application name is always rendered beside it in the header, and the filter
       * marker sits next to the word "Filters" — so in both places the mark repeats text that is
       * already there.
       */
      aria-hidden="true"
      {...rest}
    />
  );
}
