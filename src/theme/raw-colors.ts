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
 * wrong colour before the app paints — the kind of mismatch nobody thinks to look for.
 *
 * `src/app/global-error.tsx` deliberately does **not** import these: it must not depend on
 * anything that could be the reason it is rendering.
 *
 * These must stay in step with the values in `tokens.ts`, which is why they name their source.
 */
export const RAW_COLORS = {
  /** `colors.brand.500` in tokens.ts. */
  brand: "#4f5bd5",
  /** `colors.surface` in semantic.ts — what the app paints over. */
  surface: "#ffffff",
} as const;
