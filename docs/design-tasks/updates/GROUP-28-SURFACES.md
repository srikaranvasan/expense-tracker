# Group 28 — Surfaces And Feedback

Cards, tiles, alerts, empty states, and the four audit motifs. Section 7.3, 7.6 and 5.4–5.5 of
[`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md).

---

## 1. What was built

- **`Card` splits into container and subject.** The default is quiet; `emphasis` makes it the page.
- **`SummaryTile`** moved into the surface primitives and gained its semantic 4px top edge.
- **`Alert` was rewritten from scratch** rather than restyled — square, ink-bordered, tinted by
  tone, with an icon.
- **`EmptyState`** lost its dashed border, because dashes mean something else in this design.
- **`Stamp`** is new: the rotated dashed confirmation, with its usage rule enforced by its API.
- **`RegistrationTicks` and `GraphPaper`** are new, and the sign-in page now uses both.
- **`ErrorState`, `OfflineBanner` and `SkipToContent`** restyled.

Two real bugs were found and fixed by rendering rather than asserting, and one of them was a
build-breaking RSC boundary error that this group triggered.

---

## 2. Files added or changed

**Surfaces**

| File | Change |
| --- | --- |
| `src/components/ui/Card.tsx` | rewritten. `Card` gains `emphasis`; adds `SummaryTile`, `TILE_EDGES`, `RegistrationTicks`, `GraphPaper` |
| `src/components/ui/Stamp.tsx` | **new** |
| `src/components/ui/Card.test.tsx` | **new.** 25 tests over cards, tiles, alerts, empty states, stamps and motifs |

**Feedback**

| File | Change |
| --- | --- |
| `src/components/feedback/Alert.tsx` | rewritten, no longer wraps Chakra's Alert |
| `src/components/feedback/EmptyState.tsx` | restyled; solid border, explicit heading colour |
| `src/components/feedback/ErrorState.tsx` | restyled; the digest is now a bordered tint box |
| `src/components/feedback/OfflineBanner.tsx` | restyled; mono, `offline` glyph, 2px bottom rule |
| `src/components/layout/SkipToContent.tsx` | restyled; square, ink border, offset shadow |

**Consumers**

| File | Change |
| --- | --- |
| `src/app/(auth)/layout.tsx` | graph paper, registration ticks, `emphasis` card at `hardXl` |
| `src/app/(app)/dashboard/page.tsx` | tiles gain `edge` and `icon` |
| `src/features/dashboard/components/SummaryTile.tsx` | **deleted** — superseded by the card variant |

**Fixed along the way**

| File | Change |
| --- | --- |
| `src/components/icons/Icon.tsx` | `chakra("svg")` replaced with `Box asChild` around a plain `<svg>` (3.6) |
| `src/components/icons/registry.test.tsx` | assertions follow the new attribute-based shape |

---

## 3. Key decisions

### 3.1 Container versus subject is a real distinction, not two styles

`Card` defaults to the quiet treatment — `1.5px` at 18% ink, no shadow — and `emphasis` gives it
`2px` of full ink plus `hardLg`. The default matters more than the variant: a page of six cards only
reads as one page if the ordinary card is the restrained one.

The doc comment says **exactly one card per screen should be emphasised**, because two competing
subjects is worse than none. Only the sign-in card, the Add expense form and the Settle up form
qualify.

### 3.2 `overflow: hidden` is dropped once a card is emphasised

A container card clips, so a `RowLink`'s hover fill cannot bleed past the border. An emphasised card
must not, because it is a form — and a form ends in a button, and every button in this design has a
4px offset shadow that would be sliced off at the card edge. Two different needs, one prop, with a
test.

### 3.3 `Alert` no longer wraps Chakra's Alert

Chakra derives an alert's fill, border and indicator colour from `status` plus a colour palette.
This design uses the five pastel fills with a **full-ink border and dark text on every one**, which
is the opposite of how Chakra colours an alert: the override list came out longer than the component
it was overriding.

Written out, the four tones sit in one table and can be checked against the handoff by reading. The
accessibility behaviour Chakra provided is reproduced explicitly, and that part is not cosmetic:
`role="alert"` on the error tone so a validation failure is announced the moment it appears, and
`role="status"` with `aria-live="polite"` on the other three so a success message does not talk over
whatever the user is doing next. There is a test for the distinction.

### 3.4 The info alert does **not** use the fixed-ink rule — this was a real bug

Found by rendering all four tones in both modes.

The fixed-ink rule (`content.onSwatch`, ink in both modes) is safe on a **swatch** fill, because
mint, butter and coral are bright in either mode — measured 8.5:1 to 13.4:1. It is *not* safe on a
**tint**:

```text
brand.muted  light  tealTint      #DCF3EE   ink measures 14.6:1   fine
brand.muted  dark   darkTealTint  #16302C   ink measures  1.2:1   invisible
```

The info alert was unreadable in dark mode. `content.onTint` exists for exactly this shape of token
— `inkOnTint` light, `darkInkSecondary` dark, 7.8:1 and 8.2:1 — so the tone table now carries a
per-tone foreground rather than one shared value.

The general lesson, recorded because it will recur: **a tint is not a swatch.** `brand.muted` and
`brand.subtle` invert in lightness between modes; the five `swatch.*` fills do not. Anything drawn
on a tint needs `content.onTint`.

No assertion in this group would have caught it. Every token involved was individually correct.

### 3.5 `EmptyState` uses a solid border, not a dashed one

A dashed container is the usual convention for emptiness and is wrong here: **dashed is the stamp
motif** (5.4), reserved for rotated status confirmations. If an empty list used dashes, the one
place dashes appear would stop meaning anything. So this is an ordinary container treatment and the
emptiness is carried by the words and the padding.

It is also deliberately *not* a `Card`: an empty state is centred text, and reusing `Card` would
invite someone to put a `CardHeader` on it.

### 3.6 `Icon` had to stop using `chakra("svg")` — this group broke the build

`chakra()` is a **client-side factory**. Calling it at module scope in a module without
`"use client"` makes that module unusable from a Server Component, and `next build` fails with:

```text
Attempted to call chakra() from the server but chakra is on the client.
```

Groups 25 to 27 never hit it because every icon consumer was a Client Component. This group made
`Card` and `Alert` render icons, and both are reached from Server Components — the dashboard page and
the unauthenticated layout — so the build broke immediately.

`"use client"` on `Icon.tsx` would have worked and was rejected: it pushes every icon and the whole
registry across a client boundary for the sake of a styling wrapper. Instead `Box asChild` wraps a
plain `<svg>`. `Box` is exported by the library with its boundary already handled, and `asChild`
merges its generated class onto the child.

The rewrite also improved the layer split that group 25 had already reasoned about. Now:

- **Chakra owns layout and colour** on the wrapper — `display`, `flex-shrink`, `_dark`, tokens, and
  whatever the caller passes;
- **SVG owns geometry and painting** — `viewBox`, `width`/`height` and the paint attributes are real
  attributes, so the three glyphs that override the stroke weight on one of their own children
  (`accounts`, `ticket`, `offline`) still win, with no cascade subtlety in play.

### 3.7 The tile's edge colour and its figure colour are separate questions

`edge` says *what kind of figure this is*; `tone` says *whether this number is bad news*. Card debt
keeps its coral edge whatever it reads, and only the figure turns negative. Conflating them would
make a healthy card debt look like a different kind of tile.

`TILE_EDGES` names the five edges by meaning (`brand`, `caution`, `negative`, `positive`, `info`)
rather than by colour, and maps them to `swatch.*` tokens. A tile that picked a colour directly
would break the association the dashboard depends on — asserted by a test that every value in the
map is a `swatch.` token.

### 3.8 The old dashboard `SummaryTile` was deleted, not left as an adapter

Keeping the feature component as a thin wrapper would have avoided touching the dashboard page.
Rejected: two components called `SummaryTile`, one delegating to the other, is how a codebase ends up
with the wrapper accumulating behaviour the real one does not have. The six call sites gained `edge`
and `icon` in the same commit.

This also gave `bar-chart` and `shield` their first call sites — two of the five glyphs group 25
flagged as unused.

### 3.9 `Stamp`'s usage rule is in its API, not only in its comment

Section 5.4 says a stamp must never be the only carrier of its message, and is for derived
confirmations rather than errors. Two design choices enforce that:

- **`aria-hidden` is the default.** The accompanying plain text is what assistive technology should
  read; a decorative duplicate is noise. `announce` exists as an escape hatch whose doc comment says
  that needing it means the screen is missing a sentence.
- **One rotation, `-7deg`.** The spec allows -6 to -8; picking the middle once means a page with
  three stamps does not look like a mistake.

There are no `error` or `warning` tones. A stamp saying something is wrong reads as decoration, so
the tones are `positive` and `neutral` and the component cannot express a failure.

### 3.10 `SkipToContent`'s focus state is its visibility

Every other control got a teal offset shadow on focus. This one is invisible until focused, so
"add a focus indicator" is already satisfied by existing at all — a teal shadow on top would be
redundant. It gets the ink `hard` shadow instead, so when it appears it looks like the design's other
primary surfaces. The reasoning is in the code, because "why does this one differ" is the obvious
question.

### 3.11 `GraphPaper` uses Chakra's token-reference syntax inside a gradient

`linear-gradient({colors.line.grid} 1px, transparent 1px)` — the same `{...}` mechanism the hard
shadows use. A literal `rgba(30,27,41,0.05)` would be a light-mode grid on a dark page. A CSS custom
property was tried first and abandoned: custom-property values are not passed through Chakra's token
resolver, so `--grid-line: colors.line.grid` would have shipped that string verbatim.

---

## 4. Business rules enforced

- **Errors are alerts, never stamps** (5.4). `Stamp` has no error tone, so the wrong choice is not
  expressible.
- **A validation failure is announced, not merely coloured.** `role="alert"` on the error tone;
  everything else is polite.
- **Colour is never the only signal.** A summary tile always states what its number is in its label,
  and `tone` only colours the figure. A test asserts the label is present.
- **An empty list is never a dead end** — `EmptyState` takes an `action`, and the four prerequisite
  guards in the coverage matrix use a warning `Alert` instead.
- **Contrast survives the colour mode.** 3.4 is the concrete case: a foreground chosen for a light
  tint is wrong on a dark one.
- **The support reference is readable and copyable.** `ErrorState`'s digest is the only link between
  what the user saw and a line in the server log (docs/12 section 45), so it is in a bordered tint
  box with `user-select: all` rather than buried in small grey text.

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run verify` (typecheck, lint, 593 unit) | passes |
| `npx vitest run --project ui` (198, +25 here) | passes |
| `npx vitest run --project offline` (150) | passes |
| `npm run build` | compiles clean |
| `npx playwright test tests/e2e/color-mode.spec.ts` | 6 passed — the restyled unauthenticated layout still resolves the dark palette correctly |
| **visual render of every surface in light and dark** | two bugs found; see below |

The visual sheet rendered four summary tiles, a card with a header and a two-row list, a detail
block, two stamps beside a figure, all four alert tones, an empty state, and the sign-in card inside
graph paper with its registration ticks — twice, once inside a `.dark` wrapper. It found:

- **The info alert unreadable in dark mode** (3.4). A genuine contrast bug in shipped-looking code.
- **The `EmptyState` heading invisible in dark**, because it relied on inheriting `body { color }`.
  Now explicit, with a comment saying why.

It also produced one false alarm worth recording, for the second time in this series: several pieces
of text looked missing in the dark pane. They were the *test fixture's own* `<Text>` elements, which
inherit their colour from `body` — a rule the standalone HTML page does not carry. The components
that set their colour explicitly all rendered correctly. The lesson from group 26 applies: measure
the computed value before believing the screenshot.

Also confirmed visually: the tile top edges are the right four colours and 4px, the list divider is
a hairline rather than a card border, the stamps are dashed and rotated, the ticks sit inside the
card corners, and the graph paper is faint in light and barely-there in dark.

**Not verified.** No restyled *page* has been compared against `design/ux/screens/` — the shell is
still unstyled, so a screen comparison would report differences that belong to group 30. The dark
graph paper and `darkDisabledSurface` remain designer-unreviewed derivations from group 23. And the
four prerequisite guards, the settle-up `BALANCED` stamp and the person-detail states are where
these components get their real test; they land in groups 36 to 38.

---

## 6. Known gaps

- **`Alert`'s `info` icon is an in-house choice.** The handoff draws no informational alert and the
  glyph set has nothing neutral-but-noteworthy; `shield` reads as "worth knowing, nothing is wrong".
  Needs designer review.
- **`TILE_EDGES.info` (`swatch.sky`) has no call site.** Four of the five edges are used by the
  dashboard; sky is there for completeness and is unreviewed.
- **`Stamp` has no call site yet.** Group 38 puts `BALANCED` on the settle-up allocation total,
  which is the only use the design specifies. Until then the rotation, the dash spacing and the
  tracking have been seen only on a test sheet.
- **`CardHeader` has no subtitle in the handoff at mobile width.** The responsive size pair
  (`eyebrow` / `subtitle`) is an interpolation.
- **`DetailList` row gap is 2.5 (10px)**, chosen to sit comfortably under the eyebrow labels. The
  handoff draws detail blocks only inside the settle-up side rail, so this is largely invented and
  group 35 will be the first real test of it.
- **`RegistrationTicks` renders four absolutely-positioned boxes.** An SVG would be one element, but
  the boxes inherit `line` and flip with the mode for free. The cost is four extra DOM nodes on the
  sign-in page, which is acceptable exactly once — do not reach for this component anywhere else.
- **The `ErrorState` digest box uses `brand.muted`**, which is the tint that inverts between modes
  (3.4). It uses `content.onTint` correctly, but it is the second place in the app to depend on that
  pairing and there is no mechanism preventing a third from getting it wrong.

---

## 7. Notes for the next group

Group 29 (money and identity components) builds `Avatar`, `CategorySwatch`, `AccountSwatch`,
`StatusBadge` and `ReferenceCode`. Four things from here bear directly on it:

- **`Icon` takes `onSwatch`** and every one of those components draws a glyph or initials on a
  coloured fill. Set it, or the glyph disappears in dark mode.
- **A tint is not a swatch** (3.4). `StatusBadge`'s "Split" badge is `brand.solid` — a swatch, so ink
  is correct. `ReferenceCode` inside the form side rail sits on `brand.muted` — a tint, so it needs
  `content.onTint`, which is what group 21 already decided for it.
- **`textStyle="badge"`** exists in the theme and already carries mono, the size, the tracking and
  the uppercasing. Do not re-specify those on `StatusBadge`.
- **Do not add a `chakra()` call to a module a Server Component might import** (3.6). `Box asChild`
  is the pattern; `Avatar` and the swatches will have the same constraint, since list rows are server
  rendered.

For the screen groups after that:

- **Use `Card` plainly.** Reach for `emphasis` only on a form that is the page (3.1).
- **Put the card's action in a `CardActionLink`**, not a `Button` (7.3). It is built and, as of this
  group, used.
- **Errors go in an `Alert`.** Not a `Stamp`, not red text.
