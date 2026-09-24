# Group 31 — Mobile Quick-Add

The floating add button on phones, and the four-action stack it opens.

---

## 1. What was built

A 52px teal square pinned to the bottom-right of every authenticated screen below 768px. Pressing it
raises four action pills over a dimming scrim — Add expense, Split a bill, Transfer, Pay card — and
rotates its plus 45° into a dismiss affordance. It is the mobile route to the four records this app
exists to create, and on a phone it is now the **only** route to them: the dashboard's four-button
quick-action row is desktop-only from this group on, because the handoff's mobile dashboard does not
draw it.

The button is a real `button` with `aria-expanded`. The open stack traps `Tab`, closes on `Escape`,
and hands focus back. It is mounted in `AppShell` beside `BottomNav` rather than inside page content,
which is what keeps it out of any page's stacking context and stops it repeating in a full-page
capture.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `src/components/layout/QuickAddActions.ts` | `QUICK_ADD_ACTIONS` — the four routes, labels and glyphs. No React, so a Server Component row and a Client Component button can both read it. |
| `src/components/layout/QuickAdd.tsx` | The button, the pill stack, the scrim, and the keyboard behaviour. Client Component. |
| `tests/ui/quick-add.test.tsx` | 19 tests, almost all about the keyboard path. |

### Changed

| File | Change |
| --- | --- |
| `src/components/layout/AppShell.tsx` | Mounts `<QuickAdd />` after `<BottomNav />`; `main`'s mobile bottom padding raised from `28` (112px) to `calc(136px + env(safe-area-inset-bottom))`. |
| `src/features/dashboard/components/QuickActions.tsx` | Reads `QUICK_ADD_ACTIONS` instead of four hard-coded links, and is now `hideBelow="md"`. |

Nothing in `src/theme/` moved. Group 23 had already written the three tokens this needed and had
labelled them for it: `shadows.hardSm` ("Quick-add action pills"), `shadows.hard` ("Buttons and the
FAB") and `surface.scrim` ("The quick-add scrim"). `sizes.fab` was already `3.25rem`.

---

## 3. Key decisions

### 3.1 `fixed`, and mounted in the shell

`DESIGN.md` specifies `position: absolute` inside the screen container. That is correct advice for a
static artboard, where there is nothing to scroll, and wrong for the app: the button has to stay
reachable while a long activity list moves past it. Section 7.7 already anticipated this and asked
for `fixed`.

Mounting it in `AppShell` rather than in page content is the part that matters. A `fixed` element
inside a page's own subtree inherits whatever stacking or transform context that page happens to
create, and it is how the pre-restyle bottom nav ended up drawn halfway down a full-page screenshot.
One mount point, next to the other fixed thing in the app, and every screen gets it for free — which
is also what made "verify it appears on every mobile screen" a one-line check rather than a sweep.

### 3.2 The tab bar dims with everything else

7.7 asks for a stacking context "above the page and below the tab bar's border", and the artboard
draws the tab bar over the scrim. Closed, that is exactly what happens: the layer sits at `docked`
(z-index 10 — the same value the artboard's FAB carries inline).

Open, the scrim and the layer both move to `overlay` (1300), above the tab bar's `sticky` (1100), so
the bar dims and stops taking taps. Leaving it bright would contradict the focus trap in the same
paragraph of 7.7: a control that is unreachable by keyboard and one thumb away by touch is not a
coherent state. The artboard's own comment labels its tab bar "for context only", so its stacking
order is not an instruction.

Verified by hit-testing the centre of the Home tab with `elementFromPoint` while the menu is open: it
returns the scrim, not the link.

### 3.3 The array is reversed, not the flex direction

`QUICK_ADD_ACTIONS` is declared primary-first, which is the dashboard's left-to-right order. The
stack opens upward, so the primary belongs at the bottom, nearest the thumb — the visual order is the
reverse.

`flex-direction: column-reverse` would produce that in one line and was rejected: it makes DOM order
the reverse of visual order, and DOM order is what `Tab` follows (WCAG 2.4.3, Focus Order). Reversing
the array instead keeps the two identical, and the cost is one line in the module.

### 3.4 Focus lands on the action nearest the button, not the first link

A menu conventionally focuses its first item. Here the first item is "Pay card" — the top of the
stack, the furthest from the thumb and the least frequent of the four. Focus goes to the last link,
"Add expense", which is where the eye lands and what the design emphasises with the teal fill.

### 3.5 No `role="menu"`, no arrow keys

These are four navigation links. The ARIA authoring practices are explicit that the menu role is for
commands in an application menu, not for a set of links, and taking the role obliges the arrow-key
behaviour that the role promises. So: plain links, a `role="group"` with an accessible name, and
`aria-expanded` on the trigger. `Tab` and `Escape` are the keyboard contract, which is exactly what
7.7 asks for.

### 3.6 The trigger keeps one name

`aria-label="Quick add"` in both states, with `aria-expanded` carrying open/closed. Swapping the label
to "Close quick add" when open says the same thing twice and lets the two disagree — "Close quick add,
collapsed" is worse than either half alone.

### 3.7 The focus signal is applied to the pill's two parts, not to the link box

A pill is a label and a 44px square with a 10px gap between them. A shadow on the link's own border
box would be drawn largely behind the square's resting ink shadow and read as almost nothing, so
`_focusVisible` promotes both parts to `shadows.hardFocus` through one nested selector on
`[data-quick-add-part]`. Same focus device as everything else (5.3), made visible on a two-part
control.

### 3.8 The mobile quick-action row was removed

`Mobile-Dashboard-Light.html` goes straight from the page header to the summary tiles. There is no
quick-action row on a phone in the handoff, and the reason is visible the moment both ship: eight
controls for four routes on one 393px screen, four of them duplicating the button 40px away. The row
survives above `md`, where there is no floating button.

This is a dashboard change made in a quick-add group, deliberately: the duplication only exists
because this group added the button, and leaving it for group 34 would mean shipping a screen that
the handoff does not draw.

### 3.9 Rotate, do not swap

The open state rotates the `plus` rather than exchanging it for a close glyph, so the two states read
as one control changing rather than two controls in the same place. 120ms `ease-out`, suppressed under
`_motionReduce`.

---

## 4. Business rules enforced

None directly — this group adds no record type and touches no figure. Two product rules it carries:

- **The terminology group 21 settled on (2.7).** The action labels are "Add expense", "Split a bill",
  "Transfer", "Pay card". Those live in `QUICK_ADD_ACTIONS` now, shared with the dashboard row, so the
  two controls cannot drift into calling the same route "Pay card" and "Card payment". The *type*
  labels on a saved record are a separate vocabulary and still live with `StatusBadge`.
- **Every route it offers still goes through the normal forms.** The button is navigation, not a
  shortcut around validation; there is no inline quick-entry. The press-and-hold gesture that would
  have jumped straight to Add expense was dropped in group 21 (2.4) — a hidden gesture with no
  affordance is not a feature — and nothing here reintroduces it.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    608 pass
npx vitest run --project ui                          272 pass  (253 + 19 new)
npx vitest run --project offline                      150 pass
npx eslint src tests                                 clean
npm run build                                        clean
```

`tests/ui/quick-add.test.tsx` covers the closed state, the open state, and the keyboard path: the
`Tab` cycle in both directions including both wrap points, `Escape` closing and returning focus, focus
landing on "Add expense", `aria-expanded` and `aria-controls`, the rotation, closing on navigation,
and closing on navigation **without** stealing focus from the new page.

### Measured in Chromium at 393×780

Against `design/ux/screens/Mobile-QuickAdd-Expanded.html`, opened side by side. Every number below is
the artboard's:

| | Drawn | Measured |
| --- | --- | --- |
| Button | 52×52, right 20, bottom 84 | 52×52, right 20, bottom 84 |
| Button fill / border / shadow | `#7FD1C3`, 2px `#1E1B29`, `4px 4px 0` | `rgb(127,209,195)`, `2px rgb(30,27,41)`, `4px 4px 0` |
| Pill bottoms | 148, 204, 260, 316 | 148, 204, 260, 316 |
| Icon square | 44×44, 2px border, `3px 3px 0` | 44×44, 2px, `3px 3px 0` |
| Label | 6px/12px padding, 13px 600, 1.5px border | `6px 12px`, `13px 600`, 1.5px |
| Label-to-square gap | 10px | 10px |
| Right inset | 20px | 20px |
| Scrim | `rgba(20,18,32,0.45)`, full bleed | `rgba(20,18,32,0.45)`, 393×780 |
| Open glyph | `rotate(45deg)` | `matrix(0.707107, 0.707107, …)` |

Closed layer z-index 10, matching the artboard's inline `z-index:10`; open 1300 against the tab bar's
1100. `elementFromPoint` over the Home tab returns the scrim while open. Focus after `Escape` reports
`aria-label="Quick add"`.

Dark mode measured separately, because the first screenshot read as a bug and was not one: at 393px
the near-white 2px border and near-white offset shadow around a small dark box make it look like a
white box. Computed values are `#1E1B2C` fill with `#F3F0FA` text and a `3px 3px 0 #F3F0FA` shadow for
the three plain pills, and `#4FB9A8` with ink for the primary. A cropped screenshot of the stack alone
confirms it. **Read pixels, then look — at 393px a heavy light border inverts your reading of a small
fill.**

### Screens

Present on all twelve authenticated mobile routes: `/dashboard`, `/transactions`, `/accounts`,
`/people`, `/categories`, `/settlements`, the four `/transactions/new*` forms, `/accounts/new`,
`/people/new`. Absent at 1440px, where the quick-action row is present instead.

### Full-page capture

`page.screenshot({ fullPage: true })` at 393×620 on `/categories` (1030px document): the button appears
**once**, at its viewport position, not repeated down the page. The tab bar does the same, and did
before this group — Chromium composites a fixed layer once into a full-page shot. So the button adds
no new interference, which is what the checkbox asks. Anyone capturing artboard comparisons should
still scroll to top or pass `clip`.

### Clearance

`main`'s mobile bottom padding was `28` (112px), which is less than the 136px the tab bar, the gap and
the button occupy — the last row of every page sat under the button. Now
`calc(136px + env(safe-area-inset-bottom))`. Scrolled to the bottom of `/categories`, the last block's
bottom edge measures 644px and the button's top edge measures 644px: flush, no overlap.

---

## 6. Known gaps

- **Mid-scroll overlap is inherent.** The clearance above guarantees nothing is hidden at the *bottom*
  of a page. Mid-scroll the button still floats over whatever is behind it, including an amount — a
  property of every floating action button, and what the design asks for. Scrolling reveals it.
- **The focus shadow is weak on the primary pill.** Teal focus shadow on a teal fill. The plain pills
  change unmistakably. This is the same weakness the primary `Button` tone has carried since group 27,
  so it is a system-wide question rather than a quick-add one: **group 40** should decide whether
  focus on a teal fill needs a different device, and change both together if so.
- **Reduced motion is handled locally.** `_motionReduce` on the rotation only. There is no app-wide
  reduced-motion rule; group 40 should decide whether one is wanted.
- **No exit animation.** The stack unmounts on close rather than animating out, which is what makes it
  provably untabbable and absent from a capture. If a designer wants an exit transition, it needs a
  visibility-based implementation and a fresh check of both properties.
- **The scrim has no `aria-hidden` sibling announcement.** Opening the menu does not announce itself
  beyond `aria-expanded` changing. That is the standard disclosure pattern, but it is worth a line in
  the group 40 screen-reader walk.
- **Unreviewed by the designer:** the decision to drop the mobile quick-action row (3.8), and the
  two-part focus treatment (3.7). Both follow from drawn screens rather than contradicting them, but
  neither is drawn.

---

## 7. Notes for the next group

- **`QUICK_ADD_ACTIONS` is the list of the four record types as *actions*.** Anything else offering
  these four — an empty-state prompt, a keyboard shortcut sheet — should read it rather than retype
  the labels.
- **`AppShell` now has two fixed children.** If a later group adds a third (a toast, a bottom sheet),
  it needs a z-index decision relative to `docked` (closed quick-add), `sticky` (tab bar) and
  `overlay` (open quick-add), and it needs to go in the shell for the same stacking reason.
- **`main`'s mobile bottom padding is load-bearing at 136px.** It is the tab bar plus the gap plus the
  button. Changing any of those three means changing it.
- **Group 34 (dashboard)** inherits a dashboard whose quick-action row is desktop-only. When comparing
  against `Mobile-Dashboard-Light.html` and `Mobile-Dashboard-Dark.html`, expect the page header to be
  followed directly by the summary tiles. The desktop comparison against `Dashboard-Light.html` still
  includes the row.
- **Group 40** owns the two contrast/motion items above, and should keyboard-walk the open stack on a
  real phone-sized viewport: the trap is hand-rolled over five elements, and the failure mode of a
  hand-rolled trap is escaping it in a way no unit test models.
- **The visual-check technique is now the e2e one.** For anything that only exists inside the
  authenticated shell, a temp spec under `tests/e2e/` using `registerAndSignIn` plus
  `locator.screenshot()` beats the `page.setContent` trick from group 25 — it renders real tokens in
  the real colour mode. Delete the spec and `test-results/` afterwards.
