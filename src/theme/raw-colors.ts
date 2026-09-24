/**
 * Brand colours as literal strings, for the places CSS cannot reach.
 *
 * The web app manifest, the `theme-color` meta tag, the generated icons and the OS splash
 * screen are consumed by the browser and the operating system rather than by the stylesheet,
 * so they need a concrete value instead of a token reference.
 *
 * ## Why this is a separate file from `tokens.ts`
 *
 * It has no imports, deliberately. `tokens.ts` imports `defineTokens` from Chakra, and
 * `scripts/generate-icons.ts` runs in plain Node where pulling in the whole UI library to read
 * two hex strings would be absurd. Keeping these dependency-free means the icon script and the
 * manifest can share one definition.
 *
 * ## Why it exists at all
 *
 * The group 20 review found the same two colours written out in three separate files. A palette
 * change that missed one would show up as an installed app whose splash screen flashes the
 * wrong colour before the app paints — the kind of mismatch nobody thinks to look for. The
 * restyle in group 23 is exactly that palette change, and it is the reason `icons:generate`
 * has to be re-run in the same commit.
 *
 * `src/app/global-error.tsx` deliberately does **not** import these: it must not depend on
 * anything that could be the reason it is rendering. It repeats the values by hand and is
 * updated alongside this file.
 *
 * These must stay in step with the values in `tokens.ts`, which is why they name their source.
 */
export const RAW_COLORS = {
  /** `colors.teal` in tokens.ts — the brand fill, and the icon background. */
  brand: "#7FD1C3",
  /**
   * `colors.paper` in tokens.ts — the page background, and what the app paints over.
   *
   * Changed from `#ffffff` in the same commit as the palette. It is the `theme-color` and
   * the manifest `background_color`, so it is the colour the OS shows for the fraction of a
   * second before the app paints. White against a `#FAF7F2` page is a visible flash on
   * launch — small, but it is the whole reason this file exists.
   */
  surface: "#FAF7F2",
  /** `colors.ink` in tokens.ts — borders, and the mark drawn on the brand fill. */
  ink: "#1E1B29",
  /** `colors.darkPaper` in tokens.ts — the `theme-color` when dark mode is active. */
  darkSurface: "#141220",
} as const;
