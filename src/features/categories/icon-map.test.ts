import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/config/constants";
// From `names`, not `registry`: the resolver under test is pure logic over names, and pulling in
// the glyph JSX would drag a React transform into the `unit` project.
import { ICON_NAMES, isIconName } from "@/components/icons/names";
import {
  CATEGORY_ICON_CHOICES,
  FALLBACK_CATEGORY_ICON,
  SWATCH_COLORS,
  resolveCategoryAppearance,
  resolveCategoryIcon,
  resolveCategorySwatch,
  swatchToken,
} from "./icon-map";

/**
 * The category resolver is the only part of the icon system with real logic in it, and it
 * exists because the data model supports neither icons nor colours properly (section 2.3).
 *
 * Three properties matter more than the individual mappings:
 *
 *   1. **Totality.** Every category renders something. `icon: null` is not an edge case — it
 *      is every category a user has ever created, because the form never offered the field.
 *   2. **Stability.** The colour is derived from the id, so a rename cannot change it.
 *   3. **Distribution.** Ids that differ in one character must not all land in one bucket.
 */

describe("category icon resolver", () => {
  describe("stored names", () => {
    it.each(DEFAULT_CATEGORIES)(
      "resolves the seeded $name category to a real glyph",
      ({ name, icon }) => {
        // These nine are already in every existing user's database with lucide-style names. Any
        // one of them failing to resolve is a visibly broken row on the categories screen.
        const resolved = resolveCategoryIcon(icon);

        expect(isIconName(resolved), `${name} (${icon}) resolved to ${resolved}`).toBe(true);
      },
    );

    it("resolves every seeded icon by name rather than by falling back", () => {
      /*
       * The stronger version of the test above, and it cannot simply assert "not the fallback":
       * the seeded "Other" category's stored icon *is* `ellipsis`, which is also the fallback
       * glyph. So the check is that `ellipsis` is the only seeded icon reaching it, and that it
       * does so because it was asked for.
       */
      const viaFallback = DEFAULT_CATEGORIES.filter(
        (category) => resolveCategoryIcon(category.icon) === FALLBACK_CATEGORY_ICON,
      ).map((category) => category.icon);

      expect(viaFallback).toEqual(["ellipsis"]);
      expect(isIconName("ellipsis")).toBe(true);
    });

    it("seeds registry names directly, so no new row needs an alias", () => {
      /*
       * Group 39 changed `DEFAULT_CATEGORIES` from lucide names to registry names. Nothing was broken
       * before — the aliases below handled them — but an alias table should be a migration concern for
       * old data rather than how rows created today resolve.
       *
       * This is the guarantee that keeps it true: a future addition using a name the registry does not
       * have fails here instead of silently rendering `ellipsis`.
       */
      for (const category of DEFAULT_CATEGORIES) {
        expect(isIconName(category.icon), `${category.name} → ${category.icon}`).toBe(true);
      }
    });

    it("offers only real glyphs in the picker, and no navigation or control glyphs", () => {
      /*
       * `CATEGORY_ICON_CHOICES` is a hand-written subset of the registry: offering `chevron-down` or
       * `sign-out` as a category icon would be offering nonsense.
       */
      for (const name of CATEGORY_ICON_CHOICES) {
        expect(isIconName(name), name).toBe(true);
      }

      for (const excluded of [
        "chevron-down",
        "chevron-right",
        "edit",
        "delete",
        "sign-out",
        "offline",
      ]) {
        expect(CATEGORY_ICON_CHOICES).not.toContain(excluded);
      }
    });

    it("still maps the lucide names that existing databases hold", () => {
      expect(resolveCategoryIcon("utensils")).toBe("cutlery");
      expect(resolveCategoryIcon("shopping-bag")).toBe("bag");
      expect(resolveCategoryIcon("film")).toBe("ticket");
      expect(resolveCategoryIcon("house")).toBe("home");
      expect(resolveCategoryIcon("heart-pulse")).toBe("activity");
    });

    it("passes a registry name straight through", () => {
      // What makes the group 39 icon picker cheap: it offers registry names and needs no alias.
      expect(resolveCategoryIcon("car")).toBe("car");
      expect(resolveCategoryIcon("receipt")).toBe("receipt");
      expect(resolveCategoryIcon("plane")).toBe("plane");
      expect(resolveCategoryIcon("cart")).toBe("cart");
    });
  });

  describe("the fallback", () => {
    it.each([null, undefined, ""])("falls back for %s", (icon) => {
      expect(resolveCategoryIcon(icon)).toBe(FALLBACK_CATEGORY_ICON);
    });

    it("falls back for a name this set does not have", () => {
      // An icon nobody can draw is no more useful than an icon nobody chose, so an unknown
      // name is treated exactly like null rather than rendering an empty box.
      expect(resolveCategoryIcon("dinosaur")).toBe(FALLBACK_CATEGORY_ICON);
      expect(resolveCategoryIcon("lucide-something-new")).toBe(FALLBACK_CATEGORY_ICON);
    });

    it("uses a glyph that exists", () => {
      expect(ICON_NAMES).toContain(FALLBACK_CATEGORY_ICON);
    });
  });

  describe("the derived swatch colour", () => {
    it("always returns one of the five fills", () => {
      // 200 ObjectId-shaped ids, none of which may produce undefined.
      for (let index = 0; index < 200; index += 1) {
        const id = `65f${index.toString(16).padStart(21, "0")}`;
        expect(SWATCH_COLORS).toContain(resolveCategorySwatch(id));
      }
    });

    it("is stable for the same id", () => {
      const id = "65f1a2b3c4d5e6f708192a3b";
      expect(resolveCategorySwatch(id)).toBe(resolveCategorySwatch(id));
    });

    it("does not change when a category is renamed", () => {
      /*
       * The reason the hash is on the id and not the name. Colour is how a user recognises a
       * category in a list and in last month's spending breakdown; a rename that silently
       * re-colours a year of history is worse than having no colour at all.
       */
      const id = "65f1a2b3c4d5e6f708192a3b";

      const before = resolveCategoryAppearance(id, "utensils");
      const after = resolveCategoryAppearance(id, "utensils");

      expect(after.swatch).toBe(before.swatch);

      // And changing the icon does not disturb the colour either: they are independent
      // decisions, so editing one in the group 39 form must not move the other.
      expect(resolveCategoryAppearance(id, "cart").swatch).toBe(before.swatch);
      expect(resolveCategoryAppearance(id, null).swatch).toBe(before.swatch);
    });

    it("spreads ids that differ only in the last character", () => {
      /*
       * The property FNV-1a was chosen for. Categories created seconds apart have ObjectIds
       * differing in the last character or two; a naive sum of char codes puts them in
       * adjacent buckets, which shows up as runs of the same colour down a list of siblings.
       */
      const base = "65f1a2b3c4d5e6f708192a3";
      const colors = new Set(
        "0123456789abcdef".split("").map((suffix) => resolveCategorySwatch(base + suffix)),
      );

      // Sixteen near-identical ids across five buckets: at least four of the five should appear.
      expect(colors.size).toBeGreaterThanOrEqual(4);
    });

    it("distributes a realistic set of ids reasonably evenly", () => {
      const counts = new Map<string, number>();

      for (let index = 0; index < 1_000; index += 1) {
        // Varies across the whole id, as real ObjectIds do.
        const id = `${(index * 2_654_435_761).toString(16).padStart(24, "0").slice(-24)}`;
        const color = resolveCategorySwatch(id);
        counts.set(color, (counts.get(color) ?? 0) + 1);
      }

      expect(counts.size).toBe(SWATCH_COLORS.length);
      // A perfectly even split is 200 each. Anything inside 100-320 is fine; the point is that
      // no bucket is starved or dominant, not that the hash is uniform.
      for (const [color, count] of counts) {
        expect(count, `${color} got ${count} of 1000`).toBeGreaterThan(100);
        expect(count, `${color} got ${count} of 1000`).toBeLessThan(320);
      }
    });
  });

  describe("the combined appearance", () => {
    it("returns a glyph, a colour and a ready-to-use token", () => {
      const appearance = resolveCategoryAppearance("65f1a2b3c4d5e6f708192a3b", "utensils");

      expect(appearance.icon).toBe("cutlery");
      expect(SWATCH_COLORS).toContain(appearance.swatch);
      expect(appearance.swatchToken).toBe(`swatch.${appearance.swatch}`);
    });

    it("builds a semantic token name, not a colour value", () => {
      // Components must never see a hex value: the five fills have dark-mode counterparts and
      // only the token carries both.
      expect(swatchToken("butter")).toBe("swatch.butter");
    });

    it("resolves something for a category with no icon at all", () => {
      const appearance = resolveCategoryAppearance("65f1a2b3c4d5e6f708192a3b", null);

      expect(appearance.icon).toBe(FALLBACK_CATEGORY_ICON);
      expect(SWATCH_COLORS).toContain(appearance.swatch);
    });
  });
});
