import { Box } from "@chakra-ui/react";
import type { HTMLChakraProps } from "@chakra-ui/react";
import type { IconName } from "./names";
import { ICONS, ICON_VIEWBOX } from "./registry";

/**
 * Renders one glyph from the registry.
 *
 * The single place the shared SVG attributes are set, so a glyph in `registry.tsx` is only ever
 * path data plus a stroke weight. That split is what keeps 43 glyphs consistent: there is no
 * per-icon opportunity to forget `aria-hidden` or to hard-code a colour.
 *
 * ## Why `Box asChild` and not `chakra("svg")`
 *
 * `chakra()` is a **client-side factory**. Calling it at module scope in a module without
 * `"use client"` makes that module unusable from a Server Component, and the build fails with
 * "Attempted to call chakra() from the server but chakra is on the client". That is not
 * theoretical: it broke the build the moment `Card` and `Alert` started rendering icons, because
 * both are reached from server components (the dashboard page, the unauthenticated layout).
 *
 * The alternative was `"use client"` on this file, which works but pushes every icon — and the
 * whole registry — across a client boundary for the sake of a styling wrapper.
 *
 * `Box` is exported by the library with its own boundary already handled, and `asChild` merges its
 * generated class onto the child. So Chakra styles a plain `<svg>` element, and a Server Component
 * can render an icon.
 *
 * ## Which layer owns what
 *
 * - **Chakra owns layout and colour** on the wrapper: `display`, `flex-shrink`, the `_dark`
 *   condition, tokens, and anything the caller passes.
 * - **SVG owns geometry and painting**: `viewBox`, `width`/`height` and the paint attributes are
 *   real attributes, not CSS.
 *
 * That split is not tidiness either. Three glyphs override the stroke weight on one of their own
 * children (`accounts`' chip at 1.3, `ticket`'s third rule at 1, `offline`'s slash at 1.6), and
 * those overrides are presentation *attributes*. If the parent weight were CSS, the two mechanisms
 * would meet across the parent/child boundary and the outcome would depend on cascade rules that
 * are easy to reason about wrongly and invisible when you do.
 */

/** Context-appropriate sizes, from section 6.3. */
export const ICON_SIZES = {
  /** Inside a 20px category swatch. */
  swatchSm: "11px",
  /** Inside a 26px transaction-type swatch. */
  swatch: "14px",
  /** Inside a 32-34px account swatch. */
  swatchLg: "15px",
  /** Inline in a button, a nav link or an input prefix. */
  inline: "14px",
  /** A summary-tile corner marker. */
  tile: "15px",
  /** The bottom tab bar. */
  tab: "17px",
  /** The quick-add button. */
  fab: "20px",
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export type IconProps = Omit<HTMLChakraProps<"span">, "children" | "css" | "asChild"> & {
  name: IconName;
  /** A named context from 6.3, or any CSS length. Defaults to the inline size. */
  size?: IconSize | (string & {});
  /**
   * Set when the icon sits **inside** a swatch or avatar fill.
   *
   * `DESIGN.md` is explicit: a glyph on any of the five swatch fills is ink in *both* themes,
   * because every fill is bright enough for dark ink and light ink would disappear on it (measured
   * 1.4:1 to 2.1:1 against the dark fills). This has to be a fixed value rather than
   * `currentColor`, which would otherwise inherit `darkInk` from the surrounding text in dark mode
   * and erase the glyph.
   */
  onSwatch?: boolean;
  /**
   * An accessible name, for an icon that is the only label on its control.
   *
   * Providing it switches the SVG from `aria-hidden` to `role="img"`. Most icons should not set it:
   * an icon beside a text label is decoration, and announcing it twice is worse than not announcing
   * it at all. Where a *control* is icon-only, prefer `aria-label` on the button — this exists for
   * the rarer case of a standalone informational glyph.
   */
  label?: string;
};

export function Icon({ name, size = "inline", onSwatch, label, ...rest }: IconProps) {
  const glyph = ICONS[name];
  const dimension = size in ICON_SIZES ? ICON_SIZES[size as IconSize] : size;

  return (
    <Box
      asChild
      // Never shrinks in a flex row. An icon squashed to 9px beside a long label is the most common
      // way this set stops reading.
      flexShrink="0"
      display="block"
      {...(onSwatch ? { color: "content.onSwatch" } : {})}
      {...rest}
    >
      <svg
        viewBox={ICON_VIEWBOX}
        width={dimension}
        height={dimension}
        fill="none"
        stroke="currentColor"
        strokeWidth={glyph.stroke}
        strokeLinecap="round"
        {...(glyph.linejoin ? { strokeLinejoin: glyph.linejoin } : {})}
        {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
      >
        {glyph.children}
      </svg>
    </Box>
  );
}
