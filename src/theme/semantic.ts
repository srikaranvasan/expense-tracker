import { defineSemanticTokens } from "@chakra-ui/react";

/**
 * Semantic tokens.
 *
 * These name a *meaning*, not a colour. Components use these so the intent is readable at
 * the call site and the palette can change without touching them
 * (docs/05-FOLDER-STRUCTURE.md section 5).
 *
 * ## Every value carries both modes
 *
 * Even the ones nothing reads yet. Group 21 decided dark mode ships in this pass, but the
 * rule would hold either way: retrofitting `_dark` across forty semantic tokens later is
 * worse than writing them once now, and a token with only a light value is a token that
 * will be missed.
 *
 * ## The financial set is deliberately small
 *
 * The same four meanings recur on every screen:
 *
 *   positive  money coming in, or a person owing the user
 *   negative  money going out, or the user owing a person
 *   warning   over a credit limit, or a part-settled balance
 *   info      a neutral type marker — transfer, card payment
 *
 * Colour is never the only signal. Every use is paired with a text label so the meaning
 * survives for colour-blind users and screen readers (docs/06-CODING-PRACTICES.md section
 * 40, and docs/design-tasks/01-DESIGN-SYSTEM.md section 9.1).
 */
export const semanticTokens = defineSemanticTokens({
  colors: {
    surface: {
      /**
       * Cards, inputs, headers.
       *
       * The raw tokens behind this are `sheet` and `darkSheet`, **not** `surface`/`darkSurface`. A raw
       * token sharing this group's name would produce `--chakra-colors-surface: var(--chakra-colors-surface)`,
       * which CSS drops as cyclic — see the comment on `colors.sheet` in `tokens.ts`.
       */
      DEFAULT: { value: { base: "{colors.sheet}", _dark: "{colors.darkSheet}" } },
      /** The page background. Named "muted" for continuity with the pre-restyle code. */
      muted: { value: { base: "{colors.paper}", _dark: "{colors.darkPaper}" } },
      /** Inset blocks: the categories inline form, a fieldset inside a card. */
      sunken: { value: { base: "{colors.paper}", _dark: "{colors.darkPaper}" } },
      /** Disabled control fill. */
      disabled: {
        value: { base: "{colors.disabledSurface}", _dark: "{colors.darkDisabledSurface}" },
      },
      /** The quick-add scrim. Identical in both modes — it dims, it does not tint. */
      scrim: { value: { base: "{colors.inkScrim}", _dark: "{colors.inkScrim}" } },
    },

    content: {
      /** Headings and primary text. */
      DEFAULT: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
      /** Nav links, field labels, subtitles, eyebrow labels. */
      muted: { value: { base: "{colors.inkSecondary}", _dark: "{colors.darkInkSecondary}" } },
      /** Timestamps, helper text, card subtitles. */
      subtle: { value: { base: "{colors.inkTertiary}", _dark: "{colors.darkInkTertiary}" } },
      /** Input placeholder and disabled label. */
      quiet: { value: { base: "{colors.inkQuiet}", _dark: "{colors.darkInkMeta}" } },
      /** Reference codes on a plain surface. Inside a tint panel, use `content.onTint`. */
      meta: { value: { base: "{colors.inkMeta}", _dark: "{colors.darkInkMeta}" } },
      /**
       * Body copy on the accent tint.
       *
       * Also what `ReferenceCode` switches to inside a tinted panel: `content.meta`
       * measures 4.2:1 on `tealTint`, just under AA, while this measures 7.8:1.
       */
      onTint: { value: { base: "{colors.inkOnTint}", _dark: "{colors.darkInkSecondary}" } },
      /** Text on an ink-filled surface. Rare in this design. */
      inverted: { value: { base: "{colors.paper}", _dark: "{colors.darkPaper}" } },
      /**
       * Anything drawn **inside** one of the five swatch fills or an avatar: a category
       * glyph, an account glyph, a set of initials.
       *
       * Ink in both modes, deliberately. `DESIGN.md` is explicit that every swatch fill is
       * bright enough for dark ink in either theme, and flipping to light ink in dark mode
       * would make the glyph vanish — measured 1.4:1 to 2.1:1 against the dark fills, against
       * 7.1:1 to 11.1:1 for ink.
       *
       * Distinct from `brand.contrast`, which says the same thing about the teal *button*.
       * They hold the same value today and mean different things: one is about a control, the
       * other about a decorative fill, and a future palette could move one without the other.
       */
      onSwatch: { value: { base: "{colors.ink}", _dark: "{colors.ink}" } },
    },

    /**
     * Borders.
     *
     * `line` is the full-strength ink outline that defines almost every box in this design.
     * The other three are the same ink at reducing alpha, so a card can sit inside a page
     * without competing with the buttons on it.
     */
    line: {
      /** Buttons, subject cards, header rules, focused inputs. 2px. */
      DEFAULT: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
      /** Container-card outline, summary tiles, swatches, avatars. 1.5px at 18%. */
      card: { value: { base: "{colors.inkLine}", _dark: "{colors.darkInkLine}" } },
      /** Row dividers inside a card. 1px at 10%. */
      soft: { value: { base: "{colors.inkLineSoft}", _dark: "{colors.darkInkLineSoft}" } },
      /** Resting input and select border. 1.5px at 28%. */
      field: { value: { base: "{colors.inkLineField}", _dark: "{colors.darkInkLineField}" } },
      /** The 24px graph-paper grid on the unauthenticated layout. 5%. */
      grid: { value: { base: "{colors.inkGrid}", _dark: "{colors.darkInkGrid}" } },
    },

    positive: {
      DEFAULT: { value: { base: "{colors.mintText}", _dark: "{colors.darkMintText}" } },
      surface: { value: { base: "{colors.mint}", _dark: "{colors.darkMint}" } },
    },
    negative: {
      DEFAULT: { value: { base: "{colors.coralText}", _dark: "{colors.darkCoralText}" } },
      surface: { value: { base: "{colors.coral}", _dark: "{colors.darkCoral}" } },
    },
    /**
     * Butter carries no text colour of its own in either table, because ink sits on it —
     * measured 13.4:1 light, 11.1:1 dark. So the foreground is `content`, not a tinted
     * variant.
     */
    warning: {
      DEFAULT: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
      surface: { value: { base: "{colors.butter}", _dark: "{colors.darkButter}" } },
    },
    /** Same reasoning as `warning`: ink on sky measures 11.8:1 light, 9.1:1 dark. */
    info: {
      DEFAULT: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
      surface: { value: { base: "{colors.sky}", _dark: "{colors.darkSky}" } },
    },

    /**
     * Drives Chakra's `colorPalette="brand"`, so branded components pick up the right
     * foreground and background without per-component overrides.
     */
    brand: {
      solid: { value: { base: "{colors.teal}", _dark: "{colors.darkTeal}" } },
      /**
       * Ink on teal in **both** modes, not `darkInk` in dark.
       *
       * The teal fill is bright in both palettes (`#7FD1C3` and `#4FB9A8`), so light text
       * on it would measure 2.1:1 and effectively disappear. `DESIGN.md` states this rule
       * for swatch contents; it applies identically to the primary button, which is the
       * same fill. Measured: ink on teal 9.5:1 light, 7.1:1 dark.
       */
      contrast: { value: { base: "{colors.ink}", _dark: "{colors.ink}" } },
      /** Links, eyebrow accents, card-action links, active nav text. */
      fg: { value: { base: "{colors.tealText}", _dark: "{colors.darkTealText}" } },
      /** The accent-tint panel and reference boxes. */
      muted: { value: { base: "{colors.tealTint}", _dark: "{colors.darkTealTint}" } },
      subtle: { value: { base: "{colors.tealTint}", _dark: "{colors.darkTealTint}" } },
      emphasized: { value: { base: "{colors.teal}", _dark: "{colors.darkTeal}" } },
      /**
       * Ink, not teal.
       *
       * Focus in this design is a teal *offset shadow* plus a border promotion to full ink
       * (section 5.3), not a ring. This token is what Chakra's own recipes reach for when
       * they draw a ring, and ink is the value that reads as "focused" in this language.
       * The teal offset lives in `shadows.hardFocus` below.
       */
      focusRing: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
    },

    /**
     * The five swatch fills, addressable by name.
     *
     * Exists so the category and account mappings in section 6.4 can be a lookup table
     * keyed on a colour *name* rather than a switch on hex values, and so the deterministic
     * fallback in `features/categories/icon-map.ts` can index into a list of five.
     */
    swatch: {
      teal: { value: { base: "{colors.teal}", _dark: "{colors.darkTeal}" } },
      mint: { value: { base: "{colors.mint}", _dark: "{colors.darkMint}" } },
      coral: { value: { base: "{colors.coral}", _dark: "{colors.darkCoral}" } },
      butter: { value: { base: "{colors.butter}", _dark: "{colors.darkButter}" } },
      sky: { value: { base: "{colors.sky}", _dark: "{colors.darkSky}" } },
    },
  },

  /**
   * Hard offset shadows, no blur. `N` scales with the element's importance.
   *
   * These are **semantic**, not raw, tokens — a deliberate departure from the shape
   * suggested in section 5.3 of the design system document. The shadow colour is not
   * constant across modes: the handoff's dark screens draw `4px 4px 0 #F3F0FA`, i.e. the
   * shadow flips to `darkInk`. An ink shadow on a `#141220` page would be invisible, so a
   * raw token with a fixed colour would silently lose the entire elevation system in dark
   * mode. Verified in `design/ux/screens/Dashboard-Dark.html` and
   * `Mobile-Dashboard-Dark.html`.
   */
  shadows: {
    /** Quick-add action pills. */
    hardSm: {
      value: { base: "3px 3px 0 {colors.ink}", _dark: "3px 3px 0 {colors.darkInk}" },
    },
    /** Buttons and the FAB. */
    hard: {
      value: { base: "4px 4px 0 {colors.ink}", _dark: "4px 4px 0 {colors.darkInk}" },
    },
    /** Form cards that are the subject of the page. */
    hardLg: {
      value: { base: "6px 6px 0 {colors.ink}", _dark: "6px 6px 0 {colors.darkInk}" },
    },
    /** The sign-in card. */
    hardXl: {
      value: { base: "8px 8px 0 {colors.ink}", _dark: "8px 8px 0 {colors.darkInk}" },
    },
    /**
     * Focus.
     *
     * Teal in light mode, as drawn in `Style-Guide.html` (`4px 4px 0 #7FD1C3`). The dark
     * value is derived — the handoff draws no focused control on a dark screen — using
     * `darkTeal`, the dark table's counterpart of the same fill.
     */
    hardFocus: {
      value: { base: "4px 4px 0 {colors.teal}", _dark: "4px 4px 0 {colors.darkTeal}" },
    },
  },

  /**
   * Kills rounded corners across every built-in Chakra recipe in one place.
   *
   * Chakra v3's recipes do not reference `radii.md` directly — they reference the semantic
   * radii `l1`, `l2`, `l3`, which the base preset points at `radii.xs`/`sm`/`md`.
   * Overriding those three is what makes Button, Input, NativeSelect, Alert, Badge and
   * everything else square without touching a single component.
   *
   * `index.ts` carries a blunt global reset as well. The two mechanisms fail differently:
   * this one misses anything that hard-codes a radius, the global one misses nothing but
   * cannot be overridden locally. Together they make "no rounded corners" a property of the
   * app rather than something to remember.
   */
  radii: {
    l1: { value: "0" },
    l2: { value: "0" },
    l3: { value: "0" },
  },
});
