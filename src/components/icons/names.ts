/**
 * The icon vocabulary: every glyph name, as data.
 *
 * ## Why this is separate from `registry.tsx`
 *
 * The glyphs themselves are JSX, so importing them drags a JSX transform into whatever
 * imports them. That is fine for a component and wrong for everything else: the category,
 * account and transaction resolvers are pure functions over *names*, they belong in the `unit`
 * test project, and they have no business needing React to run.
 *
 * So the name is the contract and the drawing is an implementation of it. `registry.tsx`
 * declares `Record<IconName, IconGlyph>`, which makes the compiler enforce both halves: a name
 * here with no glyph there is an error, and a glyph there with no name here is too. The two
 * files cannot drift.
 */

/**
 * The glyphs transcribed from `design/ux/` (section 6.2).
 *
 * Grouped as the design system document groups them, because that is the order someone will
 * read them in when checking a transcription.
 *
 * **There are 29, not the 28 the design system document states.** Its four tables list
 * 6 + 10 + 7 + 6, which is 29; the prose count is an arithmetic slip. Nothing is missing and
 * nothing was invented — the tables are the authority and every row in them is here. Recorded
 * so the next person to count does not go looking for a thirtieth.
 */
export const HANDOFF_GLYPHS = [
  // Navigation and chrome
  "home",
  "activity",
  "accounts",
  "people",
  "categories",
  "sign-out",
  // Actions
  "plus",
  "split",
  "transfer",
  "card",
  "cash",
  "bank",
  "chevron-down",
  "calendar",
  "mail",
  "lock",
  // Status and money
  "check",
  "alert-triangle",
  "equals",
  "arrow-in",
  "arrow-out",
  "bar-chart",
  "shield",
  // Categories
  "cart",
  "bolt",
  "bag",
  "ticket",
  "cutlery",
  "car",
] as const;

/**
 * Drawn in-house, because the handoff provides none of them (section 2.6).
 *
 * Group 21 counted nine, then twelve once the seeded category defaults were checked
 * (`receipt`, `plane`, `ellipsis` are needed by `DEFAULT_CATEGORIES` and undrawn). `sun` and
 * `moon` came from group 24's colour-mode toggle, which the handoff does not design because the
 * toggle is this implementation's own addition. `chevron-left` came from group 43's `BackLink`,
 * for the same reason — the handoff draws no back affordance anywhere. Fifteen in total.
 *
 * This is the list that needs designer review. Kept as data so the review list in
 * `docs/design-tasks/updates/GROUP-25-ICON-SYSTEM.md` cannot drift from the code.
 */
export const IN_HOUSE_GLYPHS = [
  "search",
  "filter",
  "archive",
  "restore",
  "edit",
  "delete",
  "offline",
  "install",
  "chevron-right",
  "chevron-left",
  "receipt",
  "plane",
  "ellipsis",
  "sun",
  "moon",
] as const;

export const ICON_NAMES = [...HANDOFF_GLYPHS, ...IN_HOUSE_GLYPHS] as const;

export type IconName = (typeof ICON_NAMES)[number];

const ICON_NAME_SET: ReadonlySet<string> = new Set(ICON_NAMES);

/**
 * Narrows an arbitrary string to a glyph name.
 *
 * The important caller is the stored `Category.icon`, which is a free-text column holding
 * lucide names and may contain anything. A `Set` rather than `name in ICONS` deliberately:
 * `in` also matches inherited properties, so `"toString"` and `"constructor"` would pass and
 * then fail to render.
 */
export function isIconName(value: unknown): value is IconName {
  return typeof value === "string" && ICON_NAME_SET.has(value);
}
