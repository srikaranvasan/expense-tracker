import { describe, expect, it } from "vitest";
import { system } from "./index";
import { RAW_COLORS } from "./raw-colors";
import { semanticTokens } from "./semantic";
import { tokens } from "./tokens";

/**
 * Tests for the design system itself.
 *
 * A theme is normally left untested on the grounds that it is data, and for a palette of
 * numbered ramps that is fair. This one carries rules that are expensive to break and
 * invisible when broken:
 *
 *   - every semantic colour must define **both** modes, or a screen loses its colour in
 *     dark mode and nothing fails
 *   - every radius must be zero, which is enforced in two places that can drift apart
 *   - ink must stay on the teal fill in dark mode, against the instinct to flip it
 *   - three text colours were darkened for WCAG AA and would be quietly reverted by anyone
 *     copying the values out of the handoff
 *
 * None of those produce a type error, a lint warning or a failing render. They produce a
 * screen that looks slightly wrong to someone who never saw the design.
 *
 * `getByName` returns the token with its raw `value` and, in `extensions.conditions`, the
 * per-mode values before resolution — which is the only way to assert a `_dark` value exists
 * without rendering in two colour modes.
 */

type TokenConditions = Record<string, string> | undefined;

function conditionsFor(name: string): TokenConditions {
  const token = system.tokens.getByName(name);
  expect(token, `token ${name} should exist`).toBeDefined();
  return (token as { extensions?: { conditions?: Record<string, string> } } | undefined)?.extensions
    ?.conditions;
}

function rawValueFor(name: string): string {
  const token = system.tokens.getByName(name);
  expect(token, `token ${name} should exist`).toBeDefined();
  return String((token as { value?: unknown } | undefined)?.value ?? "");
}

/** Every semantic colour token a component is allowed to name. */
const SEMANTIC_COLORS = [
  "colors.surface",
  "colors.surface.muted",
  "colors.surface.sunken",
  "colors.surface.disabled",
  "colors.surface.scrim",
  "colors.content",
  "colors.content.muted",
  "colors.content.subtle",
  "colors.content.quiet",
  "colors.content.meta",
  "colors.content.onTint",
  "colors.content.inverted",
  "colors.line",
  "colors.line.card",
  "colors.line.soft",
  "colors.line.field",
  "colors.line.grid",
  "colors.positive",
  "colors.positive.surface",
  "colors.negative",
  "colors.negative.surface",
  "colors.warning",
  "colors.warning.surface",
  "colors.info",
  "colors.info.surface",
  "colors.brand.solid",
  "colors.brand.contrast",
  "colors.brand.fg",
  "colors.brand.muted",
  "colors.brand.subtle",
  "colors.brand.emphasized",
  "colors.brand.focusRing",
  "colors.swatch.teal",
  "colors.swatch.mint",
  "colors.swatch.coral",
  "colors.swatch.butter",
  "colors.swatch.sky",
];

describe("design tokens", () => {
  describe("both colour modes are defined everywhere", () => {
    it.each(SEMANTIC_COLORS)("%s has a base and a _dark value", (name) => {
      const conditions = conditionsFor(name);

      // A token with only a base value is a token that will be missed when dark mode is
      // switched on, and the failure is a screen that looks washed out rather than an error.
      expect(conditions?.base, `${name} is missing a base value`).toBeTruthy();
      expect(conditions?._dark, `${name} is missing a _dark value`).toBeTruthy();
    });

    it.each([
      "shadows.hardSm",
      "shadows.hard",
      "shadows.hardLg",
      "shadows.hardXl",
      "shadows.hardFocus",
    ])("%s has a base and a _dark value", (name) => {
      const conditions = conditionsFor(name);
      expect(conditions?.base).toBeTruthy();
      expect(conditions?._dark).toBeTruthy();
    });
  });

  describe("geometry", () => {
    it.each(["radii.l1", "radii.l2", "radii.l3"])("%s is zero", (name) => {
      // Chakra's own recipes reference l1/l2/l3, not radii.md. Overriding these three is
      // what makes Button, Input, NativeSelect, Alert and Badge square without touching a
      // component.
      expect(rawValueFor(name)).toBe("0");
    });

    it("keeps a named zero radius rather than leaving components to write 0", () => {
      expect(rawValueFor("radii.none")).toBe("0");
    });

    it("declares every border weight the design distinguishes", () => {
      // The weight is meaningful in this design: 1px divides rows, 1.5px outlines a
      // container, 2px outlines the subject of the page. Collapsing two of them loses the
      // hierarchy that borders carry here instead of shadows.
      expect(rawValueFor("borderWidths.hairline")).toBe("1px");
      expect(rawValueFor("borderWidths.thin")).toBe("1.5px");
      expect(rawValueFor("borderWidths.thick")).toBe("2px");
      expect(rawValueFor("borderWidths.tick")).toBe("2.5px");
      expect(rawValueFor("borderWidths.accent")).toBe("3px");
      expect(rawValueFor("borderWidths.tile")).toBe("4px");
    });

    it("widens the content column to the width the handoff was drawn at", () => {
      // 1360px. The previous 64rem would reflow every desktop screen and the four-up tile
      // grids would stop matching the drawings.
      expect(rawValueFor("sizes.content")).toBe("85rem");
      expect(rawValueFor("sizes.touch")).toBe("2.75rem");
    });

    it("resets border radius globally as well as through the tokens", () => {
      // Belt and braces. The token override misses anything that hard-codes a radius; this
      // misses nothing. Both are needed — see the comment in semantic.ts.
      const globalCss = JSON.stringify(system.getGlobalCss());
      expect(globalCss).toContain("0 !important");
    });
  });

  describe("contrast decisions from group 21 are applied", () => {
    /*
     * Three values fail WCAG AA at the sizes they are drawn, and all three are on
     * essentially every screen: helper text, placeholders, reference codes. They were
     * measured and darkened in GROUP-21-DESIGN-DECISIONS.md section 3.8. Anyone copying the
     * palette out of the handoff would revert them, which is what these assertions are for.
     */
    it("uses the darkened content.subtle, not the drawn #8B87A0", () => {
      expect(rawValueFor("colors.inkTertiary")).toBe("#6A6682");
    });

    it("uses the darkened content.quiet, not the drawn #A6A2BC", () => {
      expect(rawValueFor("colors.inkQuiet")).toBe("#706C88");
    });

    it("uses the darkened content.meta, not the drawn #B4B0C4", () => {
      expect(rawValueFor("colors.inkMeta")).toBe("#726E8A");
    });

    it("uses the lightened dark meta, not the drawn #6C6884", () => {
      expect(rawValueFor("colors.darkInkMeta")).toBe("#8F8AA8");
    });
  });
  describe("contrast decisions from group 40's audit are applied", () => {
    /*
     * Two more, found by measuring every rendered text/background pair rather than reading the
     * palette. They are the pairs group 21 could not have caught, because both only fail *in
     * context*: `tealText` is fine on paper and fails on the tint panel it is drawn on, and
     * `coralText` is fine as a large figure and fails at the 14px/600 and 11px sizes it ended up
     * at. Both are deviations from the handoff's hex values and are listed for designer sign-off
     * in GROUP-40-ACCESSIBILITY.md.
     */
    it("uses the darkened tealText, not the drawn #1D7A6C", () => {
      // 4.47:1 on `tealTint` — a rounding error short of AA, on the accent panel's own eyebrow.
      // #17685B measures 5.6:1 there and still reads as the same teal.
      expect(rawValueFor("colors.tealText")).toBe("#17685B");
    });
    it("uses the darkened coralText, not the drawn #D1523F", () => {
      // 4.21:1 on white, which is below AA for the 14px semibold amounts and the 11px required
      // asterisk. #BA402E measures 5.3:1.
      expect(rawValueFor("colors.coralText")).toBe("#BA402E");
    });
  });

  describe("the fixed-ink rule", () => {
    it("keeps ink on the teal fill in both modes", () => {
      const conditions = conditionsFor("colors.brand.contrast");

      /*
       * The instinct is to flip this to darkInk in dark mode, and it is wrong. Both teal
       * fills are bright (#7FD1C3 and #4FB9A8), so light text on them measures around
       * 2.1:1 and effectively disappears. Ink measures 9.5:1 light and 7.1:1 dark.
       * DESIGN.md states the rule for swatch contents; the primary button is the same fill.
       */
      expect(conditions?.base).toBe("{colors.ink}");
      expect(conditions?._dark).toBe("{colors.ink}");
    });

    it("does not tint the scrim by mode", () => {
      // A scrim dims; it does not carry the theme.
      const conditions = conditionsFor("colors.surface.scrim");
      expect(conditions?.base).toBe(conditions?._dark);
    });
  });

  describe("no semantic colour shadows a raw one", () => {
    /**
     * The bug this exists to prevent, because it shipped through four groups undetected.
     *
     * A raw token and a semantic token that share a name also share a CSS variable name. So a raw
     * `colors.surface` alongside a semantic group `surface` with a `DEFAULT` makes Chakra emit:
     *
     *     --chakra-colors-surface: var(--chakra-colors-surface)
     *
     * CSS treats a self-referencing custom property as cyclic and drops it **entirely**. The variable
     * becomes undefined, every `bg="surface"` in the app resolves to an invalid value, and the element
     * renders transparent.
     *
     * Nothing errors. Nothing warns. On a light page a transparent card on a near-white background
     * looks almost right, and the unit tests still pass because `background` really is
     * `var(--chakra-colors-surface)` — the variable just does not exist. It took measuring
     * `getPropertyValue("--chakra-colors-surface")` in a real browser to find it.
     *
     * Only a semantic group with a `DEFAULT` is at risk: `surface.muted` becomes
     * `--chakra-colors-surface-muted`, which no raw name can collide with.
     */
    const rawColorNames = new Set(Object.keys(tokens.colors ?? {}));

    const semanticGroupsWithDefault = Object.entries(semanticTokens.colors ?? {})
      .filter(([, group]) => group !== null && typeof group === "object" && "DEFAULT" in group)
      .map(([name]) => name);

    it("has semantic groups with a DEFAULT to check", () => {
      // Guards the guard: if the filter above ever stops matching, the test below passes vacuously.
      expect(semanticGroupsWithDefault.length).toBeGreaterThan(5);
    });

    it.each(semanticGroupsWithDefault)(
      "semantic '%s' does not collide with a raw token",
      (name) => {
        expect(
          rawColorNames.has(name),
          `raw colors.${name} would make --chakra-colors-${name} cyclic`,
        ).toBe(false);
      },
    );

    it("resolves surface to the sheet token, not to itself", () => {
      // The specific case that broke. `sheet` and `darkSheet` are named to avoid the collision.
      const conditions = conditionsFor("colors.surface");
      expect(conditions?.base).toBe("{colors.sheet}");
      expect(conditions?._dark).toBe("{colors.darkSheet}");
    });
  });

  describe("the old palette is gone, not shadowed", () => {
    it.each([
      "colors.brand.500",
      "colors.brand.50",
      "colors.ink.50",
      "colors.ink.900",
      "colors.money.in",
      "colors.money.out",
      "colors.caution.500",
      "radii.card",
    ])("%s no longer exists", (name) => {
      // Leaving the previous ramps in place alongside the new names would guarantee a
      // half-migrated app: both resolve, neither errors, and the two visual languages sit
      // side by side on the same screen.
      expect(system.tokens.getByName(name)).toBeUndefined();
    });
  });

  describe("the dark palette is transcribed exactly from the handoff", () => {
    /*
     * Every value in `design/ux/DESIGN.md`'s dark colour table, asserted literally.
     *
     * This is a transcription check, not a design judgement. Thirteen hex values were copied
     * by hand from a markdown table, and a wrong digit in a dark-mode value is close to
     * undiscoverable — nobody was looking at dark mode when this landed, and the two dark
     * artboards it has to reproduce are in a different file.
     *
     * The two exceptions are `darkInkMeta`, deliberately lightened for contrast, and
     * `darkDisabledSurface`, which the handoff does not define at all. Both are asserted
     * elsewhere with their reasons.
     */
    it.each([
      ["colors.darkPaper", "#141220"],
      ["colors.darkSheet", "#1E1B2C"],
      ["colors.darkInk", "#F3F0FA"],
      ["colors.darkInkSecondary", "#B7B2CC"],
      ["colors.darkInkTertiary", "#9B96B3"],
      ["colors.darkTeal", "#4FB9A8"],
      ["colors.darkTealText", "#7EE3D2"],
      ["colors.darkTealTint", "#16302C"],
      ["colors.darkMint", "#8FDBB4"],
      ["colors.darkMintText", "#8CE3B2"],
      ["colors.darkCoral", "#FF9F8C"],
      ["colors.darkCoralText", "#FF9C86"],
      ["colors.darkButter", "#F0CE6E"],
      ["colors.darkSky", "#93C3F0"],
    ])("%s is %s", (name, hex) => {
      expect(rawValueFor(name)).toBe(hex);
    });

    it("draws the hard shadow in darkInk, as the dark artboards do", () => {
      // design/ux/screens/Dashboard-Dark.html and Mobile-Dashboard-Dark.html both use
      // `box-shadow: 4px 4px 0 #F3F0FA`. An ink shadow on a #141220 page is invisible, so
      // getting this wrong silently deletes the elevation system in dark mode.
      expect(conditionsFor("shadows.hard")?._dark).toBe("4px 4px 0 {colors.darkInk}");
    });
  });

  describe("raw-colors.ts stays in step with the tokens", () => {
    /*
     * These four literals reach the manifest, the theme-color meta tag and the generated
     * icons — places CSS cannot. A drift shows up as an installed app that flashes the wrong
     * colour before it paints, which is precisely the failure nobody thinks to look for.
     */
    it("matches colors.teal, colors.paper, colors.ink and colors.darkPaper", () => {
      expect(RAW_COLORS.brand).toBe(rawValueFor("colors.teal"));
      expect(RAW_COLORS.surface).toBe(rawValueFor("colors.paper"));
      expect(RAW_COLORS.ink).toBe(rawValueFor("colors.ink"));
      expect(RAW_COLORS.darkSurface).toBe(rawValueFor("colors.darkPaper"));
    });

    it("does not confuse the dark surface with the light ink", () => {
      // #1E1B2C and #1E1B29 differ by one digit and mean unrelated things. Both are quoted
      // verbatim from DESIGN.md's two colour tables.
      expect(rawValueFor("colors.darkSheet")).toBe("#1E1B2C");
      expect(rawValueFor("colors.ink")).toBe("#1E1B29");
      expect(rawValueFor("colors.darkSheet")).not.toBe(rawValueFor("colors.ink"));
    });
  });

  describe("typography survived the palette replacement", () => {
    // Group 22's work lives in the same two files group 23 rewrote, so this is a guard
    // against a well-meaning "replace the theme" commit.
    it("keeps the three font tokens pointing at the next/font variables", () => {
      expect(rawValueFor("fonts.heading")).toContain("--font-space-grotesk");
      expect(rawValueFor("fonts.body")).toContain("--font-manrope");
      expect(rawValueFor("fonts.mono")).toContain("--font-ibm-plex-mono");
    });

    it("keeps the role-named type scale", () => {
      expect(rawValueFor("fontSizes.eyebrow")).toBe("0.6875rem");
      expect(rawValueFor("fontSizes.pageTitle")).toBe("1.875rem");
    });

    it("keeps the eyebrow tracking", () => {
      expect(rawValueFor("letterSpacings.eyebrow")).toBe("0.08em");
      expect(rawValueFor("letterSpacings.stamp")).toBe("0.1em");
    });

    it("keeps the amount text style carrying the mono family and tabular figures", () => {
      // Resolved through `system.css` rather than read off the config, so this exercises the
      // path a component actually takes when it says `textStyle="amount"`.
      const amount = JSON.stringify(system.css({ textStyle: "amount" }));

      expect(amount).toContain("--chakra-fonts-mono");
      expect(amount).toContain("tabular-nums");
    });

    it("keeps the eyebrow text style carrying mono, uppercase and the tracking", () => {
      const eyebrow = JSON.stringify(system.css({ textStyle: "eyebrow" }));

      expect(eyebrow).toContain("--chakra-fonts-mono");
      expect(eyebrow).toContain("uppercase");
      expect(eyebrow).toContain("--chakra-letter-spacings-eyebrow");
    });
  });
});
