import { describe, expect, it } from "vitest";
import { system } from "./index";

/**
 * WCAG AA contrast, computed from the tokens themselves.
 *
 * Group 40's audit measured every rendered text/background pair in a real browser. That pass found
 * three failures, and it could only find them on the screens and in the states that happened to be
 * on screen: a danger button that only appears on a delete confirmation, a sync bar that only
 * appears when a queued change is rejected, and a positive amount that needs a shared expense to
 * exist. A browser sweep proves what is on the page; it cannot prove what is not.
 *
 * So the pairs are asserted here instead, from the token definitions, in both modes, every run.
 * This is the artefact that makes the audit repeatable — the browser pass is still needed for
 * focus, target size and accessible names, none of which are derivable from a palette.
 *
 * ## Why the pairs are listed by hand
 *
 * A cross product of every foreground against every background would be forty-odd assertions about
 * combinations nothing draws, and the first time one failed the honest fix would be to delete it.
 * The table below is the set a component actually produces, each with the call site that produces
 * it. Adding a colour pairing to a component means adding a row here.
 *
 * ## The two thresholds
 *
 * WCAG AA is 4.5:1 for text and 3:1 for large text, where large means 24px, or 18.66px at weight
 * **700** — not 600. This design uses 600 for emphasis throughout, so almost nothing qualifies for
 * the relaxed threshold and every row below is held to 4.5:1. Non-text contrast (1.4.11) is 3:1 and
 * applies to the glyph inside a swatch; those rows pass 4.5:1 anyway, so the stricter number is
 * asserted rather than arguing about which rule applies.
 */

/** Resolves a token name to its literal value, following one level of `{...}` reference. */
function literal(name: string): string {
  const token = system.tokens.getByName(name);
  expect(token, `token ${name} should exist`).toBeDefined();
  const value = String((token as { value?: unknown } | undefined)?.value ?? "");
  return dereference(value) ?? value;
}

/** `"{colors.ink}"` → the value of `colors.ink`. Anything else → `undefined`. */
function dereference(value: string): string | undefined {
  const [, inner] = /^\{(.+)\}$/.exec(value) ?? [];
  return inner === undefined ? undefined : literal(inner);
}

type Mode = "base" | "_dark";

/**
 * Resolves a *semantic* token in one mode.
 *
 * `getByName("colors.content").value` is already flattened to the light value, which would make a
 * dark-mode assertion silently test the light palette. `extensions.conditions` holds the per-mode
 * references, which is the only honest source.
 */
function hex(name: string, mode: Mode): string {
  const token = system.tokens.getByName(name);
  expect(token, `token ${name} should exist`).toBeDefined();
  const conditions = (token as { extensions?: { conditions?: Record<string, string> } } | undefined)
    ?.extensions?.conditions;
  const reference = conditions?.[mode];
  expect(reference, `${name} should define a ${mode} value`).toBeDefined();
  const value = String(reference);
  return dereference(value) ?? value;
}

/** WCAG 2.x relative luminance. */
function luminance(color: string): number {
  const [red, green, blue] = [1, 3, 5]
    .map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function ratio(foreground: string, background: string): number {
  expect(foreground, "contrast needs an opaque hex").toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(background, "contrast needs an opaque hex").toMatch(/^#[0-9A-Fa-f]{6}$/);
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

type Pair = {
  /** Semantic foreground token. */
  fg: string;
  /** Semantic background token. */
  bg: string;
  /** Where this combination is drawn. Keeps the table auditable. */
  where: string;
};

const PAIRS: Pair[] = [
  { fg: "colors.content", bg: "colors.surface", where: "headings and row titles on a card" },
  { fg: "colors.content", bg: "colors.surface.muted", where: "page-level headings on the paper" },
  { fg: "colors.content", bg: "colors.surface.sunken", where: "text in an inset block" },
  { fg: "colors.content.muted", bg: "colors.surface", where: "field labels, nav links, subtitles" },
  { fg: "colors.content.subtle", bg: "colors.surface", where: "helper text and timestamps" },
  { fg: "colors.content.subtle", bg: "colors.surface.muted", where: "helper text outside a card" },
  {
    fg: "colors.content.subtle",
    bg: "colors.surface.sunken",
    where: "the archived badge, which overrides its own foreground",
  },
  { fg: "colors.content.quiet", bg: "colors.surface", where: "input placeholders" },
  { fg: "colors.content.meta", bg: "colors.surface", where: "reference codes on a card" },
  { fg: "colors.content.meta", bg: "colors.surface.muted", where: "reference codes on the paper" },
  {
    fg: "colors.content.onTint",
    bg: "colors.brand.muted",
    where: "body copy and reference codes inside the accent panel",
  },
  { fg: "colors.brand.fg", bg: "colors.surface", where: "links and card actions" },
  { fg: "colors.brand.fg", bg: "colors.surface.muted", where: "links outside a card" },
  {
    fg: "colors.brand.fg",
    bg: "colors.brand.muted",
    where: "the accent panel's own eyebrow — the pair that failed at #1D7A6C",
  },
  {
    fg: "colors.positive",
    bg: "colors.surface",
    where: "an amount owed to the user, 14px/600 in a row — the pair that failed at #2E8A61",
  },
  { fg: "colors.positive", bg: "colors.surface.muted", where: "a positive figure on the paper" },
  { fg: "colors.negative", bg: "colors.surface", where: "an expense amount, 14px/600 in a row" },
  { fg: "colors.negative", bg: "colors.surface.muted", where: "a negative figure on the paper" },
  {
    fg: "colors.content.inverted",
    bg: "colors.content",
    where: "the label on the `contrast` button",
  },
  {
    fg: "colors.brand.contrast",
    bg: "colors.brand.solid",
    where: "the label on the primary button, and the skip link",
  },
  {
    fg: "colors.content.onSwatch",
    bg: "colors.negative.surface",
    where: "the danger button's label, and a coral alert",
  },
  { fg: "colors.content.onSwatch", bg: "colors.positive.surface", where: "a mint alert or badge" },
  { fg: "colors.content.onSwatch", bg: "colors.warning.surface", where: "the offline banner" },
  { fg: "colors.content.onSwatch", bg: "colors.info.surface", where: "a transfer or card badge" },
  {
    fg: "colors.content.onSwatch",
    bg: "colors.swatch.teal",
    where: "a glyph inside a teal swatch",
  },
  {
    fg: "colors.content.onSwatch",
    bg: "colors.swatch.mint",
    where: "a glyph inside a mint swatch",
  },
  {
    fg: "colors.content.onSwatch",
    bg: "colors.swatch.coral",
    where: "a glyph inside a coral swatch",
  },
  {
    fg: "colors.content.onSwatch",
    bg: "colors.swatch.butter",
    where: "a glyph inside a butter swatch",
  },
  { fg: "colors.content.onSwatch", bg: "colors.swatch.sky", where: "a glyph inside a sky swatch" },
];

describe("WCAG AA contrast", () => {
  for (const mode of ["base", "_dark"] as const) {
    describe(mode === "base" ? "light mode" : "dark mode", () => {
      for (const pair of PAIRS) {
        it(`${pair.fg} on ${pair.bg} — ${pair.where}`, () => {
          const measured = ratio(hex(pair.fg, mode), hex(pair.bg, mode));
          expect(
            measured,
            `${pair.fg} on ${pair.bg} measured ${measured.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }

  /**
   * The one pair that is allowed to fail, recorded so it is a decision rather than an oversight.
   *
   * A disabled control is `content.quiet` on `surface.disabled`, which measures about 4.2:1 light
   * and 4.4:1 dark. WCAG 1.4.3 exempts "text or images of text that are part of an inactive user
   * interface component", and the whole point of the treatment is to look unavailable — raising it
   * to 4.5:1 would make a disabled Save look enabled.
   *
   * It is asserted rather than ignored: it must stay above 3:1, so a future palette cannot quietly
   * turn a disabled label into an invisible one.
   */
  for (const mode of ["base", "_dark"] as const) {
    it(`the disabled control exemption stays legible in ${mode === "base" ? "light" : "dark"} mode`, () => {
      const measured = ratio(
        hex("colors.content.quiet", mode),
        hex("colors.surface.disabled", mode),
      );
      expect(measured).toBeGreaterThanOrEqual(3);
      // And it is genuinely below AA — if a palette change lifts it past 4.5, delete this test and
      // move the pair into the table above.
      expect(measured).toBeLessThan(4.5);
    });
  }

  /**
   * `content.meta` inside the accent panel is the pair `ReferenceCode` exists to avoid.
   *
   * Group 21 measured it at 4.2:1 and made the component switch to `content.onTint` when it sits on
   * a tint. This asserts the reason that switch is needed, so nobody removes it as redundant.
   */
  for (const mode of ["base", "_dark"] as const) {
    it(`content.meta on the accent tint is below AA in ${mode === "base" ? "light" : "dark"} mode, which is why ReferenceCode switches`, () => {
      expect(ratio(hex("colors.content.meta", mode), hex("colors.brand.muted", mode))).toBeLessThan(
        4.5,
      );
    });
  }
});
