import type { IconName } from "@/components/icons/names";
import { isIconName } from "@/components/icons/names";

/**
 * Decides which glyph and which swatch colour a category gets.
 *
 * One module, because the data model supports neither properly and the workarounds should have
 * exactly one site (docs/design-tasks/01-DESIGN-SYSTEM.md section 6.4):
 *
 * - `Category.icon` holds a lucide-style *string*, which may name a glyph this set does not
 *   have, may name one under a different name, and is `null` for every category a user created
 *   — because `CategoryForm` never offered the field. Group 39 adds a picker; this has to keep
 *   working for the rows that predate it.
 * - There is **no colour field at all.** Group 21 decided not to add one: the handoff states no
 *   rule for which category gets which colour, so any stored value would be recording a
 *   decision nobody has made. Colour is derived here instead.
 *
 * If a real `color` field ever arrives, it replaces `resolveCategorySwatch` and nothing else.
 */

/** The five swatch fills, addressable by the semantic token suffix. */
export const SWATCH_COLORS = ["teal", "mint", "coral", "butter", "sky"] as const;

export type SwatchColor = (typeof SWATCH_COLORS)[number];

/** `swatch.teal`, for a style prop. */
export function swatchToken(color: SwatchColor): string {
  return `swatch.${color}`;
}

/**
 * Stored icon names that do not match a registry glyph.
 *
 * The left-hand side is what is in the database — lucide names, which is what the nine seeded
 * defaults in `config/constants.ts` were written with. The right-hand side is this set's name
 * for the same idea.
 *
 * Only names that actually *differ* are listed. Anything already matching a registry glyph
 * passes straight through, which is what makes the group 39 icon picker cheap: it offers
 * registry names and needs no entry here.
 */
const STORED_NAME_ALIASES: Readonly<Record<string, IconName>> = {
  // The nine seeded defaults.
  utensils: "cutlery",
  "shopping-bag": "bag",
  film: "ticket",
  house: "home",
  "heart-pulse": "activity",
  // `car`, `receipt`, `plane` and `ellipsis` are registry names already.

  // Common lucide names a picker or an import might plausibly produce. Cheap to map, and each
  // one avoids a category silently falling back to `ellipsis`.
  "shopping-cart": "cart",
  utensil: "cutlery",
  zap: "bolt",
  bolt: "bolt",
  banknote: "cash",
  wallet: "cash",
  landmark: "bank",
  "credit-card": "card",
  "piggy-bank": "bank",
  heart: "activity",
  "more-horizontal": "ellipsis",
  "more-horiz": "ellipsis",
};

/** The glyph a category with no usable stored icon gets. */
export const FALLBACK_CATEGORY_ICON: IconName = "ellipsis";

/**
 * The glyphs the category icon picker offers (group 39).
 *
 * A **curated subset**, not `ICON_NAMES`. The registry also holds navigation glyphs (`home` earns its
 * place here, `accounts` does not), control glyphs (`chevron-down`, `edit`) and state glyphs
 * (`offline`, `check`) — offering any of those as a category icon would be offering nonsense.
 *
 * Lives in this module rather than beside the picker component for a reason group 25 wrote down: the
 * `unit` test project has no React transform, so a `.tsx` import from `icon-map.test.ts` fails to
 * parse. Pure data belongs in the pure module.
 *
 * Ordered roughly by how often a category means each thing, so the common choices are in the first row.
 */
export const CATEGORY_ICON_CHOICES: readonly IconName[] = [
  "cutlery",
  "cart",
  "bag",
  "car",
  "plane",
  "home",
  "receipt",
  "bolt",
  "ticket",
  "activity",
  "shield",
  "bar-chart",
  "card",
  "cash",
  "bank",
  "people",
  "calendar",
  FALLBACK_CATEGORY_ICON,
];

/**
 * FNV-1a, 32-bit.
 *
 * Not a cryptographic choice and not a security boundary — it only has to spread short similar
 * strings across five buckets. A naive sum of char codes does not: two categories created
 * seconds apart have ObjectIds differing in the last character or two, so their sums differ by
 * one and they land in adjacent buckets. In a list of siblings that shows up as runs of the
 * same colour. FNV-1a's multiply-and-mix breaks that up.
 *
 * `>>> 0` after the multiply keeps the value an unsigned 32-bit integer; without it the
 * intermediate goes through a signed conversion and the distribution degrades.
 */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/**
 * Picks a swatch colour for a category.
 *
 * Hashed on the **id**, never the name. Renaming "Food" to "Eating out" must not change its
 * colour: the colour is how a user recognises the row in a list and the category in last
 * month's spending breakdown, and a rename that silently re-colours a year of history is worse
 * than no colour at all.
 *
 * Deterministic and stateless, so the server and the client agree without coordinating, and a
 * category looks the same offline as online.
 */
export function resolveCategorySwatch(categoryId: string): SwatchColor {
  return SWATCH_COLORS[fnv1a(categoryId) % SWATCH_COLORS.length]!;
}

/**
 * Picks a glyph for a category.
 *
 * Two stages, in order: the stored name if it resolves to something, then the neutral
 * fallback. An unknown stored name is treated exactly like `null` — an icon nobody can draw is
 * no more useful than an icon nobody chose.
 */
export function resolveCategoryIcon(icon: string | null | undefined): IconName {
  if (!icon) return FALLBACK_CATEGORY_ICON;

  const aliased = STORED_NAME_ALIASES[icon];
  if (aliased) return aliased;

  return isIconName(icon) ? icon : FALLBACK_CATEGORY_ICON;
}

export type CategoryAppearance = {
  icon: IconName;
  swatch: SwatchColor;
  /** `swatch.mint`, ready for a `bg` prop. */
  swatchToken: string;
};

/**
 * Everything a category swatch needs, in one call.
 *
 * Takes the id and the icon separately rather than a `CategoryView`, so it is usable from the
 * picker, the spending breakdown and the activity list without each of them having to build a
 * full view model first.
 */
export function resolveCategoryAppearance(
  categoryId: string,
  icon: string | null | undefined,
): CategoryAppearance {
  const swatch = resolveCategorySwatch(categoryId);

  return {
    icon: resolveCategoryIcon(icon),
    swatch,
    swatchToken: swatchToken(swatch),
  };
}
