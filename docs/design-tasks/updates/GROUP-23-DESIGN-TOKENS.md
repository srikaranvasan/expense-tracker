# Group 23 — Design Tokens

Replaces the palette and the geometry. Section 3 of
[`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md), with the four contrast corrections from
[`GROUP-21-DESIGN-DECISIONS.md`](GROUP-21-DESIGN-DECISIONS.md) section 3.8 applied.

---

## 1. What was built

The app's visual vocabulary changed wholesale. Indigo-on-grey with 14px rounded corners and
soft shadows became cream-and-pastel on ink with **zero radius everywhere** and hard offset
shadows.

Five things landed:

- **A flat, designed palette.** The `brand`/`money`/`caution`/`ink` numbered ramps are gone,
  replaced by named values — `paper`, `ink`, `teal`, `mint`, `coral`, `butter`, `sky` and a
  separately-drawn dark set.
- **Both colour modes on every semantic token.** Forty semantic colours and five shadows,
  each with a `base` and a `_dark` value. Nothing reads the dark half yet; group 24 switches
  it on.
- **Zero radius, enforced twice.** The semantic `radii.l1/l2/l3` override makes every
  built-in Chakra recipe square; a `border-radius: 0 !important` global catches what the
  tokens cannot reach.
- **Borders and shadows as a system.** Six named border weights and five hard offset
  shadows, because in this design borders carry the structure that shadows carry elsewhere.
- **The PWA icons regenerated** from the new brand colour, and the four places that repeat
  colour literals outside CSS brought into step.

A new test file, `src/theme/theme.test.ts` (70 tests), locks the parts of this that break
silently.

---

## 2. Files added or changed

**Theme**

| File | Purpose |
| --- | --- |
| `src/theme/tokens.ts` | palette replaced; `borderWidths`, `radii.none`, `sizes.fab` added; `sizes.content` widened to 85rem. The `fonts`/`fontSizes`/`letterSpacings` from group 22 are untouched |
| `src/theme/semantic.ts` | rewritten. Every colour carries both modes; adds `line.*`, `swatch.*`, `content.quiet/meta/onTint`, `surface.disabled/scrim`, the five `shadows.hard*`, and the `radii.l1/l2/l3` override |
| `src/theme/index.ts` | adds the global `border-radius: 0 !important` reset; corrects the stale "dark mode is not part of the MVP" comment |
| `src/theme/raw-colors.ts` | new values, plus `ink` and `darkSurface`; `surface` now means `paper` rather than white |
| `src/theme/theme.test.ts` | **new.** 70 tests over the rules that fail invisibly |

**Consumers of the literal colours** — the four places CSS cannot reach:

| File | Change |
| --- | --- |
| `src/app/layout.tsx` | `themeColor` now resolves to `#FAF7F2`; comment records that group 24 splits it per mode |
| `src/app/manifest.ts` | no edit needed — reads `RAW_COLORS.surface`, whose value changed |
| `scripts/generate-icons.ts` | mark drawn in **ink**, not surface; squircle radius set to 0; bar ends squared |
| `src/app/global-error.tsx` | its hand-copied literals updated by hand, since it must not import anything |

**Generated artefacts** (committed, via `npm run icons:generate`):
`public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`,
`apple-touch-icon.png`, `icon.svg`, `public/favicon.ico`.

No component file changed. That is the point of the semantic layer: the palette moved and
nothing that consumes it had to.

---

## 3. Key decisions

### 3.1 The old palette was deleted, not kept alongside

`brand.50`-`900`, `ink.50`-`900`, `money.*`, `caution.*` and `radii.card` are removed
outright. Keeping them would have made the restyle incremental and safe-looking, and would
have guaranteed a half-migrated app: both sets resolve, neither errors, and two visual
languages end up on the same screen. `theme.test.ts` asserts each removed name returns
`undefined`.

Nothing broke, because nothing referenced them. Confirmed by grep: no component named a raw
token, a numbered shade, or `radii.card`. The semantic layer had been doing its job.

### 3.2 Flat names instead of numbered ramps

`teal`, `mint`, `coral`, `butter`, `sky` rather than `teal.300`, `mint.200`. A ramp is the
right shape when shades are interpolated; this palette is a designed pairing — five pastel
fills each with the one text colour chosen to sit on it, and a dark set drawn separately
rather than derived. `teal.300` invites someone to reach for `teal.400`, which nobody
approved and which has no counterpart in the dark table.

### 3.3 The three alpha borders are literal `rgba()`, not `{colors.ink/18}`

The design system document suggests Chakra's opacity modifier: `{colors.ink/18}` resolving to
ink at 18%. That is documented behaviour for *style props*; relying on it inside a token
**definition** was not something worth betting three of the most repeated borders in the app
on. A border that silently resolves to fully opaque ink looks like a design decision rather
than a bug, and every card in the app would carry it.

So `inkLine`, `inkLineSoft` and `inkLineField` are raw tokens holding the exact `rgba()`
values from the handoff CSS, with dark counterparts at the same alphas over `darkInk`. Two
extra alpha tokens joined them for the same reason: `inkGrid` (the 5% graph-paper grid) and
`inkScrim` (the 45% quick-add scrim).

The cost is six extra raw tokens. The benefit is that the value in the file is the value that
ships.

### 3.4 The hard shadows are **semantic**, not raw — this one matters

The design system document puts the shadows in `tokens.shadows` with `{colors.ink}` baked in.
That is wrong, and the handoff itself says so:

```text
design/ux/screens/Style-Guide.html          box-shadow: 4px 4px 0 #1E1B29   (ink)
design/ux/screens/Dashboard-Dark.html       box-shadow: 4px 4px 0 #F3F0FA   (darkInk)
design/ux/screens/Mobile-Dashboard-Dark.html box-shadow: 4px 4px 0 #F3F0FA
```

The shadow colour **flips with the mode**. An ink shadow on a `#141220` page is invisible, so
a raw token with a fixed colour would have silently deleted the entire elevation system in
dark mode — every button and card losing its offset, with no error and no failing test.

All five (`hardSm`, `hard`, `hardLg`, `hardXl`, `hardFocus`) are therefore semantic tokens
with both modes. `hardFocus` is teal in light, as drawn in the style guide; its dark value is
**derived** using `darkTeal`, because the handoff draws no focused control on a dark screen.
Flagged for the designer.

### 3.5 `brand.contrast` is ink in **both** modes

The instinct when writing a `_dark` value is to flip the foreground. Here that is wrong and
the failure is severe: both teal fills are bright (`#7FD1C3` light, `#4FB9A8` dark), so
`darkInk` on them measures about 2.1:1 and the button label effectively disappears. Ink
measures 9.5:1 light and 7.1:1 dark.

`DESIGN.md` states this rule for icons inside swatches. It applies identically to the primary
button, which is the same fill. `theme.test.ts` asserts `base` and `_dark` are both
`{colors.ink}` — the one assertion in that file most likely to stop a plausible-looking
mistake.

Same reasoning made `warning` and `info` use `content` as their foreground rather than a
tinted text colour: neither butter nor sky has a text colour in either handoff table, because
ink sits on them (13.4:1 and 11.8:1 light).

### 3.6 `brand.focusRing` is ink, not teal

Focus in this design is a **teal offset shadow plus a border promotion to full ink** (section
5.3), not a ring. `focusRing` is what Chakra's own recipes reach for when they draw a ring,
and ink is the value that reads as "focused" in this language. The teal offset lives in
`shadows.hardFocus`. Group 26 builds the combined treatment.

### 3.7 `RAW_COLORS.surface` now means *paper*, not white

It was `#ffffff`; it is now `#FAF7F2`. That name is doing double duty and it is worth being
explicit about why the value moved rather than the name.

These four literals feed the `theme-color` meta tag and the manifest's `background_color` —
the colour the OS paints for the fraction of a second before the app renders. White against a
`#FAF7F2` page is a visible flash on every launch. Small, but avoiding exactly that mismatch
is the entire reason this file exists (group 20 review).

Verified: the prerendered `/offline` document now carries
`<meta name="theme-color" content="#FAF7F2"/>`.

### 3.8 The generated icon: ink mark, square corners, square bars

Three changes, each forced by the new language:

- **The mark is ink, not surface.** It was white on saturated indigo. White on pastel teal
  measures 1.4:1 — the mark would have disappeared. Ink on teal is 9.5:1, and it is the same
  fixed-ink rule the app follows for anything drawn inside a coloured fill (6.1).
- **`SQUIRCLE_RADIUS_RATIO` is 0.** Kept as a named constant rather than deleted, because the
  three variants still differ for reasons that need saying: iOS rounds `apple-touch-icon`
  itself, Android masks `purpose: "maskable"` and can crop 20% per edge, and desktop
  installers render the icon as-is. Only the last ever showed this radius.
- **The bars are square-ended.** They were drawn with `rx: barHeight / 2`, i.e. pills — the
  one shape this design has none of.

Regenerated and inspected: teal field, three descending ink bars, square throughout.

### 3.9 `global-error.tsx` is updated by hand and stays light-only

It deliberately imports nothing, not even `raw-colors.ts`, because it renders when the root
layout failed. So it is the one file a palette change has to be applied to manually, and it is
now named as a consumer in both `raw-colors.ts` and this document.

It is **not** themed for dark mode. A page that renders when the provider failed cannot ask
the provider what mode it is in, and duplicating the whole style block behind
`prefers-color-scheme` in inline styles is not worth it for a page that should be unreachable.

### 3.10 `sizes.content` widened from 64rem to 85rem

1360px is the content column the handoff was composed in (1440px with 40px gutters). At 64rem
the four-up summary-tile and quick-action grids would reflow and stop matching the drawings.
This is a visible change to every desktop screen and will show up in the group 41 screenshot
diff as intended rather than as a regression.

### 3.11 Why the theme has tests now

A theme is usually left untested on the grounds that it is data. This one carries four rules
that are expensive to break and produce no error when broken:

| Rule | What breaking it looks like |
| --- | --- |
| both modes on every colour | a screen loses its colour in dark mode; nothing fails |
| every radius is zero | one rounded corner among hundreds of square ones |
| ink stays on teal in dark mode | an invisible button label |
| the three darkened text colours | reverted by anyone copying values out of the handoff |

None produce a type error, a lint warning, or a failing render. They produce a screen that
looks slightly wrong to someone who never saw the design. 70 assertions is cheap insurance
against that, and they run in the `unit` project in under two seconds.

---

## 4. Business rules enforced

- **No information is carried by colour alone.** The palette makes this *possible* to break
  more easily than before, because it now has five semantically-named fills. The semantic
  layer is documented accordingly, and `positive`/`negative` continue to pair a fill with a
  text colour rather than existing as fills alone. Groups 29 and 40 enforce it at the
  component level; this group's contribution is that `swatch.*` is deliberately separate from
  `positive`/`negative`, so a decorative category colour cannot be mistaken for a direction
  signal.
- **Accessible contrast is a property of the tokens, not of each screen.** The three
  darkened light values and one lightened dark value are baked in, with tests. A screen
  cannot opt out by using a token.
- **The installed app must not misrepresent itself.** `theme-color`, the manifest background
  and the icon all derive from one file, so the splash screen cannot drift from what the app
  paints (docs/16 PWA work).

No financial calculation is touched.

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run verify` (typecheck, lint, 506 unit tests) | passes |
| `npx vitest run --project ui` (16) | passes |
| `npx vitest run --project unit src/theme/theme.test.ts` (70) | passes |
| `npm run build` | compiles clean, **no unresolved-token warnings** |
| `npm run icons:generate` | regenerated seven artefacts |
| `npx playwright test -g "installable manifest"` | passes — every regenerated icon resolves and the manifest is still installable |
| token resolution probe (throwaway script, `system.tokens.getByName`) | see below |
| grep for raw-token references in `src/**` | none: no numbered shade, no `radii.card`, no `RAW_COLORS` outside the four consumers |
| `.next/server/app/offline.html` | `<meta name="theme-color" content="#FAF7F2"/>` |
| visual check of `public/icons/icon-512.png` and `icon.svg` | teal field, three descending ink bars, square corners and square bar ends |

The token probe confirmed the things a build cannot:

```text
colors.content.subtle  -> base {colors.inkTertiary}  _dark {colors.darkInkTertiary}
colors.brand.contrast  -> base {colors.ink}          _dark {colors.ink}
shadows.hard           -> base 4px 4px 0 {colors.ink}  _dark 4px 4px 0 {colors.darkInk}
radii.l1 / l2 / l3     -> "0"
sizes.content          -> 85rem
colors.brand.500, colors.ink.50, colors.money.in, radii.card  -> undefined
```

These are now the assertions in `theme.test.ts` rather than a one-off observation.

**Not verified.** Nothing has been *seen* in dark mode: there is no provider yet, so the
`_dark` half is written and resolved but never activated. Group 24 is the first chance to look
at it, and it should be treated as unreviewed until then. No screen has been compared against
`design/ux/screens/` either — with the primitives still unrestyled that comparison would only
say "the colours changed", which is not the same as "the design was applied". Groups 26 to 39
each do that for the screens they touch.

---

## 6. Known gaps

- **The dark half is unseen** (5). Forty tokens and five shadows exist in a mode nobody has
  rendered. Group 24.
- **Four derived dark values have no designed basis**, carried over from group 21 section 3.7
  and now committed: `darkDisabledSurface` `#2A2739`, `darkInkGrid`,
  `content.onTint`'s dark value, and `shadows.hardFocus`'s dark value. Each is commented at
  its definition. They need designer review.
- **`radii.none` has no call site yet.** It exists so a future decision to soften exactly one
  thing has one place to happen; until a component names it, it is unexercised.
- **`sizes.fab`, `surface.scrim`, `line.grid` and `borderWidths.tick` are unused** until
  groups 28 and 31. A token with no call site is a token nobody has checked at its real size.
- **`swatch.*` has no resolver yet.** Group 25 builds the category and account mappings that
  make the five names useful; right now they are five colours with no rule for choosing
  between them.
- **The `!important` global reset is blunt.** It cannot be overridden locally. If one element
  ever genuinely needs a radius, the fix is to narrow that selector, not to fight it — the
  comment at the definition says so.
- **`global-error.tsx` is light-only and hand-maintained** (3.9). A future palette change
  must edit it manually; nothing enforces that. The best available guard is that
  `raw-colors.ts` names it as a consumer.
- **The 85rem content width has not been looked at on a real desktop screen** (3.10). It is
  correct against the handoff's geometry; whether every existing page's internals cope with
  the extra 336px is a group 34-39 question.

---

## 7. Notes for the next group

**Group 24** is the first group that can see half of this work. Specifics it needs:

- The dark condition Chakra expects is `.dark &, .dark .chakra-theme:not(.light) &`. The
  tokens are written against `_dark`; verify the class actually activates them rather than
  assuming.
- `theme-color` is currently a single value in `src/app/layout.tsx` with a comment pointing at
  group 24. It needs splitting into a `media`-qualified pair — `#FAF7F2` for light,
  `#141220` (`RAW_COLORS.darkSurface`) for dark.
- The flash-of-wrong-theme problem is real: the class has to be on `<html>` before first
  paint, which means a blocking inline script, not an effect.
- Once a provider exists, **look at the dark screens**. Four derived values (6) are guesses
  that have never been rendered.

**Every group after that**, three rules:

- **Name a semantic token, never a raw one.** `content.subtle`, not `inkTertiary`. The one
  exception is `RAW_COLORS`, and only for the manifest, the `theme-color` tag and the icon
  script.
- **Never hard-code a shadow or a border colour.** Use `shadows.hard` / `shadows.hardLg` and
  `line` / `line.card` / `line.soft` / `line.field`. A literal `4px 4px 0 #1E1B29` will look
  right and vanish in dark mode (3.4).
- **Do not add a radius.** Two mechanisms will fight you, and that is deliberate.

One trap worth knowing: `colors.ink` is `#1E1B29` and `colors.darkSurface` is `#1E1B2C`. They
differ by one digit, mean unrelated things, and are both quoted verbatim from `DESIGN.md`'s two
colour tables. `theme.test.ts` asserts they are not equal, which is the sort of test that looks
silly until it catches a paste.
