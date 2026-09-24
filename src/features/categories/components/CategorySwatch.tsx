import { Swatch } from "@/components/ui/Swatch";
import type { SwatchSize } from "@/components/ui/Swatch";
import { resolveCategoryAppearance } from "../icon-map";

export type CategorySwatchProps = {
  /**
   * Used to derive the colour.
   *
   * Hashed on the **id**, never the name: colour is how a user recognises a category in a list and in
   * last month's breakdown, and a rename that silently re-coloured a year of history would be worse
   * than having no colour at all.
   */
  categoryId: string;
  /** `Category.icon` — free text that may be a lucide name, an unknown name, or `null`. */
  icon: string | null | undefined;
  size?: SwatchSize;
};

/**
 * A category's colour and glyph.
 *
 * Both are **derived**, because the data model stores neither properly: `Category.icon` may not name
 * a glyph this set has, and there is no colour field at all (group 21 section 3.4). The resolver in
 * `../icon-map.ts` is the single place that decides, so a category looks the same in a list, in a
 * picker and in a chart.
 *
 * Lives in `features/categories` rather than `components/ui` because it needs that resolver, and
 * `components/ui` is barred from importing feature logic (docs/05-FOLDER-STRUCTURE.md).
 */
export function CategorySwatch({ categoryId, icon, size = "md" }: CategorySwatchProps) {
  const appearance = resolveCategoryAppearance(categoryId, icon);

  return <Swatch bg={appearance.swatchToken} icon={appearance.icon} size={size} fixedInk />;
}
