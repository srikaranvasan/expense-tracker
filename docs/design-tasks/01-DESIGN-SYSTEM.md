# Design System — "Ledger Geometry"

The rules. Turns the UX handoff in `design/ux/` into something a developer can build from
without guessing: the exact tokens, the exact icon set, and the component contracts.

The work itself — what to build, in what order — is in
[`02-DESIGN-TASK-GROUPS.md`](02-DESIGN-TASK-GROUPS.md). This document is what that one points
back at.

The app today is a working, tested, plain Chakra UI. The handoff is a complete visual language
that touches every screen. This is the bridge between them.

---

## Contents

```text
 0  How to use these two documents
 1  Sources of truth
 2  Decisions needed before coding
 3  Design tokens                    copy-ready Chakra definitions
 4  Typography and font loading
 5  Geometry and elevation
 6  The icon system
 7  Component contracts
 8  Layout and responsive rules
 9  Rules that must survive the restyle
10  Screen coverage matrix
```

---

# 0. How to use these two documents

| Document | Holds | Read it |
| --- | --- | --- |
| `01-DESIGN-SYSTEM.md` (this file) | tokens, typography, geometry, icons, component contracts, the rules | once before starting, then whenever a group references a section |
| `02-DESIGN-TASK-GROUPS.md` | groups 21-41, the checkboxes, build order, definition of done | as you work |

Read sections 1 to 9 once before starting, then work the groups, returning here rather than
reading values off the HTML by eye. The handoff HTML is a first draft with inline styles and a
handful of undocumented colours, and copying from it screen by screen is how a design system
turns back into a pile of magic numbers.

Nothing here is an invention. Where a value is missing from the handoff it is called out as a
gap in section 2 rather than filled in silently.

Bracketed numbers in the task groups — `(6.4)`, `(9.3)` — are section numbers in this file.

---

# 1. Sources of truth

| What | Where | Authority |
| --- | --- | --- |
| Design intent, tokens, product rules | `design/ux/DESIGN.md` | The designer's own words. Wins on intent. |
| Rendered screens | `design/ux/screens/*.html` | Open `design/ux/index.html` to browse. Wins on layout and exact geometry. |
| Style guide | `design/ux/screens/Style-Guide.html` | Wins on component states: button variants, input focus, badges, motifs. |
| Current UI, before the restyle | `design/screenshots/` | What is being replaced. Useful for finding every place a component is used. |
| Behaviour, validation, business rules | `docs/01` through `docs/12` | Unchanged. The restyle changes no behaviour. |
| Route and state inventory | `design/screenshots/README.md` | The 52-screen list the restyle has to cover. |

When the HTML and `DESIGN.md` disagree, `DESIGN.md` wins and the difference is a bug in the
draft — record it in the group's update document.

---

# 2. Decisions needed before coding

Seven things the handoff assumes but the application does not have. Four are blocking. Group
21 exists to close all of them.

## 2.1 Ledger reference codes — **blocking**

The designs show a permanent reference on transactions and settlements:

```text
Dashboard recent activity   #08231
Add expense (draft)         Record · TXN-08232      "TXN-08232 · draft"
Settle up                   Settlement · STL-0412
```

`DESIGN.md` calls this "a permanent reference, like a ledger line". **No such field exists.**
Transactions are identified by a MongoDB `ObjectId`, which is 24 hex characters and not
something a person reads out.

This is a data-model change, not a styling change. Options:

| Option | Cost | Consequence |
| --- | --- | --- |
| **A.** Add a per-user monotonic sequence (`reference: number`) assigned inside the existing `withTransaction()` write | A counter document per user, one extra read/write per create; must be allocated inside the transaction to avoid gaps or duplicates | Codes look exactly like the design. Offline-created records cannot have one until they sync, so the UI needs a "draft / pending" state — which the design already shows on the Add expense screen. |
| **B.** Derive a short code from the existing `ObjectId` (e.g. last 5 hex characters, uppercased) | None. Pure presentation. | Codes are stable, unique per record, and available offline immediately — but they are hex, not sequential, so `#A3F09` rather than `#08231`, and they carry no ordering. |
| **C.** Drop the reference from the UI | None | Loses one of the strongest parts of the ledger framing. The eyebrow labels, the "AS OF" stamp and the audit motifs carry it alone. |

**Recommendation: B for now, with the display component isolated so A can replace it later.**
Sequential numbering that must not skip is a genuine distributed-systems problem, and it is
not worth blocking a restyle on. Option B gets the visual language shipped; group 32 builds
the one component that has to change if A is chosen later.

This needs a product decision. Do not guess.

## 2.2 Dark theme — **blocking scope question**

The handoff has a full dark palette and two dark screens. The app has none:
`src/theme/index.ts` says outright that "dark mode is intentionally not part of the MVP, so no
colour-mode provider is wired up and the `_dark` condition never activates".

Adding it means a colour-mode provider, a persisted preference, a `theme-color` meta tag per
mode, and a place to toggle it — and there is **no settings screen** to put the toggle in
(`src/app/(app)/settings/` is an empty folder). Also note the flash-of-wrong-theme problem:
the class has to be on `<html>` before first paint.

Decide: ship light-only first with the tokens written so dark is a later switch, or ship both.
Either way, group 23 writes both modes into the semantic tokens from the start and group 24
wires up the provider — because retrofitting `_dark` values across forty semantic tokens later
is worse than writing them now even if nothing reads them yet.

## 2.3 Category icons and swatch colours — **blocking for the categories and dashboard work**

The design gives every category a bordered swatch with an icon and a colour. The data model
supports neither properly:

- `Category.icon` exists and the nine seeded defaults carry lucide-style names
  (`utensils`, `car`, `shopping-bag`, `receipt`, `film`, `heart-pulse`, `plane`, `house`,
  `ellipsis`), but **nothing renders it** and `CategoryForm` has no icon field — so every
  user-created category has `icon: null`.
- There is **no colour field at all**. The designs colour Shopping sky, Electricity butter,
  Entertainment teal, Groceries mint, with no stated rule.

Required: a deterministic fallback so a category with `icon: null` still renders (see 6.4),
plus a decision on whether to add an icon picker to `CategoryForm` and a `color` field to the
model. The fallback is mandatory either way — existing users already have null-icon
categories.

## 2.4 The press-and-hold FAB gesture — **blocking for group 31**

`DESIGN.md` flags this itself: press-and-hold on the quick-add button is meant to jump
straight to Add expense, and "there's currently no visible hint that this gesture exists,
which is worth a product decision before shipping it."

A hidden gesture with no affordance and no keyboard equivalent is not shippable as the only
route to anything. Since tapping already opens the menu whose first item is Add expense, the
recommendation is **build the tap menu, skip the hold gesture**. Revisit with a visible hint
if it is wanted.

## 2.5 Undocumented colours in the draft — non-blocking

Six values appear in the HTML but not in the `DESIGN.md` tables. They are included in section
3 with names, so they stop being magic numbers, but the dark-theme counterparts for four of
them do not exist and have been derived:

| Light | Used for | Dark counterpart |
| --- | --- | --- |
| `#A6A2BC` | input placeholder, disabled text | not designed — derived |
| `#EDEAE3` | disabled button fill | not designed — derived |
| `#B4B0C4` | reference-code meta text | `#6C6884` (found in `Dashboard-Dark.html`) |
| `#4A465B` | body copy inside the accent-tint panel | not designed — derived |
| `rgba(30,27,41,0.05)` | 24px graph-paper grid on the sign-in and style-guide backgrounds | not designed — derived |
| `#1E1B2C` | dark surface — note this is **not** `#1E1B29`, the light ink, though they differ by one digit | n/a |

Get these confirmed. They are small, but "disabled" and "placeholder" appear on every form.

## 2.6 Missing icons — non-blocking

The handoff draws 28 icons (section 6.2). The app needs at least nine more it does not
provide: search, filter, archive, restore, edit, delete, offline, install, and a chevron for
collapsible panels. Draw them in-house to the rules in 6.1 and get them reviewed.

## 2.7 Terminology drift — non-blocking

The designs label the same action three ways: "Split a bill" (dashboard quick action), "Split
instead" (add-expense header), "Split" (activity header). `docs/04-USER-FLOWS.md` section 28
requires consistent terminology. Pick one per context and record it; the current app uses
"Split" and "Split instead".

---

# 3. Design tokens

Four files. Raw tokens name values, semantic tokens name meanings, and **only semantic tokens
are used in components** — the existing rule in `docs/05-FOLDER-STRUCTURE.md` section 5, which
this restyle keeps.

## 3.1 `src/theme/tokens.ts` — raw values

Replace the current palette wholesale. The existing `brand`/`money`/`caution`/`ink` scales are
a different visual language and keeping them alongside guarantees a half-migrated app.

```ts
import { defineTokens } from "@chakra-ui/react";

export const tokens = defineTokens({
  colors: {
    // --- Light ---------------------------------------------------------------
    paper: { value: "#FAF7F2" },       // page background
    surface: { value: "#FFFFFF" },     // cards, inputs, headers
    ink: { value: "#1E1B29" },         // every border, heading, primary text
    inkSecondary: { value: "#5B5770" }, // nav links, labels, subtitles
    inkTertiary: { value: "#8B87A0" },  // timestamps, helper text
    inkQuiet: { value: "#A6A2BC" },     // placeholder, disabled text   (2.5)
    inkMeta: { value: "#B4B0C4" },      // reference codes              (2.5)
    inkOnTint: { value: "#4A465B" },    // body copy on accent tint     (2.5)
    disabledSurface: { value: "#EDEAE3" }, //                           (2.5)

    teal: { value: "#7FD1C3" },        // primary fill
    tealText: { value: "#1D7A6C" },    // links, eyebrows, active nav text
    tealTint: { value: "#DCF3EE" },    // net-position banner, reference boxes
    mint: { value: "#BFEBD2" },        // positive fill
    mintText: { value: "#2E8A61" },    // positive text
    coral: { value: "#FFC7B8" },       // negative fill
    coralText: { value: "#D1523F" },   // negative text, required-field marks
    butter: { value: "#FCE49B" },      // pending / caution fill
    sky: { value: "#C0DBF7" },         // category and type-badge fill

    // --- Dark ----------------------------------------------------------------
    // Separate names rather than a 50-900 scale: these are a designed pairing, not
    // a ramp, and pretending otherwise invites interpolation that was never approved.
    darkPaper: { value: "#141220" },
    darkSurface: { value: "#1E1B2C" },   // NOT #1E1B29 — see 2.5
    darkInk: { value: "#F3F0FA" },
    darkInkSecondary: { value: "#B7B2CC" },
    darkInkTertiary: { value: "#9B96B3" },
    darkInkMeta: { value: "#6C6884" },
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

  fonts: {
    // Wired to next/font in section 4. The CSS variables are the contract.
    heading: { value: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif" },
    body: { value: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif" },
    mono: { value: "var(--font-ibm-plex-mono), ui-monospace, SFMono-Regular, monospace" },
  },

  letterSpacings: {
    // The eyebrow labels are the single most repeated typographic device in the
    // design. Tokenised so ".08em" stops being retyped on every screen.
    eyebrow: { value: "0.08em" },
    eyebrowWide: { value: "0.1em" },
    badge: { value: "0.06em" },
    stamp: { value: "0.1em" },
  },

  borderWidths: {
    hairline: { value: "1px" },    // row dividers (use with the `line` colour)
    thin: { value: "1.5px" },      // inputs, card borders, small swatches
    thick: { value: "2px" },       // buttons, emphasised cards, header rules
    tick: { value: "2.5px" },      // registration-tick corner brackets
    accent: { value: "3px" },      // active-nav underline
    tile: { value: "4px" },        // summary-tile top edge
  },

  radii: {
    // Zero everywhere. Kept as named tokens rather than literal "0" so a future
    // decision to soften one thing has exactly one place to happen.
    none: { value: "0" },
  },

  shadows: {
    // Hard offset, no blur. N scales with importance.
    hardSm: { value: "3px 3px 0 {colors.ink}" },   // quick-add pills
    hard: { value: "4px 4px 0 {colors.ink}" },     // buttons, FAB
    hardLg: { value: "6px 6px 0 {colors.ink}" },   // form cards
    hardXl: { value: "8px 8px 0 {colors.ink}" },   // the sign-in card
    // Focus is a teal offset shadow, not a ring — see 5.3.
    hardFocus: { value: "4px 4px 0 {colors.teal}" },
  },

  sizes: {
    touch: { value: "2.75rem" },
    // Was 64rem. The designs are drawn at 1440px with 40px gutters, so the
    // content column is 1360px. 64rem would reflow every desktop screen.
    content: { value: "85rem" },
    fab: { value: "3.25rem" },     // 52px
  },
});

export { RAW_COLORS } from "./raw-colors";
```

## 3.2 `src/theme/raw-colors.ts` — for the places CSS cannot reach

The manifest, the `theme-color` meta tag and `scripts/generate-icons.ts` need literal strings
and must stay dependency-free. Update the values and add the dark pair:

```ts
export const RAW_COLORS = {
  /** `colors.teal` in tokens.ts — the brand fill. */
  brand: "#7FD1C3",
  /** `colors.surface` in tokens.ts — what the app paints over in light mode. */
  surface: "#FFFFFF",
  /** `colors.ink` in tokens.ts — borders and the icon stroke. */
  ink: "#1E1B29",
  /** `colors.darkPaper` — only needed if 2.2 says ship dark mode. */
  darkSurface: "#141220",
} as const;
```

Consumers to update in the same commit: `src/app/layout.tsx`, `src/app/manifest.ts`,
`scripts/generate-icons.ts`. The generated icons must be regenerated
(`npm run icons:generate`) — the current ones are indigo, and an installed app that flashes
an indigo splash before painting a cream page is exactly the mismatch `raw-colors.ts` exists
to prevent.

## 3.3 `src/theme/semantic.ts` — meanings

Every value carries both modes from the start (see 2.2). Components reference these names
only.

```ts
import { defineSemanticTokens } from "@chakra-ui/react";

export const semanticTokens = defineSemanticTokens({
  colors: {
    surface: {
      DEFAULT: { value: { base: "{colors.surface}", _dark: "{colors.darkSurface}" } },
      // The page background. Named "muted" for continuity with the current code.
      muted: { value: { base: "{colors.paper}", _dark: "{colors.darkPaper}" } },
      sunken: { value: { base: "{colors.paper}", _dark: "{colors.darkPaper}" } },
      disabled: { value: { base: "{colors.disabledSurface}", _dark: "{colors.darkInkMeta}" } },
    },

    content: {
      DEFAULT: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
      muted: { value: { base: "{colors.inkSecondary}", _dark: "{colors.darkInkSecondary}" } },
      subtle: { value: { base: "{colors.inkTertiary}", _dark: "{colors.darkInkTertiary}" } },
      quiet: { value: { base: "{colors.inkQuiet}", _dark: "{colors.darkInkMeta}" } },
      meta: { value: { base: "{colors.inkMeta}", _dark: "{colors.darkInkMeta}" } },
      onTint: { value: { base: "{colors.inkOnTint}", _dark: "{colors.darkInkSecondary}" } },
      inverted: { value: { base: "{colors.paper}", _dark: "{colors.darkPaper}" } },
    },

    /**
     * Borders. `line` is the full-strength ink outline that defines almost every
     * box in this design; `line.soft` is the row divider inside a card.
     *
     * Chakra resolves `{colors.ink/18}` to the token at 18% alpha, which is how the
     * draft's rgba(30,27,41,0.18) is expressed without a second hex value.
     */
    line: {
      DEFAULT: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
      card: { value: { base: "{colors.ink/18}", _dark: "{colors.darkInk/18}" } },
      soft: { value: { base: "{colors.ink/10}", _dark: "{colors.darkInk/10}" } },
      field: { value: { base: "{colors.ink/28}", _dark: "{colors.darkInk/28}" } },
    },

    positive: {
      DEFAULT: { value: { base: "{colors.mintText}", _dark: "{colors.darkMintText}" } },
      surface: { value: { base: "{colors.mint}", _dark: "{colors.darkMint}" } },
    },
    negative: {
      DEFAULT: { value: { base: "{colors.coralText}", _dark: "{colors.darkCoralText}" } },
      surface: { value: { base: "{colors.coral}", _dark: "{colors.darkCoral}" } },
    },
    warning: {
      DEFAULT: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
      surface: { value: { base: "{colors.butter}", _dark: "{colors.darkButter}" } },
    },
    info: {
      DEFAULT: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
      surface: { value: { base: "{colors.sky}", _dark: "{colors.darkSky}" } },
    },

    brand: {
      solid: { value: { base: "{colors.teal}", _dark: "{colors.darkTeal}" } },
      // Ink on teal in both modes — the fill is bright enough. See 6.1.
      contrast: { value: { base: "{colors.ink}", _dark: "{colors.ink}" } },
      fg: { value: { base: "{colors.tealText}", _dark: "{colors.darkTealText}" } },
      muted: { value: { base: "{colors.tealTint}", _dark: "{colors.darkTealTint}" } },
      subtle: { value: { base: "{colors.tealTint}", _dark: "{colors.darkTealTint}" } },
      emphasized: { value: { base: "{colors.teal}", _dark: "{colors.darkTeal}" } },
      focusRing: { value: { base: "{colors.ink}", _dark: "{colors.darkInk}" } },
    },

    /**
     * The five swatch fills, addressable by name so the category and account
     * mappings in 6.4 can be a lookup table rather than a switch on hex values.
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
   * Kills rounded corners across every built-in Chakra recipe in one place.
   *
   * Chakra v3's recipes do not reference `radii.md` directly — they reference the
   * semantic radii `l1`, `l2`, `l3`, which the base preset points at
   * `radii.xs`/`sm`/`md` (verified in
   * node_modules/@chakra-ui/react/dist/esm/theme/semantic-tokens/radii.js).
   * Overriding those three is what makes Button, Input, NativeSelect, Alert, Badge
   * and everything else square without touching a single component.
   */
  radii: {
    l1: { value: "0" },
    l2: { value: "0" },
    l3: { value: "0" },
  },
});
```

## 3.4 `src/theme/index.ts` — system config

```ts
const config = defineConfig({
  globalCss: {
    html: {
      textSizeAdjust: "100%",
      WebkitTapHighlightColor: "transparent",
    },
    body: {
      bg: "surface.muted",
      color: "content",
      fontFamily: "body",
      minHeight: "100dvh",
      paddingBottom: "env(safe-area-inset-bottom)",
    },
    // Nothing in this design is round. Belt and braces alongside the radii
    // override, because a third-party or default style can still emit a radius.
    "*, *::before, *::after": {
      borderRadius: "0 !important",
    },
  },

  theme: {
    tokens,
    semanticTokens,

    textStyles: {
      /** Monetary amounts, dates and reference codes. */
      amount: {
        value: {
          fontFamily: "mono",
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum"',
        },
      },
      /** The small-caps mono label above almost every block in this design. */
      eyebrow: {
        value: {
          fontFamily: "mono",
          fontSize: "xs",
          fontWeight: "600",
          letterSpacing: "eyebrow",
          textTransform: "uppercase",
          color: "content.muted",
        },
      },
      /** Uppercase mono inside a bordered status chip. */
      badge: {
        value: {
          fontFamily: "mono",
          fontSize: "2xs",
          letterSpacing: "badge",
          textTransform: "uppercase",
        },
      },
    },
  },
});
```

> The `borderRadius: 0 !important` global is deliberate and should be kept even after the
> `l1/l2/l3` override lands. The two mechanisms fail differently: the token override misses
> anything that hard-codes a radius, and the global misses nothing but is blunt. Together they
> make "no rounded corners" a property of the app rather than a thing to remember.

---

# 4. Typography and font loading

Three faces, one job each. Getting the job assignment wrong is the fastest way to lose the
design's character, so it is a rule, not a preference.

| Face | Token | Weights | Used for | Never used for |
| --- | --- | --- | --- | --- |
| Space Grotesk | `heading` | 500, 600, 700 | page titles, card titles, nav labels, button labels, tab-bar labels, avatar initials | body copy, numbers |
| Manrope | `body` | 400, 500, 600, 700 | descriptions, helper text, notes, option text, list item names | numbers, eyebrow labels |
| IBM Plex Mono | `mono` | 500, 600 | **every** amount, date, reference code, eyebrow label, badge label, stamp | headings, prose |

The rule that catches most mistakes: **if it is a number, it is mono.** Amounts, dates,
percentages, counts in a badge, reference codes. `textStyle="amount"` carries the tabular
figures with it.

## 4.1 Loading

Use `next/font/google`, not the stylesheet link the draft HTML uses. The draft loads from
`fonts.googleapis.com` at runtime, which costs a render-blocking round trip, leaks the visitor
to a third party, and gives a flash of fallback text on every cold load.

```ts
// src/app/fonts.ts
import { Space_Grotesk, Manrope, IBM_Plex_Mono } from "next/font/google";

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
```

Apply all three variables to `<html>` in `src/app/layout.tsx`. The token values in 3.1
reference the CSS variables, so nothing else needs to know.

Check the offline story: the service worker precache list must include the self-hosted font
files, or the first offline load falls back to system fonts and the app looks broken exactly
when the user is least able to explain why.

## 4.2 Type scale as drawn

Taken from the HTML so screens do not each pick their own size.

| Role | Desktop | Mobile | Face / weight |
| --- | --- | --- | --- |
| Page title | 30–32px | 26px | Space Grotesk 700 |
| Page description | 15px | 13.5px | Manrope 400 |
| Card title | 17px | 15px | Space Grotesk 700 |
| Card subtitle | 13px | 11.5px | Manrope 400 |
| Section title in a card | 15.5px | 15px | Space Grotesk 700 |
| Summary-tile figure | 24px | 19px | Mono 600 |
| Hero figure (net position) | 28px | 23px | Mono 600 |
| Amount input | 19px | 19px | Mono 400 |
| Row primary text | 14.5px | 13.5px | Manrope 600 |
| Row meta text | 12–12.5px | 11.5px | Manrope 400 |
| Row amount | 14.5–15px | 13.5px | Mono 600 |
| Eyebrow label | 10.5–11px | 10px | Mono 500/600, uppercase |
| Badge | 10px | 10px | Mono 500, uppercase |
| Reference code | 10.5–11px | 10.5px | Mono 500 |
| Button label | 14–15px | 14px | Space Grotesk 600 |
| Tab-bar label | — | 10px | Space Grotesk 600/700 |

Map these onto Chakra's `fontSizes` scale rather than writing pixel values in components. Half
pixels in the draft (14.5px, 12.5px) are artefacts of hand-drawing; round to the nearest step
and keep it consistent.

---

# 5. Geometry and elevation

## 5.1 Zero radius, no exceptions

Buttons, cards, inputs, avatars, swatches, badges, the FAB, the scrim. Nothing is rounded and
nothing is a pill. Two enforcement mechanisms are in 3.3 and 3.4.

## 5.2 Border weights

Borders carry the structure in this design the way shadows do in most others, so the weight is
meaningful:

| Weight | Token | Where |
| --- | --- | --- |
| 1px, `line.soft` | `hairline` | dividers between rows inside a card |
| 1.5px, `line.card` | `thin` | card outline, summary tiles, small swatches, avatars |
| 1.5px, `line.field` | `thin` | input and select-display resting border |
| 2px, `line` | `thick` | buttons, emphasised form cards, header bottom rule, bottom-nav top rule, focused input |
| 2.5px, `line` | `tick` | registration-tick corner brackets |
| 3px, `brand.solid` | `accent` | active nav underline |
| 4px | `tile` | the coloured top edge of a summary tile |

A card is `1.5px` at `line.card` alpha when it is a container, and `2px` at full `line` with a
hard shadow when it is the subject of the page (the Add expense and Settle up form cards, the
sign-in card).

## 5.3 Shadows and focus

Every shadow is a hard offset with no blur, in ink. No soft shadows anywhere.

```text
hardSm  3px   quick-add action pills
hard    4px   buttons, the FAB
hardLg  6px   form cards that are the subject of the page
hardXl  8px   the sign-in card
```

**Focus is a teal offset shadow plus a border promotion,** which is the one state the style
guide shows explicitly:

```text
resting:  border 1.5px line.field   shadow none
focused:  border 2px   line         shadow 4px 4px 0 brand.solid
```

Note the padding compensation in the draft — 13px resting, 11.5px focused — so the content
does not shift by half a pixel when the border thickens. Use `outline`/`box-shadow` rather
than changing border width, or set the border to 2px transparent at rest. Do **not** remove
the focus indicator: the current app relies on Chakra's default focus ring and this replaces
it, so every interactive element needs checking (group 40).

## 5.4 Audit motifs

Four recurring devices. They are the design's personality; they are also easy to overuse.

| Motif | Geometry | Use on |
| --- | --- | --- |
| Diamond logo mark | 16px square, `teal` fill, 2px ink border, `rotate(45deg)` | header, sign-in, and the filter-active marker at 8px |
| Registration ticks | four 14px L-brackets inset 14px, 2.5px ink | the sign-in card only |
| Offset hard shadow | 5.3 | buttons, subject cards |
| Rotated dashed stamp | 2px dashed, mono 600, `letterSpacing: stamp`, `rotate(-6deg)` to `rotate(-8deg)` | status confirmations only — `BALANCED` on the settle-up allocation total, `AUDITED · OK` |

Stamps are for **derived confirmations**, not for validation errors. A rotated dashed stamp
saying something is wrong reads as decoration; errors use `Alert` (7.6). And rotated text is
harder to read, so a stamp must never be the only carrier of the message — the settle-up
screen shows `BALANCED` next to the allocated figure that already proves it.

## 5.5 The graph-paper background

Sign-in and the style guide sit on a 24px grid:

```css
background-image:
  linear-gradient(rgba(30,27,41,0.05) 1px, transparent 1px),
  linear-gradient(90deg, rgba(30,27,41,0.05) 1px, transparent 1px);
background-size: 24px 24px;
```

Only on the unauthenticated layout. The app shell is plain `surface.muted`. Confirm the dark
value (2.5).

---

# 6. The icon system

## 6.1 Rules

- **Inline stroke SVGs.** Never emoji, never an icon font, never a raster.
- `viewBox="0 0 16 16"`, rendered at 14–18px depending on context.
- Stroke weight 1.2–1.8px. Keep the weight from the table in 6.2 — it was tuned per glyph.
- `fill="none"` and `stroke="currentColor"` by default, so an icon inherits its
  surroundings. The two filled dots on `cart` and `car` are the only exceptions.
- **Icons inside a coloured swatch or avatar are always ink `#1E1B29`, in both themes.**
  `DESIGN.md` is explicit: every swatch fill (teal, mint, coral, butter, sky) is bright enough
  that dark ink stays readable, and flipping to light ink in dark mode would make them
  vanish. Implement this as a fixed value, not `currentColor`.
- Geometric only: squares, rectangles, straight lines, simple polylines. No curves beyond what
  the existing glyphs use. If a new icon needs a curve to read, it is probably the wrong
  metaphor for this set.
- Decorative icons get `aria-hidden="true"`. An icon that is the only label needs an
  accessible name on its control — the icon-only sign-out button in the header is the case
  that exists today, and the draft already gives it both `title` and `aria-label`.

## 6.2 The registry

Twenty-eight glyphs, transcribed from the handoff. Build them as one module —
`src/components/icons/registry.ts` mapping name to `{ stroke, children }` — plus a single
`<Icon name size />` component. One registry means an audit of "what icons do we have" is a
file, not a search.

**Navigation and chrome**

| Name | Stroke | Path data |
| --- | --- | --- |
| `home` | 1.6 | `M2 7L8 2L14 7` + `M4 6.5V13.5H12V6.5` |
| `activity` | 1.5 | `M1 8H4L6 3L10 13L12 8H15` |
| `accounts` | 1.5 / 1.3 | `rect 1.5,4.5 13×9` + `rect 9.3,7.5 3.7×3` |
| `people` | 1.4 | `rect 1,5 6.5×6.5 rotate(45 4.25 8.25)` + `rect 7.2,5 6.5×6.5 rotate(45 10.45 8.25)` |
| `categories` | 1.4 | four `5×5` rects at `1.5,1.5` `9.5,1.5` `1.5,9.5` `9.5,9.5` |
| `sign-out` | 1.4 | `M6 2H3.5C2.7 2 2 2.7 2 3.5V12.5C2 13.3 2.7 14 3.5 14H6` + `M6 8H14M14 8L11 5M14 8L11 11` |

**Actions**

| Name | Stroke | Path data |
| --- | --- | --- |
| `plus` | 2 | `line 8,2→8,14` + `line 2,8→14,8` |
| `split` | 1.5 | `M2 5H14M14 5L11 2M14 5L11 8` + `M14 11H2M2 11L5 8M2 11L5 14` |
| `transfer` | 1.5 | `M2 8H14M9 3L14 8L9 13` |
| `card` | 1.5 | `rect 2,3 12×10` + `line 2,6.5→14,6.5` |
| `cash` | 1.6 | `rect 2,4 12×8` + `line 2,7→14,7` |
| `bank` | 1.6 | `M2 6L8 2L14 6` + `rect 3,7 10×6` |
| `chevron-down` | 2 | `viewBox 0 0 12 8` · `M1 1L6 6L11 1` |
| `calendar` | 1.4 | `rect 2,3 12×11` + `line 2,6.5→14,6.5` |
| `mail` | 1.3 | `rect 1.5,3 13×10` + `M1.5 3.5L8 9L14.5 3.5` |
| `lock` | 1.3 | `rect 3,7 10×7` + `M5 7V4.5C5 2.6 6.6 1 8 1C9.4 1 11 2.6 11 4.5V7` |

**Status and money**

| Name | Stroke | Path data |
| --- | --- | --- |
| `check` | 2 | `polyline 3 8 6.5 12 13 4` |
| `alert-triangle` | 1.6 | `M8 2L14.5 13H1.5Z` + `line 8,6.5→8,9.5` |
| `equals` | 2 | `line 2,6→14,6` + `line 2,10→14,10` — the "computed" marker |
| `arrow-in` | 1.7 | `M4 12L12 4M12 4H6M12 4V10` — precedes an "owes you" amount |
| `arrow-out` | 1.7 | `M4 4L12 12M12 12H6M12 12V6` — precedes a "you owe" amount |
| `bar-chart` | 1.3 | `rect 2,8 3×6` + `rect 6.5,4 3×10` + `rect 11,6 3×8` |
| `shield` | 1.3 | `M8 1.5L14 4V8C14 11.5 11.5 13.8 8 14.5C4.5 13.8 2 11.5 2 8V4L8 1.5Z` |

**Categories**

| Name | Stroke | Path data |
| --- | --- | --- |
| `cart` | 1.2 | `M1.5 2H3L4.5 10.5H12.5L14 4.5H4` + filled `circle 6,13.5 r1` + filled `circle 11.5,13.5 r1` |
| `bolt` | 1.2 | `M9 1L3 9H7L6 15L13 6H9L9 1Z` · `stroke-linejoin="round"` |
| `bag` | 1.3 | `M4 6H12L11.3 14H4.7L4 6Z` + `M6 6V4C6 2.9 6.9 2 8 2C9.1 2 10 2.9 10 4V6` |
| `ticket` | 1.2 / 1 | `rect 1.5,3 13×10` + `line 1.5,6→14.5,6` + `line 1.5,10→14.5,10` |
| `cutlery` | 1.2 | `line 4,2→4,14` + `line 2.5,2→2.5,6` + `line 5.5,2→5.5,6` + `M11 2C11 2 9.5 3.5 9.5 6C9.5 7.5 10 8 11 8V14` |
| `car` | 1.3 | `rect 2,7 12×4` + `M3 7L5 4H11L13 7` + filled `circle 5,12 r1.2` + filled `circle 11,12 r1.2` |

Note `ticket` and `card` are near-identical shapes at different insets. Keep both — they mean
different things and appear side by side in the activity list.

Still to draw, per 2.6: `search`, `filter`, `archive`, `restore`, `edit`, `delete`, `offline`,
`install`, `chevron-right`.

## 6.3 Icon sizes by context

| Context | Size |
| --- | --- |
| Inside a 20px category swatch | 11px |
| Inside a 26px transaction-type swatch | 14px |
| Inside a 32–34px account swatch | 15px |
| Inline in a button or nav link | 14px |
| Summary-tile corner | 15px |
| Input prefix (mail, lock) | 14–15px |
| Bottom tab bar | 17px |
| FAB | 20px |

## 6.4 Category and account mapping — and the null-icon fallback

Account type maps cleanly, because the type is a closed enum:

| Account type | Icon | Swatch |
| --- | --- | --- |
| `bank` | `bank` | `swatch.teal` |
| `cash` | `cash` | `swatch.mint` |
| `credit_card` | `card` | `swatch.coral` |

Categories do not. Build a two-stage resolver:

1. **Stored name.** `Category.icon` holds a lucide-style string. Map the nine seeded defaults,
   then any names an icon picker adds:

   | Stored `icon` | Registry glyph |
   | --- | --- |
   | `utensils` | `cutlery` |
   | `car` | `car` |
   | `shopping-bag` | `bag` |
   | `film` | `ticket` |
   | `house` | `home` |
   | `heart-pulse` | `activity` |
   | `receipt` | **not drawn** — see 2.6 |
   | `plane` | **not drawn** — see 2.6 |
   | `ellipsis` | **not drawn** — see 2.6 |

2. **Deterministic fallback**, for `icon: null` — which today is every user-created category
   (2.3). Hash the category id to pick from the five swatch colours, and fall back to a
   neutral glyph. The hash must be on the **id**, not the name: a category renamed from
   "Food" to "Eating out" should not change colour.

The same resolver decides the swatch colour, since there is no colour field. Keep it in one
module (`src/features/categories/icon-map.ts`) so adding a real `color` field later replaces
one function.

Transaction-type swatches in the activity list are a third case: a 26px **surface-filled**
square with an ink border, holding the category icon for an expense, `transfer` for a
transfer, `card` for a card payment.

---

# 7. Component contracts

What each primitive must do. File paths are the existing ones — this is a restyle of a
working component set, not a new one.

## 7.1 Button — `src/components/ui/Button.tsx`

Five variants. The current component has `primary`/`secondary`/`ghost`; `danger` and the
disabled treatment are new.

| Tone | Fill | Border | Shadow | Label |
| --- | --- | --- | --- | --- |
| `primary` | `brand.solid` | 2px `line` | `hard` | Space Grotesk 600, `brand.contrast` |
| `secondary` | `surface` | 2px `line` | none | Space Grotesk 600, `content` |
| `ghost` | transparent | none | none | Space Grotesk 600, `content`, **underlined** with `text-underline-offset: 4px` |
| `danger` | `negative.surface` | 2px `line` | `hard` | Space Grotesk 600, `content` |
| disabled (any tone) | `surface.disabled` | 2px `content.quiet` | none | `content.quiet` |

Two things the style guide is specific about:

- **Cancel is a `ghost` button, underlined, and it comes after the primary action** in a row
  where the primary is `flex: 1` and Cancel is `flex-shrink: 0` with `white-space: nowrap`.
  This is the fix for the clipped-Cancel bug (9.2) and it must not regress.
- Icon-only buttons are a plain square with the glyph centred, and need `aria-label`.

Padding as drawn: `14–15px 26px` for large, `12px 18px` for small, `6px 12px` for the
quick-add pill label.

## 7.2 Field and inputs — `src/components/ui/Field.tsx`

The label treatment changes completely: labels become **mono, uppercase, 11px,
`letterSpacing: eyebrow`, `content.muted`** — the eyebrow style, not a sentence-case label.
The required marker is an asterisk in `negative`.

| Element | Resting | Focused | Invalid |
| --- | --- | --- | --- |
| `TextInput`, `TextAreaInput` | 1.5px `line.field`, `surface`, 13px 14px padding, Manrope 15px | 2px `line` + `hardFocus` | 2px `negative` + error text below |
| `AmountInput` | as above but **mono 19px** with a `₹` prefix at 14px from the left in `content.subtle` | as above | as above |
| `SelectInput` | 1.5px `line.field`, `surface`, current value left, `chevron-down` right | as above | as above |

The currency prefix is new and worth care: it is a visual affordance, not part of the value.
Render it as a positioned sibling with `pointer-events: none` and pad the input to clear it,
exactly as the draft does. Do not put `₹` in the input's value or placeholder.

**Keep the native `<select>`.** `DESIGN.md` is explicit — "keep the native element for
keyboard/screen-reader support; only the visual chrome is custom". The current
`NativeSelect.Root` + `NativeSelect.Field` structure already does this; it needs restyling,
not replacing. Do not introduce a custom listbox as part of this work.

Error text: mono, 11px, `negative`, below the control. The existing `Field.ErrorText` wiring
gives `aria-invalid` and the description association for free — preserve it.

## 7.3 Card — `src/components/ui/Card.tsx`

Two kinds, and the distinction matters:

- **Container card** — `surface`, 1.5px `line.card`, no shadow. Lists, summaries, detail
  blocks. The default.
- **Subject card** — `surface`, 2px `line`, `hardLg` shadow. The one card that *is* the page:
  the Add expense form, the Settle up form. Expose as `<Card emphasis>`.

`CardHeader` is title (Space Grotesk 700) + optional subtitle (`content.subtle`) + optional
action, which is a mono uppercase link in `brand.fg`, not a button.

`CardList` rows: `padding 16px 24px` desktop, `13px 16px` mobile, separated by 1px
`line.soft`, with no border on the first row.

**Summary tile** is a card variant with a 4px coloured top edge, an eyebrow label and a corner
icon on one line, then a mono figure, then optional hint text. The top-edge colour is
semantic, not decorative:

| Tile | Top edge |
| --- | --- |
| Cash & bank | `swatch.teal` |
| Spent this month | `swatch.butter` |
| Card debt | `swatch.coral` |
| Available credit | `swatch.mint` |

## 7.4 Money, direction and status

Four small components that carry most of the product rules. These are the ones to get right.

**`Amount`** — wraps `textStyle="amount"`. Optional `tone` of `positive` / `negative` /
`neutral`. Never renders a bare signed number for an interpersonal balance.

**`DirectionAmount`** — `arrow-in` or `arrow-out` glyph, then the amount, then **the direction
in words** on the line below (`owes you` / `you owe`). All three signals, always. The arrow is
in addition to the words, never instead of them, and the colour is in addition to both.

**`StatusBadge`** — inline-flex, 1.5px ink border, `padding 3px 8px`, `textStyle="badge"`,
icon + label:

| Badge | Fill | Icon |
| --- | --- | --- |
| Settled | `positive.surface` | `check` |
| Part settled | `warning.surface` | `alert-triangle` |
| Split | `brand.solid` | `split` |
| Transfer | `info.surface` | `transfer` |
| Card payment | `info.surface` | `card` |

**`Stamp`** — the rotated dashed confirmation from 5.4. Props: `label`, `tone`. Used sparingly
and never alone.

**`Avatar`** — square, 1.5px ink border, Space Grotesk 700 initials in ink, filled by context:
`swatch.teal` for the signed-in user, `swatch.mint` when the person owes you, `swatch.coral`
when you owe them. Sizes 20 / 24 / 28 / 32 / 34px as drawn. The colour encodes direction, so
it must never be the only place the direction appears.

**`ReferenceCode`** — mono, `content.meta`, from 2.1. One component so the format decision has
one site.

## 7.5 App shell and navigation — `src/components/layout/`

**Desktop header** (`≥768px`), 58px tall, `surface`, 2px `line` bottom rule:

```text
[diamond] Expense Tracker    Home  Activity  Accounts  People  Categories      [MI] Meera Iyer  [⎋]
```

Nav links are Space Grotesk 14.5px with a 14px leading icon, `content.muted`. The active item
is `content` at weight 700 with a 3px `brand.solid` underline flush to the header's bottom
edge — the draft achieves this with `padding-bottom: 24px; margin-bottom: -24px`, which is
worth copying rather than reinventing.

**Mobile header**, 50px tall: logo and name, then avatar badge, then a 32px icon-only
sign-out. No wide text button — that is the fix for the crushed-title bug (9.2).

**Bottom tab bar** (`<768px`), 64px, `surface`, 2px `line` top rule, five icon-over-label
stacks, active tab gets `content` + the same 3px teal underline. Respect
`env(safe-area-inset-bottom)`.

## 7.6 Feedback

**`Alert`** — square, 1.5px ink border, tinted fill by tone (`positive.surface`,
`warning.surface`, `negative.surface`, `brand.muted`), icon + optional title + description.
This is where errors go. Not a stamp.

**`EmptyState`** — headline in Space Grotesk, description in Manrope, primary action. The four
"needs a prerequisite" guards (`14`–`17` in the coverage matrix) use this, and the handoff
doesn't design them — see 10.

**`InlineForm`** — the categories screen's add/edit pattern: an inline block on
`surface.sunken` with a mono eyebrow heading. **No modals anywhere** (9.1).

## 7.7 Mobile quick-add

A 52px square FAB, `brand.solid`, 2px ink border, `hard` shadow, `plus` glyph at 20px,
positioned 20px from the right and ~84px from the bottom so it clears the tab bar.

Tapping opens four stacked action pills above it over a `rgba(20,18,32,0.45)` scrim: Add
expense (teal), Split a bill, Transfer, Pay card, each a 44px icon square with `hardSm` shadow
and a bordered label to its left. Open state rotates the `plus` 45° into a dismiss affordance.

Two implementation notes:

- `DESIGN.md` says `position: absolute` inside the screen container rather than `fixed`, to
  keep it out of a bad stacking context. That was advice for the static artboards. In the real
  app it needs to stay on screen while the page scrolls, so it must be `fixed` — but it also
  needs a stacking context above the page and below the tab bar's border, and it must not be
  captured in a full-page screenshot the way the current bottom nav was. Pin it in the app
  shell next to `BottomNav`, not inside page content.
- Keyboard and screen-reader path: the FAB is a `button` with `aria-expanded`, the pills are a
  focus-trapped menu, `Escape` closes, and focus returns to the FAB. Skip the press-and-hold
  gesture (2.4).

---

# 8. Layout and responsive rules

- **One breakpoint: 768px** (Chakra's `md`). Above it, desktop layouts; below it, the mobile
  layouts drawn at 393–402px. No fluid in-between design — `DESIGN.md` is explicit, and the
  current app already works this way.
- **Content width 1360px** (`sizes.content`, 85rem) with 40px gutters on desktop, 16–18px on
  mobile. This is a change from the current 64rem.
- Desktop grids: summary tiles and quick actions are `repeat(4, minmax(0, 1fr))` with 16px
  gaps; the owes/you-owe pair is `repeat(2, ...)`. Mobile collapses both to two columns, then
  one.
- Form pages are two columns on desktop — the form card at `flex: 1.4` and a side rail at
  `flex: 1` holding the "why this matters" tint panel and the reference box. Mobile stacks,
  and the side rail comes **after** the form.
- Vertical rhythm between blocks: 24px on desktop, 16px on mobile. Between a page header and
  the first block: 28px / 22px.
- The page header is title + description on the left, actions on the right — **stacking below
  768px** (9.2).

---

# 9. Rules that must survive the restyle

## 9.1 Product rules

Repeated from `design/ux/DESIGN.md` and `docs/01-MVP-SCOPE.md` because a restyle is exactly
when they get broken:

- **Every number is computed, never cached.** No "live" badge, no "as of" implication beyond a
  plain render timestamp — which the dashboard's `AS OF 21 SEP 2026, 06:00` eyebrow is.
- **Three amounts stay visibly distinct** on a shared expense: total paid, your own share,
  what others owe. Never collapsed.
- **Direction is always words.** "Ravi owes you", "you owe Priya". Colour and arrow are
  additions, never substitutes.
- **No modals or dialogs.** Inline or full page, everywhere.
- **Mono, tabular figures** for all amounts, dates and reference codes.
- **Native selects.**

## 9.2 The two bugs this restyle must fix

Both were found in `design/screenshots/` and both are called out in `DESIGN.md`:

- **Clipped Cancel.** The submit button is full-width and Cancel shares its row, so the row
  overflows its container and Cancel is cut off — at both widths, on every create and edit
  form. There is currently no reachable Cancel anywhere in the app. The contract in 7.1 fixes
  it; groups 36 and 41 verify it.
- **Crushed mobile page titles.** At 402px, a header with more than one action button squeezes
  the title to one word per line. The slimmer mobile header in 7.5 plus a stacking page header
  fixes it.

## 9.3 Accessibility that must not regress

The current app has deliberate accessibility work that a visual overhaul can quietly undo:

- `Field` associates label, helper text and error via Chakra's `Field.Root`, and marks the
  control `aria-invalid`. Errors are never colour-only.
- Every dropdown is a native `<select>`.
- `SkipToContent` targets `main#main`.
- Minimum touch target `sizes.touch` (44px).
- The icon-only sign-out button has an accessible name.

New risks this design introduces, all to be checked in group 40:

- **Contrast.** Computed against `surface` `#FFFFFF`, the palette splits cleanly:

  | Token | Value | Ratio | Verdict |
  | --- | --- | --- | --- |
  | `content` | `#1E1B29` | 15.9:1 | passes |
  | `content.muted` | `#5B5770` | 6.9:1 | passes |
  | `brand.fg` | `#1D7A6C` | 5.2:1 | passes |
  | `content.subtle` | `#8B87A0` | **3.5:1** | **fails AA** for body text |
  | `content.quiet` | `#A6A2BC` | **2.5:1** | **fails AA and AA-large** |
  | `content` on `brand.solid` | `#1E1B29` on `#7FD1C3` | 9.5:1 | passes |

  The two failures matter because of where they are used. `content.subtle` carries helper
  text, timestamps, card subtitles and every "1 expense outstanding" line — it is on
  essentially every screen. `content.quiet` is the input placeholder and the disabled label.
  Neither is decorative, so neither qualifies for the large-text exemption at the sizes drawn
  (11–13px). Both need a darker value from the designer; do not silently substitute one.

  Ink on the five swatch fills is comfortable (teal measured at 9.5:1, and mint, coral, butter
  and sky are all lighter than teal), which is what makes the fixed-ink rule in 6.1 safe.

  Dark mode has not been measured. It needs its own pass.
- **Focus visibility.** 5.3 replaces Chakra's focus ring. Every interactive element needs a
  visible focus state, including the ghost Cancel button, which has no border to promote.
- **Rotated stamp text** must not be the only carrier of its message.
- **Dark mode** needs its own contrast pass; it is not implied by the light one.

---

# 10. Screen coverage matrix

The 52 screens in `design/screenshots/README.md` against what the handoff actually draws.
Twelve have a design; forty do not and must be built from the tokens.

| Screen | Design provided | Build from |
| --- | --- | --- |
| `01-login` | `Login.html` (desktop light) | — |
| `02-login-invalid-credentials` | — | `Alert` + `Login.html` |
| `03-register`, `04-register-validation-errors` | — `DESIGN.md` lists sign-up as missing | `Login.html` card + `Field` |
| `05-dashboard-empty` | — | `EmptyState` + `Dashboard-*.html` |
| `06`, `20` accounts list | — | container `Card` + `CardList` + account swatches |
| `07`, `08`, `09` account form | — | Add expense form card |
| `10`, `24` people | — | `Card` + `Avatar` + `DirectionAmount` |
| `11`, `28` person form / edit | — | Add expense form card |
| `12`, `29`, `30`, `31` categories | — | `InlineForm` + category swatches |
| `13`, `32`, `33` activity | `Activity-Light.html` (desktop light only) | dark + mobile from tokens |
| `14`–`17` prerequisite guards | — | `Alert` warning tone |
| `18`, `48`, `49` settlements | — | `Card` + `CardList` + `ReferenceCode` |
| `19` dashboard | `Dashboard-Light/Dark.html`, `Mobile-Dashboard-Light/Dark.html` | — |
| `21`, `22` account detail | — | `Card` + `DetailList` + summary tiles |
| `23` account edit | — | form card |
| `25`–`27` person detail | — | `Card` + `StatusBadge` + `DirectionAmount` |
| `34`, `35` expense form | `AddExpense-Light.html`, `Mobile-AddExpense-Light.html` | dark from tokens |
| `36`, `37` expense detail / edit | — | `Card` + `DetailList` |
| `38`–`40` split form | — | Add expense form card + split editor |
| `41` shared expense detail | — | needs the three-amount treatment (9.1) |
| `42`–`45` transfer and card payment | — `DESIGN.md` lists these as missing | Add expense form card |
| `46`, `47` settle up | `SettleUp-Light.html` (desktop light only) | dark + mobile from tokens |
| `50`, `51` not found | — | `EmptyState` |
| `52` offline | — | `Alert` + `EmptyState` |
| `53` install prompt | — | bordered banner in the shell |

Nothing in the "build from" column should need a new visual idea. If one does, that is a
question for the designer, not a decision to make in code.

---

Next: [`02-DESIGN-TASK-GROUPS.md`](02-DESIGN-TASK-GROUPS.md).
