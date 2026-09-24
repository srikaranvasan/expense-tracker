import type { ReactNode } from "react";
import type { IconName } from "./names";

/**
 * The drawings.
 *
 * One module, so "what icons do we have?" is a file to read rather than a search to run, and
 * so the stroke weight and geometry rules are visible together rather than being re-decided
 * per screen. The *names* live in `names.ts`; see the note there for why they are split.
 *
 * ## The rules (docs/design-tasks/01-DESIGN-SYSTEM.md section 6.1)
 *
 * - Inline stroke SVG. Never emoji, never an icon font, never a raster.
 * - `viewBox="0 0 16 16"` unless the glyph says otherwise, rendered at 11-20px.
 * - `fill="none"`, `stroke="currentColor"` — set once by `<Icon>`, not per glyph, so an icon
 *   inherits its surroundings. The handful of **filled** dots (`cart`, `car`, `ellipsis`) are
 *   the only exceptions and declare `fill="currentColor"` themselves.
 * - Stroke weight 1.2-2px, tuned per glyph. The weight lives here with the glyph because it
 *   was chosen for that glyph's density; a single global weight makes `cart` heavy and
 *   `plus` spindly.
 * - Geometric only: straight lines, rectangles, simple polylines, and a circle where the
 *   metaphor genuinely needs one. If a new icon needs a curve to read, it is probably the
 *   wrong metaphor for this set.
 *
 * ## Why this is a `.tsx` of JSX rather than a `.ts` of shape descriptors
 *
 * Section 6.2 suggests a `registry.ts` mapping a name to `{ stroke, children }`. JSX cannot
 * live in a `.ts` file, so the choice was between this and a declarative
 * `{ kind: "rect", x, y, … }` union with an interpreter in `<Icon>`.
 *
 * JSX won for one reason: the path data below is transcribed by hand from the handoff, and it
 * now reads *character for character* as the design document lists it. A shape-descriptor
 * layer would put an interpreter between the reviewed value and the rendered pixel, and a bug
 * in that interpreter looks exactly like a bad transcription. The cost is that the registry
 * imports React, which it would anyway to type `ReactNode`.
 *
 * ## Attribution of the glyphs
 *
 * Twenty-nine are transcribed from `design/ux/` (section 6.2); fifteen are drawn in-house to
 * the rules above. `names.ts` holds the two lists, and `IN_HOUSE_GLYPHS` is the one that needs
 * designer review.
 */

export type IconGlyph = {
  /**
   * Stroke width in user units. Tuned per glyph; do not normalise these.
   *
   * It is a *relative* weight, which only means anything because every glyph shares the 16-unit
   * viewBox below. A glyph in a smaller box would be scaled up more by `<Icon>` and its nominal
   * weight would paint heavier — see the note on `chevron-down`.
   */
  readonly stroke: number;
  /** `stroke-linejoin`, where a mitre would produce a spike. */
  readonly linejoin?: "round" | "miter" | "bevel";
  readonly children: ReactNode;
};

/**
 * Every glyph is drawn in this box. No exceptions, and not a default that can be overridden.
 *
 * A per-glyph viewBox was tried and removed: it makes `stroke` mean different things in different
 * glyphs, because `<Icon>` scales the box to the requested pixel size and the stroke scales with
 * it. One box is what lets the weights in this file be compared by reading them.
 */
export const ICON_VIEWBOX = "0 0 16 16";

/* ------------------------------------------------------------------ *
 * Navigation and chrome
 * ------------------------------------------------------------------ */

const NAVIGATION = {
  home: {
    stroke: 1.6,
    children: (
      <>
        <path d="M2 7L8 2L14 7" />
        <path d="M4 6.5V13.5H12V6.5" />
      </>
    ),
  },

  activity: {
    stroke: 1.5,
    children: <path d="M1 8H4L6 3L10 13L12 8H15" />,
  },

  accounts: {
    stroke: 1.5,
    children: (
      <>
        <rect x="1.5" y="4.5" width="13" height="9" />
        {/* The card's chip, at a lighter weight so it reads as detail rather than structure. */}
        <rect x="9.3" y="7.5" width="3.7" height="3" strokeWidth="1.3" />
      </>
    ),
  },

  /** Two overlapping diamonds — the same rotated square as the logo mark, twice. */
  people: {
    stroke: 1.4,
    children: (
      <>
        <rect x="1" y="5" width="6.5" height="6.5" transform="rotate(45 4.25 8.25)" />
        <rect x="7.2" y="5" width="6.5" height="6.5" transform="rotate(45 10.45 8.25)" />
      </>
    ),
  },

  categories: {
    stroke: 1.4,
    children: (
      <>
        <rect x="1.5" y="1.5" width="5" height="5" />
        <rect x="9.5" y="1.5" width="5" height="5" />
        <rect x="1.5" y="9.5" width="5" height="5" />
        <rect x="9.5" y="9.5" width="5" height="5" />
      </>
    ),
  },

  "sign-out": {
    stroke: 1.4,
    children: (
      <>
        <path d="M6 2H3.5C2.7 2 2 2.7 2 3.5V12.5C2 13.3 2.7 14 3.5 14H6" />
        <path d="M6 8H14M14 8L11 5M14 8L11 11" />
      </>
    ),
  },
} satisfies Record<string, IconGlyph>;

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

const ACTIONS = {
  plus: {
    stroke: 2,
    children: (
      <>
        <line x1="8" y1="2" x2="8" y2="14" />
        <line x1="2" y1="8" x2="14" y2="8" />
      </>
    ),
  },

  /** Two arrows parting — one bill becoming two obligations. */
  split: {
    stroke: 1.5,
    children: (
      <>
        <path d="M2 5H14M14 5L11 2M14 5L11 8" />
        <path d="M14 11H2M2 11L5 8M2 11L5 14" />
      </>
    ),
  },

  transfer: {
    stroke: 1.5,
    children: <path d="M2 8H14M9 3L14 8L9 13" />,
  },

  card: {
    stroke: 1.5,
    children: (
      <>
        <rect x="2" y="3" width="12" height="10" />
        <line x1="2" y1="6.5" x2="14" y2="6.5" />
      </>
    ),
  },

  cash: {
    stroke: 1.6,
    children: (
      <>
        <rect x="2" y="4" width="12" height="8" />
        <line x1="2" y1="7" x2="14" y2="7" />
      </>
    ),
  },

  bank: {
    stroke: 1.6,
    children: (
      <>
        <path d="M2 6L8 2L14 6" />
        <rect x="3" y="7" width="10" height="6" />
      </>
    ),
  },

  /**
   * Drawn in the standard 16-unit box, **not** the `0 0 12 8` the handoff specifies.
   *
   * The handoff's shallower box is fine on an artboard, where the glyph is placed at one known
   * size. It is wrong in a shared `<Icon size>` system: a 12x8 viewBox rendered into a 14px
   * square scales by 1.75 against a 16-unit glyph's 0.875, so the same nominal `stroke: 2`
   * paints roughly twice as heavy and the chevron stops belonging to the set. Caught by looking
   * at a contact sheet of all 43 glyphs at one size — see section 5 of the group 25 update
   * document.
   *
   * The intent (a 2px chevron, centred, no wasted air) is preserved by insetting the path
   * instead of shrinking the box.
   */
  "chevron-down": {
    stroke: 2,
    children: <path d="M3 6L8 11L13 6" />,
  },

  calendar: {
    stroke: 1.4,
    children: (
      <>
        <rect x="2" y="3" width="12" height="11" />
        <line x1="2" y1="6.5" x2="14" y2="6.5" />
      </>
    ),
  },

  mail: {
    stroke: 1.3,
    children: (
      <>
        <rect x="1.5" y="3" width="13" height="10" />
        <path d="M1.5 3.5L8 9L14.5 3.5" />
      </>
    ),
  },

  lock: {
    stroke: 1.3,
    children: (
      <>
        <rect x="3" y="7" width="10" height="7" />
        <path d="M5 7V4.5C5 2.6 6.6 1 8 1C9.4 1 11 2.6 11 4.5V7" />
      </>
    ),
  },
} satisfies Record<string, IconGlyph>;

/* ------------------------------------------------------------------ *
 * Status and money
 * ------------------------------------------------------------------ */

const STATUS = {
  check: {
    stroke: 2,
    children: <polyline points="3 8 6.5 12 13 4" />,
  },

  "alert-triangle": {
    stroke: 1.6,
    linejoin: "round",
    children: (
      <>
        <path d="M8 2L14.5 13H1.5Z" />
        <line x1="8" y1="6.5" x2="8" y2="9.5" />
      </>
    ),
  },

  /**
   * The "computed" marker.
   *
   * Sits beside a figure the app derived rather than stored — the dashboard's net position.
   * It is the visual half of the rule that every number is computed, never cached (9.1).
   */
  equals: {
    stroke: 2,
    children: (
      <>
        <line x1="2" y1="6" x2="14" y2="6" />
        <line x1="2" y1="10" x2="14" y2="10" />
      </>
    ),
  },

  /** Precedes an "owes you" amount. Never the only signal — the words are (9.1). */
  "arrow-in": {
    stroke: 1.7,
    children: <path d="M4 12L12 4M12 4H6M12 4V10" />,
  },

  /** Precedes a "you owe" amount. */
  "arrow-out": {
    stroke: 1.7,
    children: <path d="M4 4L12 12M12 12H6M12 12V6" />,
  },

  "bar-chart": {
    stroke: 1.3,
    children: (
      <>
        <rect x="2" y="8" width="3" height="6" />
        <rect x="6.5" y="4" width="3" height="10" />
        <rect x="11" y="6" width="3" height="8" />
      </>
    ),
  },

  shield: {
    stroke: 1.3,
    children: <path d="M8 1.5L14 4V8C14 11.5 11.5 13.8 8 14.5C4.5 13.8 2 11.5 2 8V4L8 1.5Z" />,
  },
} satisfies Record<string, IconGlyph>;

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */

const CATEGORY = {
  cart: {
    stroke: 1.2,
    children: (
      <>
        <path d="M1.5 2H3L4.5 10.5H12.5L14 4.5H4" />
        {/* The wheels are filled, one of three exceptions to the stroke-only rule. */}
        <circle cx="6" cy="13.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },

  bolt: {
    stroke: 1.2,
    linejoin: "round",
    children: <path d="M9 1L3 9H7L6 15L13 6H9L9 1Z" />,
  },

  bag: {
    stroke: 1.3,
    children: (
      <>
        <path d="M4 6H12L11.3 14H4.7L4 6Z" />
        <path d="M6 6V4C6 2.9 6.9 2 8 2C9.1 2 10 2.9 10 4V6" />
      </>
    ),
  },

  /**
   * Near-identical to `card` at a different inset, and kept anyway.
   *
   * They mean different things — a cinema ticket and a payment card — and appear side by side
   * in the activity list, where the third rule is what distinguishes them.
   */
  ticket: {
    stroke: 1.2,
    children: (
      <>
        <rect x="1.5" y="3" width="13" height="10" />
        <line x1="1.5" y1="6" x2="14.5" y2="6" />
        <line x1="1.5" y1="10" x2="14.5" y2="10" strokeWidth="1" />
      </>
    ),
  },

  cutlery: {
    stroke: 1.2,
    children: (
      <>
        <line x1="4" y1="2" x2="4" y2="14" />
        <line x1="2.5" y1="2" x2="2.5" y2="6" />
        <line x1="5.5" y1="2" x2="5.5" y2="6" />
        <path d="M11 2C11 2 9.5 3.5 9.5 6C9.5 7.5 10 8 11 8V14" />
      </>
    ),
  },

  car: {
    stroke: 1.3,
    children: (
      <>
        <rect x="2" y="7" width="12" height="4" />
        <path d="M3 7L5 4H11L13 7" />
        <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="11" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
  },
} satisfies Record<string, IconGlyph>;

/* ------------------------------------------------------------------ *
 * Drawn in-house — the handoff provides none of these
 * ------------------------------------------------------------------ */

const IN_HOUSE = {
  search: {
    stroke: 1.5,
    children: (
      <>
        <circle cx="6.5" cy="6.5" r="4.5" />
        <line x1="10" y1="10" x2="14.5" y2="14.5" />
      </>
    ),
  },

  /** A funnel, drawn as straight edges only. */
  filter: {
    stroke: 1.5,
    linejoin: "round",
    children: <path d="M1.5 3H14.5L9 9V14L7 12.5V9L1.5 3Z" />,
  },

  /**
   * `archive` and `restore` are a deliberate pair: the same tray, the arrow reversed.
   *
   * A lidded box (the conventional archive glyph) and a circular arrow (the conventional
   * restore one) share no visual language, so a user would have to learn them separately.
   * These are the same shape twice, which also keeps `restore` free of the arc that a
   * circular arrow would need.
   */
  archive: {
    stroke: 1.4,
    children: (
      <>
        <rect x="2" y="9.5" width="12" height="4.5" />
        <path d="M8 1.5V7.5M8 7.5L5 4.5M8 7.5L11 4.5" />
      </>
    ),
  },

  restore: {
    stroke: 1.4,
    children: (
      <>
        <rect x="2" y="9.5" width="12" height="4.5" />
        <path d="M8 7.5V1.5M8 1.5L5 4.5M8 1.5L11 4.5" />
      </>
    ),
  },

  edit: {
    stroke: 1.4,
    children: (
      <>
        <path d="M2.5 13.5V10.5L10.5 2.5L13.5 5.5L5.5 13.5H2.5Z" />
        <line x1="9" y1="4" x2="12" y2="7" />
      </>
    ),
  },

  delete: {
    stroke: 1.4,
    children: (
      <>
        <line x1="2.5" y1="4.5" x2="13.5" y2="4.5" />
        <path d="M4.5 4.5V13.5H11.5V4.5" />
        <path d="M6.5 4.5V2.5H9.5V4.5" />
        <line x1="6.5" y1="7" x2="6.5" y2="11.5" />
        <line x1="9.5" y1="7" x2="9.5" y2="11.5" />
      </>
    ),
  },

  /**
   * Signal bars struck through.
   *
   * A cloud with a slash is the usual choice and needs three curves. Ascending bars plus one
   * diagonal reads as "no connection" with nothing but straight lines, and it pairs with
   * `bar-chart`, which is the same bars without the slash.
   */
  offline: {
    stroke: 1.3,
    children: (
      <>
        <rect x="2" y="11" width="2.5" height="3" />
        <rect x="6.75" y="8" width="2.5" height="6" />
        <rect x="11.5" y="5" width="2.5" height="9" />
        <line x1="2" y1="14" x2="14" y2="2" strokeWidth="1.6" />
      </>
    ),
  },

  install: {
    stroke: 1.5,
    children: (
      <>
        <path d="M8 2V10M8 10L5 7M8 10L11 7" />
        <line x1="2.5" y1="13" x2="13.5" y2="13" />
      </>
    ),
  },

  /** `chevron-down` turned. See the note there about why it is not in a shallower box. */
  "chevron-right": {
    stroke: 2,
    children: <path d="M6 3L11 8L6 13" />,
  },

  /**
   * `chevron-right` mirrored, for `BackLink`.
   *
   * Added in group 43. Drawn rather than rotated with CSS: a `transform: rotate(180deg)` on the
   * `chevron-right` glyph would also rotate its stroke caps, which is visible at 14px, and the
   * registry's rule is that geometry lives in the path data so a contact sheet of the set can be
   * read (see the header of this file).
   *
   * Same `stroke: 2` and the same 16-unit box as its mirror, so the two weigh the same on screen.
   */
  "chevron-left": {
    stroke: 2,
    children: <path d="M10 3L5 8L10 13" />,
  },

  /** A bill: `Bills` is one of the nine seeded defaults and the handoff draws no glyph. */
  receipt: {
    stroke: 1.3,
    children: (
      <>
        <rect x="3" y="1.5" width="10" height="13" />
        <line x1="5" y1="5" x2="11" y2="5" />
        <line x1="5" y1="8" x2="11" y2="8" />
        <line x1="5" y1="11" x2="9" y2="11" />
      </>
    ),
  },

  /** A paper plane rather than an airliner — four straight edges instead of a fuselage. */
  plane: {
    stroke: 1.3,
    linejoin: "round",
    children: (
      <>
        <path d="M1.5 8L14.5 2L10 14L7.5 9.5L1.5 8Z" />
        <line x1="7.5" y1="9.5" x2="14.5" y2="2" />
      </>
    ),
  },

  /**
   * The neutral "other" glyph, and the fallback for a category with no stored icon
   * (`src/features/categories/icon-map.ts`).
   *
   * Filled dots, because three hollow rings at 11px inside a category swatch turn to mush.
   */
  ellipsis: {
    stroke: 1.5,
    children: (
      <>
        <circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
  },

  /**
   * `sun` and `moon` drive the colour-mode toggle, which the handoff does not design because
   * the toggle is this implementation's own addition (group 21 section 3.3). Moved here from
   * `ColorModeToggle.tsx`, where group 24 had to draw them before this registry existed.
   */
  sun: {
    stroke: 1.5,
    children: (
      <>
        <circle cx="8" cy="8" r="3.2" />
        <path d="M8 1V3M8 13V15M1 8H3M13 8H15M3.1 3.1L4.5 4.5M11.5 11.5L12.9 12.9M12.9 3.1L11.5 4.5M4.5 11.5L3.1 12.9" />
      </>
    ),
  },

  moon: {
    stroke: 1.5,
    linejoin: "round",
    children: <path d="M10.2 2.1A6.2 6.2 0 1 0 13.9 9.4A5 5 0 0 1 10.2 2.1Z" />,
  },
} satisfies Record<string, IconGlyph>;

/* ------------------------------------------------------------------ *
 * The registry
 * ------------------------------------------------------------------ */

/**
 * Typed as `Record<IconName, IconGlyph>` rather than inferred, which is the whole point of the
 * split: the compiler now rejects a name in `names.ts` with no drawing here, **and** a drawing
 * here with no name there. Neither can be added alone.
 */
export const ICONS: Record<IconName, IconGlyph> = {
  ...NAVIGATION,
  ...ACTIONS,
  ...STATUS,
  ...CATEGORY,
  ...IN_HOUSE,
};

export type { IconName } from "./names";
export { HANDOFF_GLYPHS, ICON_NAMES, IN_HOUSE_GLYPHS, isIconName } from "./names";
