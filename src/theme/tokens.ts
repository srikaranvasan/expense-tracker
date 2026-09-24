import { defineTokens } from "@chakra-ui/react";

/**
 * Raw design tokens for "Ledger Geometry".
 *
 * These are the primitive values. Nothing in the application references them
 * directly: components use the semantic tokens in `semantic.ts`, so a palette
 * change happens in one place (docs/05-FOLDER-STRUCTURE.md section 5).
 *
 * ## Why these are flat names rather than 50-900 scales
 *
 * The previous palette used numbered ramps, which is the right shape when shades are
 * interpolated. This one is a **designed pairing**: five pastel fills each with one text
 * colour that was chosen to sit on it, and a dark set drawn separately rather than derived.
 * A `teal.300` would invite someone to reach for `teal.400`, which nobody has approved and
 * which has no counterpart in the dark table.
 *
 * Source: `design/ux/DESIGN.md`, the two colour tables.
 * Rules: `docs/design-tasks/01-DESIGN-SYSTEM.md` section 3.1.
 */
export const tokens = defineTokens({
  colors: {
    /* --- Light ----------------------------------------------------------- */

    /** Page background. Warm off-white, not grey. */
    paper: { value: "#FAF7F2" },
    /**
     * Cards, inputs, headers.
     *
     * Named `sheet`, not `surface`, and the reason is a trap worth knowing about.
     *
     * A raw token and a semantic token that share a name also share a CSS variable name, so a raw
     * `colors.surface` alongside the semantic `colors.surface.DEFAULT` makes Chakra emit
     * `--chakra-colors-surface: var(--chakra-colors-surface)`. CSS treats a self-referencing custom
     * property as cyclic and drops it **entirely** — the variable becomes undefined, every
     * `bg="surface"` in the app resolves to an invalid value, and the element ends up transparent.
     *
     * It is a silent failure: nothing errors, nothing warns, and on a light page a transparent card
     * on a near-white background looks almost right. It shipped through four groups before a browser
     * measurement caught it. `src/theme/theme.test.ts` now asserts no semantic group with a `DEFAULT`
     * shares a name with a raw colour.
     */
    sheet: { value: "#FFFFFF" },
    /**
     * Every border, heading and piece of primary text.
     *
     * Note this is `#1E1B29`, one digit from `darkSurface` (`#1E1B2C`). The two are
     * unrelated and the similarity is a transcription trap — both are quoted verbatim from
     * `DESIGN.md`'s separate light and dark tables.
     */
    ink: { value: "#1E1B29" },
    /** Nav links, field labels, subtitles. */
    inkSecondary: { value: "#5B5770" },
    /**
     * Timestamps, helper text, card subtitles.
     *
     * Drawn as `#8B87A0`, which measures 3.5:1 on white and fails WCAG AA at the 11-13px
     * sizes it is used at. Darkened to 5.5:1 — see
     * `docs/design-tasks/updates/GROUP-21-DESIGN-DECISIONS.md` section 3.8.
     */
    inkTertiary: { value: "#6A6682" },
    /** Input placeholder, disabled text. Drawn as `#A6A2BC` (2.5:1); darkened to 5.0:1. */
    inkQuiet: { value: "#706C88" },
    /** Reference codes. Drawn as `#B4B0C4` (2.1:1); darkened to 4.9:1. */
    inkMeta: { value: "#726E8A" },
    /** Body copy inside the accent-tint panel. Undocumented in the handoff tables. */
    inkOnTint: { value: "#4A465B" },
    /** Disabled button fill. Undocumented in the handoff tables. */
    disabledSurface: { value: "#EDEAE3" },

    /**
     * Ink at three alpha steps, for the borders that are structural but not emphatic.
     *
     * Written as literal `rgba()` rather than a `{colors.ink/18}` reference on purpose.
     * Chakra's opacity modifier is documented for style props; relying on it inside a
     * token *definition* would make three of the most repeated borders in the app depend
     * on behaviour that is easy to get silently wrong — a border that resolves to fully
     * opaque ink looks like a design decision, not a bug. The alpha values are exactly
     * those in the handoff CSS.
     */
    inkLine: { value: "rgba(30, 27, 41, 0.18)" },
    inkLineSoft: { value: "rgba(30, 27, 41, 0.1)" },
    inkLineField: { value: "rgba(30, 27, 41, 0.28)" },
    /** The 24px graph-paper grid on the unauthenticated layout (section 5.5). */
    inkGrid: { value: "rgba(30, 27, 41, 0.05)" },
    /** The quick-add scrim. Drawn from `darkPaper` at 45%, and the same in both modes. */
    inkScrim: { value: "rgba(20, 18, 32, 0.45)" },

    /** Primary fill: buttons, the FAB, the logo mark, active-nav underline. */
    teal: { value: "#7FD1C3" },
    /** Links, eyebrow accents, active nav text, card-action links. */
    /**
     * Darkened from the handoff's `#1D7A6C` by group 40.
     *
     * The drawn value measures **4.47:1 on `tealTint`** — the "Why this matters" eyebrow and the
     * net-position band's "computed" marker both sit there — which misses AA by 0.03. It is fine on
     * white (5.3:1), so the failure only appears where the design puts teal text on the teal tint.
     * This value clears AA on both.
     */
    tealText: { value: "#17685B" },
    /** Net-position banner, reference boxes, the "why this matters" side panel. */
    tealTint: { value: "#DCF3EE" },
    /** Positive fill: "owes you" avatars and tiles. */
    mint: { value: "#BFEBD2" },
    /**
     * Positive text. **Darkened from the handoff's `#2E8A61`** (group 40).
     *
     * The drawn value measures **4.26:1 on white** and 3.99:1 on `paper`. `Amount` renders a
     * positive figure at 14px/600 in every list row, which is normal-size text by WCAG's
     * definition — bold starts at 700 — so 4.5:1 applies and the drawn value misses it on both
     * backgrounds. It only passes as a large tile figure, which is where the handoff draws it.
     *
     * This value measures 5.5:1 on white, 5.2:1 on `paper` and 4.8:1 on `tealTint`.
     */
    mintText: { value: "#277650" },
    /** Negative fill: "you owe" avatars and tiles. */
    coral: { value: "#FFC7B8" },
    /** Negative text, and the required-field asterisk. */
    /**
     * Darkened from the handoff's `#D1523F` by group 40.
     *
     * The drawn value measures **4.21:1 on white** at the sizes it is actually used — a 14px/600 card
     * debt figure and an 11px required-field asterisk — so it failed AA everywhere it appeared, not
     * just in one place. This value clears it.
     */
    coralText: { value: "#BA402E" },
    /** Pending / caution fill. Never carries text of its own; ink sits on it. */
    butter: { value: "#FCE49B" },
    /** Category and transaction-type badge fill. */
    sky: { value: "#C0DBF7" },

    /* --- Dark ------------------------------------------------------------ */

    darkPaper: { value: "#141220" },
    /**
     * Cards, inputs, headers. **Not** `#1E1B29` — that is the light ink.
     *
     * Named `darkSheet` for symmetry with `sheet`. It does not collide with anything today, but
     * naming one of the pair defensively and the other not is how the next person reintroduces the
     * problem described on `sheet`.
     */
    darkSheet: { value: "#1E1B2C" },
    darkInk: { value: "#F3F0FA" },
    darkInkSecondary: { value: "#B7B2CC" },
    darkInkTertiary: { value: "#9B96B3" },
    /** Drawn as `#6C6884` (3.2:1 on `darkSurface`); lightened to 5.1:1. */
    darkInkMeta: { value: "#8F8AA8" },
    /**
     * Derived, not designed. `darkSurface` lifted toward `darkInkMeta` by roughly the
     * amount that separates the light `disabledSurface` from `paper`. Flagged for the
     * designer in group 21.
     */
    darkDisabledSurface: { value: "#2A2739" },

    /** The dark counterparts of the four alpha steps. Same alphas, inverted base. */
    darkInkLine: { value: "rgba(243, 240, 250, 0.18)" },
    darkInkLineSoft: { value: "rgba(243, 240, 250, 0.1)" },
    darkInkLineField: { value: "rgba(243, 240, 250, 0.28)" },
    darkInkGrid: { value: "rgba(243, 240, 250, 0.05)" },

    darkTeal: { value: "#4FB9A8" },
    darkTealText: { value: "#7EE3D2" },
    darkTealTint: { value: "#16302C" },
    darkMint: { value: "#8FDBB4" },
    darkMintText: { value: "#8CE3B2" },
    darkCoral: { value: "#FF9F8C" },
    darkCoralText: { value: "#FF9C86" },
    darkButter: { value: "#F0CE6E" },
    darkSky: { value: "#93C3F0" },
  },

  /**
   * Borders carry the structure in this design the way shadows do in most others, so the
   * weight is meaningful rather than decorative
   * (`docs/design-tasks/01-DESIGN-SYSTEM.md` section 5.2).
   */
  borderWidths: {
    /** Row dividers inside a card. Pair with `line.soft`. */
    hairline: { value: "1px" },
    /** Card outline, summary tiles, small swatches, avatars, resting inputs. */
    thin: { value: "1.5px" },
    /** Buttons, subject cards, header rules, bottom-nav top rule, focused inputs. */
    thick: { value: "2px" },
    /** The registration-tick corner brackets on the sign-in card. */
    tick: { value: "2.5px" },
    /** Active-nav underline. */
    accent: { value: "3px" },
    /** The coloured top edge of a summary tile. */
    tile: { value: "4px" },
  },

  /**
   * Zero everywhere — nothing in this design is rounded and nothing is a pill.
   *
   * Kept as a named token rather than a literal `0` in components so a future decision to
   * soften exactly one thing has exactly one place to happen. The enforcement is in
   * `semantic.ts` (`radii.l1/l2/l3`) and `index.ts` (the global reset).
   */
  radii: {
    none: { value: "0" },
  },

  sizes: {
    /** Comfortable minimum touch target for one-handed use. */
    touch: { value: "2.75rem" },
    /**
     * Maximum content width on desktop.
     *
     * 85rem (1360px), not the previous 64rem. The handoff is drawn at 1440px with 40px
     * gutters, so 1360px is the content column it was composed in; 64rem would reflow every
     * desktop screen and the four-up tile grids would stop matching the drawings.
     */
    content: { value: "85rem" },
    /** The mobile quick-add button. 52px. */
    fab: { value: "3.25rem" },
  },

  /**
   * Three faces, one job each (docs/design-tasks/01-DESIGN-SYSTEM.md section 4).
   *
   *   heading  Space Grotesk   titles, nav and button labels, avatar initials
   *   body     Manrope         descriptions, helper text, list item names
   *   mono     IBM Plex Mono   every amount, date, code, eyebrow, badge and stamp
   *
   * The values are CSS variables, not family names. `src/app/fonts.ts` defines them via
   * `next/font/google` and the root layout applies them to `<html>`, so the files are
   * self-hosted and content-hashed rather than fetched from a third party. The system
   * fallbacks matter for the moment before the variables resolve and for the case where
   * the build ran without them.
   *
   * The rule worth remembering: **if it is a number, it is mono.**
   */
  fonts: {
    heading: {
      value:
        'var(--font-space-grotesk), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
    body: {
      value:
        'var(--font-manrope), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
    mono: {
      value:
        'var(--font-ibm-plex-mono), ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    },
  },

  /**
   * The type scale, by role rather than by size.
   *
   * Chakra's default `2xs`-`7xl` steps are deliberately left untouched: every built-in
   * recipe is sized against them, and redefining `md` would resize components this
   * project does not restyle. These are additional steps.
   *
   * They are named for the role because the design's small end needs 11px, 13px, 15px,
   * 17px and 19px, and rounding those to the nearest default (12, 14, 16, 18, 20) is a
   * 5-10% error at sizes where that is plainly visible. Naming the role also makes the
   * call site say what it means — `fontSize="eyebrow"` rather than `fontSize="xs"` — and
   * keeps the pixel values out of components, which is the actual rule
   * (docs/design-tasks/01-DESIGN-SYSTEM.md section 4.2).
   *
   * Half-pixel values in the handoff (14.5px, 12.5px) are artefacts of hand-drawing and
   * are rounded here, once.
   */
  fontSizes: {
    /** 10px — badge label, tab-bar label, eyebrow on mobile. */
    badge: { value: "0.625rem" },
    /** 11px — eyebrow label, reference code, field error text. */
    eyebrow: { value: "0.6875rem" },
    /** 12px — row meta text: timestamps, "1 expense outstanding". */
    meta: { value: "0.75rem" },
    /** 13px — card subtitle, mobile page description, mobile row text. */
    subtitle: { value: "0.8125rem" },
    /** 14px — row primary text, button label, nav link. */
    row: { value: "0.875rem" },
    /** 15px — page description, input text, section title inside a card. */
    control: { value: "0.9375rem" },
    /** 17px — card title on desktop. */
    cardTitle: { value: "1.0625rem" },
    /** 19px — amount input, summary-tile figure on mobile. */
    figure: { value: "1.1875rem" },
    /** 24px — summary-tile figure on desktop. */
    figureLg: { value: "1.5rem" },
    /** 28px — the net-position hero figure on desktop. */
    hero: { value: "1.75rem" },
    /** 26px — page title on mobile. */
    pageTitleSm: { value: "1.625rem" },
    /** 30px — page title on desktop. */
    pageTitle: { value: "1.875rem" },
  },

  /**
   * The eyebrow label is the most repeated typographic device in this design, so its
   * tracking is a token rather than `.08em` retyped on every screen.
   */
  letterSpacings: {
    /** Eyebrow labels, field labels. */
    eyebrow: { value: "0.08em" },
    /** Eyebrow labels that need to read as a wider rule, e.g. the dashboard "AS OF". */
    eyebrowWide: { value: "0.1em" },
    /** Status badges. Tighter, because the text sits inside a 8px-padded chip. */
    badge: { value: "0.06em" },
    /** The rotated dashed confirmation stamps (section 5.4). */
    stamp: { value: "0.1em" },
  },
});

/** Re-exported so `@/theme/tokens` remains the one import site for colour values. */
export { RAW_COLORS } from "./raw-colors";
