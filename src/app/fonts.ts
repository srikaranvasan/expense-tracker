import { IBM_Plex_Mono, Manrope, Space_Grotesk } from "next/font/google";

/**
 * The three faces of the "Ledger Geometry" design, each with exactly one job.
 *
 * ## Why `next/font/google` and not a stylesheet link
 *
 * The design handoff (`design/ux/DESIGN.md`) loads all three from
 * `fonts.googleapis.com` at runtime. That costs a render-blocking round trip to a third
 * party on every cold load, leaks the visitor's IP and user agent to Google, and shows a
 * flash of fallback text while the CSS resolves.
 *
 * `next/font/google` downloads the files at **build** time and serves them from
 * `/_next/static/media/`, same-origin and content-hashed. That matters twice over here:
 * it removes the third party, and it puts the font files under the path the service
 * worker already treats as immutable and cache-first
 * (`isImmutableAsset` in `public/sw.js`), so the first offline launch renders in the
 * right faces instead of falling back to system sans.
 *
 * ## The contract with the theme
 *
 * Each face exposes a CSS variable, and `src/theme/tokens.ts` points the `heading`,
 * `body` and `mono` font tokens at those variables. Nothing else in the application
 * names a font: components use `fontFamily="mono"` (or a text style that carries it),
 * never a family name. The variables are applied to `<html>` in `src/app/layout.tsx`.
 *
 * ## Weights
 *
 * Only the weights the design actually uses are requested. Every extra weight is another
 * file to download and precache on a device that may also be holding unsynced expenses
 * (docs/08-OFFLINE-SYNC.md section 47).
 *
 * `display: "swap"` is deliberate: text must be readable immediately, and a flash of
 * fallback is preferable to a flash of *nothing* for an app whose first screen is a
 * column of numbers.
 */

/** Headings, nav and button labels, tab-bar labels, avatar initials. Never numbers. */
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

/** Body copy, descriptions, helper text, list item names. Never numbers. */
export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

/**
 * Every amount, date, reference code, eyebrow label, badge and stamp.
 *
 * The rule that catches most mistakes: if it is a number, it is mono. `textStyle="amount"`
 * carries this family plus tabular figures, so a column of amounts lines up.
 */
export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/**
 * The three variable classes, for the `<html>` element.
 *
 * Exported as one string so the root layout cannot apply two of the three and leave the
 * third resolving to its fallback — a failure that looks like a slightly wrong weight
 * rather than an error.
 */
export const fontVariableClassName = [
  spaceGrotesk.variable,
  manrope.variable,
  ibmPlexMono.variable,
].join(" ");
