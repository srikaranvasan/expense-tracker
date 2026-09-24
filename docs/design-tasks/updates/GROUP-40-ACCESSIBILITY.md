# Group 40 — Accessibility And Contrast Audit

"The group most likely to be skipped and most likely to be needed." It found eight defects, three of
them invisible to any visual check.

---

## 1. What was built

An audit, and two permanent artefacts so it never has to be a one-off again.

Every text/background pair the components can produce is now measured on every test run, in both
colour modes, from the token definitions themselves — `src/theme/contrast.test.ts`. Every keyboard
focus ring on the app's most important control is measured in a real browser —
`tests/e2e/focus-visible.spec.ts`. A browser sweep across eight routes in both modes covered the
things a palette cannot answer: focus visibility on every focusable element, accessible names, target
sizes, and a keyboard walk of the quick-add layer.

Eight defects were found and fixed:

| | Defect | Measured | Now |
| --- | --- | --- | --- |
| 1 | `tealText` on the accent tint | 4.47:1 | 5.71:1 |
| 2 | `coralText` on white | 4.21:1 | 5.44:1 |
| 3 | `mintText` on white | 4.26:1 | 5.54:1 |
| 4 | **Danger button label, dark mode** | **1.76:1** | 11.35:1 |
| 5 | **Sync bar text on its coral fill** | 3.2:1 light, **1.1:1 dark** | 11.35:1 / 8.51:1 |
| 6 | **The icon picker had no focus indicator at all** | nothing changed on focus | the teal ring |
| 7 | **`EmptyState`'s title was a `<p>`** | both not-found pages had no heading | `h1` |
| 8 | Two links under `sizes.touch` | 41px and 21px | 45px and 44px |

Rows 4, 5 and 6 are the ones worth reading the reasoning for. None of them could have been found by
looking at a screen.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `src/theme/contrast.test.ts` | 62 assertions: 30 token pairs × 2 modes, plus the two documented exemptions. |
| `tests/e2e/focus-visible.spec.ts` | The keyboard focus ring in Chromium, light and dark, plus the pointer case. |
| `src/components/feedback/EmptyState.test.tsx` | 4 tests, all about the title being a heading. |

### Changed

| File | Change |
| --- | --- |
| `src/theme/tokens.ts` | `tealText` `#1D7A6C`→`#17685B`, `coralText` `#D1523F`→`#BA402E`, `mintText` `#2E8A61`→`#277650`. Each with the measurement that forced it. |
| `src/theme/theme.test.ts` | Locks the three darkened values against anyone copying the handoff's hex back in. |
| `src/components/ui/Button.tsx` | `danger` label → `content.onSwatch`. The focus comment now records the measurement trap. |
| `src/components/ui/Field.tsx` | `CONTROL_STYLES` gained `minH: "touch"`. |
| `src/components/feedback/EmptyState.tsx` | Title renders as a heading; new `titleAs` prop. |
| `src/app/not-found.tsx`, `src/app/(app)/not-found.tsx` | `titleAs="h1"` — neither route has a `PageHeader`. |
| `src/features/sync/components/SyncStatusBar.tsx` | Attention text and its button → `content.onSwatch`. |
| `src/features/categories/components/CategoryIconPicker.tsx` | `className="peer"` on the radio, `_peerFocusVisible` on the tile. |
| `src/components/layout/SkipToContent.tsx` | `paddingBlock` 8px → 11px. |
| `src/app/(app)/settlements/page.tsx` | The trailing link carries its own target height. |
| `tests/ui/categories.test.tsx` | Asserts the `peer` class, which is the whole focus mechanism. |
| `tests/e2e/journeys.spec.ts` | Heading assertion pinned to the `h1` — see section 6. |

---

## 3. Key decisions

### 3.1 The pairs are asserted from the tokens, not from the rendered page

The browser sweep was written first and reported **zero** contrast failures. It was wrong, and the way
it was wrong is the most useful thing in this group.

A rendered sweep can only measure what is on screen. The danger button appears on a delete
confirmation, the coral sync bar appears only when a queued change has been rejected, and a positive
amount needs a shared expense to exist. None of the three was on any of the eight routes, so none was
measured. Three of the eight defects above were invisible to the method.

`contrast.test.ts` measures the pairs the *components* can produce, from the token definitions, in
both modes, on every run. It is a hand-written table of 30 pairs rather than a cross product, because
a cross product would assert forty combinations nothing draws and the honest fix for the first failure
would be to delete the assertion. Each row carries the call site that produces it. Adding a colour
pairing to a component means adding a row.

The browser sweep is still necessary — focus, target size and accessible names are not derivable from
a palette — but it is a check on the rendering, not on the palette.

### 3.2 `content` is not "ink"; `content.onSwatch` is

Defects 4 and 5 are one mistake made twice, and it is the most instructive thing here.

```text
danger button   bg: negative.surface   color: content
```

That reads correctly and is correct in light mode: ink on a coral fill, 11.4:1. In dark mode
`content` flips to `darkInk` — near-white — while `negative.surface` flips to `darkCoral`, which is
*brighter* than the light coral. The label measured **1.76:1**, the worst pair in the application. The
original comment even said "Ink, not `negative`" — the intent was right and the token was wrong.

`content.onSwatch` exists for exactly this: it is ink in **both** modes, and group 29 documented why.
The rule is now stateable: **any text drawn on one of the five swatch fills or their tinted
counterparts uses `content.onSwatch`, never `content`.** `Alert`, `StatusBadge`, `BalanceBadge` and
`OfflineBanner` already got this right; the danger button and the sync bar did not.

The sync bar had the second half of the same problem: its text was `negative` — coral text on a coral
fill, 3.2:1 in light mode and about 1.1:1 in dark, where the token and the fill lighten together. The
fill is the signal there; the words only have to be readable.

### 3.3 `mintText` was darkened because 600 is not bold

WCAG's large-text threshold is 24px, or 18.66px at weight **700**. This design uses 600 for emphasis
almost everywhere, so almost nothing in it qualifies for the relaxed 3:1 threshold. A positive amount
in a list row is 14px at 600 — normal-size text — and the handoff's `#2E8A61` measures 4.26:1 on white.
It passes only as the large tile figure the handoff happens to draw it as.

This is the third deviation from the handoff's palette on the same grounds as the first two, and all
three **need designer sign-off** (section 6).

### 3.4 The icon picker's focus ring, and why it was missing

The picker is a real radio group with the inputs positioned and transparent — the pattern group 39
chose specifically to keep them in the accessibility tree and on the keyboard. It worked: the radios
are reachable, arrow keys move between them, the group is named.

And there was no way to see where you were. The element that receives focus is a 1px transparent
input; the tile a user looks at is a sibling `div` that cannot be focused; nothing connected the two.
Tabbing into the picker changed nothing on screen.

Fixed with Chakra's `peer` mechanism — `className="peer"` on the input, `_peerFocusVisible` on the
tile, which Chakra resolves to `.peer:is(:focus-visible, [data-focus-visible]) ~ &`. Rejected `:has()`
on the label: it would work in current browsers, but the sibling selector needs no feature support
argument and Chakra already has a name for it.

The ring stays distinguishable from selection because **selection is an ink shadow and focus is a teal
one**. A focused unselected tile gets the ink border and a teal shadow; a focused selected tile swaps
its ink shadow for the teal one. Neither can be mistaken for the other, and no third visual language
had to be invented.

A ui test asserts the `peer` class, because the class *is* the mechanism and it looks like dead markup
to anyone tidying up.

### 3.5 `EmptyState`'s title is a heading again, at a level the call site chooses

Group 28 replaced a `Heading` with a styled `Text`. The pixels came out identical, so nothing caught
it — not the visual comparison against the artboards, not the measurements, not the suite. What was
lost:

- both not-found pages had **no heading at all**, and on those pages the title is the entire message
- every empty list lost the landmark a screen-reader user navigates by

`h2` is the default, because most empty states sit under a `PageHeader` that owns the `h1`. The two
not-found pages pass `titleAs="h1"`. Rejected hardcoding `h1` the way `ErrorState` does: an error page
is always the whole page, an empty state usually is not, and an `h1` inside a page that already has one
is its own defect.

The eyebrow (`ERROR 404`, `RECORD NOT FOUND`) deliberately stays a plain `Text`. It is a status line,
not a section title, and promoting it would give a page with one sentence on it two entries in the
heading outline.

### 3.6 The focus ring that was never broken

Thirteen groups' worth of `_focusVisible` was nearly rewritten over a measurement artefact, and it is
recorded here because the next person to measure a hover or focus style will hit it.

A keyboard-focused primary button reported `rgb(30,27,41) 4px 4px 0` — the ink shadow — while
`:focus-visible` matched and the correct rule was present in the stylesheet with higher specificity.
Two "fixes" were written and neither changed anything. Nor did injecting a `!important`-free override,
setting the attribute by hand, or setting an **inline style** — and that last one is impossible, which
is what finally gave it away.

Chakra's button recipe transitions `box-shadow` over 200ms. Every read was happening in the same task
that pressed Tab, so `getComputedStyle` returned a colour a few per cent along the ink→teal fade:
`rgb(37,40,52)`, then `rgb(70,101,104)` once separate round trips let frames render. Nothing was
broken. **Poll until the value settles; never read a transitioned property once.** The comment in
`Button.tsx` and the docblock in `focus-visible.spec.ts` both say so, and the browser sweep waits
280ms at every tab stop for the same reason.

The `_focusVisible` prop was reverted to its original single-prop form, and the explanatory docblock
written for the imaginary cascade bug was deleted rather than left to mislead.

### 3.7 Two failures are recorded as exemptions rather than fixed

**Disabled controls.** `content.quiet` on `surface.disabled` measures 4.17:1 light and 4.40:1 dark.
WCAG 1.4.3 exempts "text that is part of an inactive user interface component", and the entire point
of the treatment is to look unavailable — raising it to 4.5:1 would make a disabled Save look enabled.
It is asserted rather than ignored: it must stay **above 3:1 and below 4.5:1**, so a palette change
cannot quietly make a disabled label invisible, and cannot quietly make this exemption unnecessary
without someone noticing.

**`content.meta` on the accent tint.** 4.20:1, which is why group 21 made `ReferenceCode` switch to
`content.onTint` inside a tinted panel. The test asserts the pair is *below* AA — the reason the switch
exists — so nobody deletes the switch as redundant.

---

## 4. Business rules enforced

- **No information is carried by colour alone.** Verified by inspection of every coloured element, not
  by assertion: the only tone-coloured monetary figure in the application comes from
  `DirectionAmount`, whose `label` prop is required and has no default, so "owes you" / "you owe" is
  always present alongside the arrow and the hue. `Amount`'s own `tone` is used nowhere else with a
  colour. `StatusBadge` and `BalanceBadge` both render their label as text. `AppLink` is underlined.
- **Every rotated stamp is accompanied by plain text.** `Stamp` is `aria-hidden` by default — a
  deliberate default, not an option — and its one call site sits beside the allocated figure that
  proves the claim. The unbalanced case is an `Alert` with a sentence, never a stamp, because a rotated
  dashed stamp makes a blocking error look ornamental.
- **A settled balance still shows no figure.** Unchanged, and re-confirmed: "Settled up" with a check
  glyph, no zero amount in a direction colour.
- **Ink stays on every swatch fill in both modes.** Measured 7.10:1 (dark teal) to 13.43:1 (light
  butter); the instinct to flip to `darkInk` in dark mode would give 1.4:1 to 2.1:1. Now asserted for
  all five fills in both modes.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    677 pass  (613 + 62 contrast + 2 theme)
npx vitest run --project ui                          355 pass  (350 + 4 EmptyState + 1 picker)
npm run test:integration                             508 pass
npx vitest run --project offline                     150 pass
npm run build / npx eslint src tests                 clean
```

### Contrast, from the tokens, both modes

Thirty pairs. Worst in each mode after the three darkenings:

| | Light | Dark |
| --- | --- | --- |
| Lowest passing pair | `content.meta` on the paper, 4.56:1 | `content.quiet` on a card, 5.10:1 |
| Ink on a swatch fill | 9.49:1 (teal) — 13.43:1 (butter) | 7.10:1 (teal) — 11.06:1 (butter) |
| Failures | **0** | **0** |

### Browser sweep — eight routes × two colour modes, seeded with real data

| | Result |
| --- | --- |
| Targets below 44px | **none**, on any route, either mode |
| Focusable controls with no accessible name | **none** (counting `<label for>`, which is how every control here is named) |
| Focusable controls with no visible focus change | **none** — 26 on the dashboard, 24 on activity, 28 on the expense form, 34 on categories, 18 on accounts and people, 17 on settlements |
| Mobile targets at 393px, quick-add open | **none below 44px**; the FAB is 52×52 |

Focus was compared by snapshotting `box-shadow`, `outline-width`, `outline-color` and `border-color` at
rest, then tabbing for real — never `.focus()`, which does not make focus *visible* on a button — and
waiting 280ms at each stop for the transition to settle.

### The quick-add layer, by keyboard at 393px

```text
trigger at rest      aria-expanded="false", 52×52
Enter                opens; focus lands on "Add expense" — the last link, nearest the thumb
Tab ×5               Add expense → trigger → Pay card → Transfer → Split a bill → Add expense
Escape               closes, aria-expanded="false", focus back on the trigger
```

The cycle is closed, which is the focus trap group 31 built, and DOM order matches visual order
bottom-to-top as that group decided — so WCAG 2.4.3 holds without a `tabindex` anywhere.

### The focus ring, in Chromium

```text
primary at rest              rgb(30, 27, 41) 4px 4px 0    shadows.hard
after a real Tab             rgb(127, 209, 195) 4px 4px 0 shadows.hardFocus
after a real Tab, dark mode  rgb(79, 185, 168) 4px 4px 0  hardFocus under _dark
after a mouse click          unchanged — :focus-visible does not fire for a pointer
```

---

## 6. Known gaps

### Needs manual assistive-technology testing

Required by the task list, and none of it is automatable. Nothing below has been done.

- **A screen-reader pass over the money components.** The automated check proves an accessible name
  exists; it cannot tell you whether `DirectionAmount` announces as "₹1,600.00 owes you" in a useful
  order, or whether the decorative arrow leaks through. NVDA + Firefox, VoiceOver + Safari, and
  TalkBack are three different answers.
- **The split editor and the settle-up editor.** Both compute as you type. Whether a changing
  allocation total is announced at a useful moment — or announced constantly — is a judgement a person
  has to make with a screen reader running.
- **`aria-live` in practice.** `SyncStatusBar` is `role="status" aria-live="polite"` and the offline
  banner similar. Live regions frequently fail to announce for reasons that are invisible in the DOM.
- **Forced-colors / Windows High Contrast mode.** This is the one to worry about. The design is built
  on 2px borders and **offset shadows**, and `forced-colors: active` removes `box-shadow` entirely —
  which would take the focus ring with it, and flatten primary against secondary buttons. There is no
  `_highContrast` rule anywhere in the theme. Probably needs a forced-colors block that restores an
  `outline`-based focus indicator.
- **200% zoom and 400% reflow** (WCAG 1.4.4, 1.4.10). The layout is responsive, but reflow at 320px
  equivalent has not been checked, and the mono tabular figures are the likely casualty.
- **Voice control.** Whether "click Sign out" works for an icon-only button whose visible label is
  nothing — the accessible name is right, but voice engines vary.
- **iOS VoiceOver on the quick-add layer.** The focus trap is verified in Chromium; a rotor swipe is a
  different traversal.

### Deviations from the handoff needing designer sign-off

Three palette values are no longer the ones drawn:

```text
tealText   #1D7A6C → #17685B    4.47:1 on the accent tint it is drawn on
coralText  #D1523F → #BA402E    4.21:1 on white at 14px/600
mintText   #2E8A61 → #277650    4.26:1 on white at 14px/600
```

All three are AA failures at the size and weight the handoff itself draws them, so the change is not
optional — but the specific replacements are a judgement about how dark is dark enough, and the
designer should see them. They join the four from group 21, which anticipated only `content.subtle`
and `content.quiet`.

### Not addressed

- **`prefers-reduced-motion` is honoured in exactly one place** — the FAB's plus rotation. The 200ms
  `box-shadow`/`background-color` transitions on every recipe do not. A colour fade is not the kind of
  animation WCAG 2.3.3 targets, so this is a judgement call rather than a failure, but it should be a
  deliberate one.
- **`/shared` was audited in its empty state.** Two focusable elements. The populated split list has
  not been swept.
- **Detail pages, forms other than the expense form, and the settle-up editor were not in the sweep.**
  Eight routes were, and every primitive on the others is one of the same components, but the sweep is
  not exhaustive.
- **No axe or similar rule engine was run.** The checks here are the ones the task list asked for,
  written by hand. A rule engine would find categories of problem this did not look for — landmark
  structure, duplicate ids, ARIA attribute validity.

---

## 7. Notes for the next group

- **The two artefacts are the point.** `contrast.test.ts` fails the build if a palette change breaks a
  pair; `focus-visible.spec.ts` fails if the focus ring stops painting. Neither needs a human to
  remember to re-run an audit.
- **Never read a transitioned CSS property in the task that changed it.** Section 3.6. This cost real
  time and will do so again.
- **`content.onSwatch`, never `content`, for text on a swatch fill or a tint.** Section 3.2. Two
  components got this wrong; a third that adds a coloured fill will too.
- **Group 41 will find two e2e failures that are not restyle regressions.** Sign-out leaves
  `authjs.session-token` alive, because NextAuth re-issues the cookie on RSC prefetches and the sync
  poll that race the sign-out response. The whole sign-out path — button handler, server action, auth
  config, middleware — is untouched by this restyle. Evidence and candidate fixes are in the group 41
  document. It is a security defect and it needs its own task.
- **Forced-colors mode is the biggest open accessibility risk**, because the design's two load-bearing
  devices — the offset shadow and the 2px border — are exactly what that mode replaces.
