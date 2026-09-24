# Design Task Groups 21-41

The work. Twenty-one groups, 180 checkboxes, that take the app from its current plain Chakra UI
to the "Ledger Geometry" design in `design/ux/`.

The rules live in [`01-DESIGN-SYSTEM.md`](01-DESIGN-SYSTEM.md) — tokens, typography, geometry,
the icon registry, component contracts. **Bracketed numbers below are section numbers in that
file**, so `(6.4)` means section 6.4 of `01-DESIGN-SYSTEM.md`.

Conventions match `docs/13-MVP-TASK-GROUP.md`: tick each box as the work lands, not in a batch
at the end, and write an update document per group before calling it done (section 3).

## Numbering

Groups 1-20 are the MVP, in `docs/13-MVP-TASK-GROUP.md`. This series continues from 21 so a
group number is unambiguous across the whole project. Update documents for **this** series go
in `docs/design-tasks/updates/`, not `docs/updates/`.

---

# 1. The groups

## 21. Design Decisions And Sign-off

Nothing else starts until these are answered. Each one changes the shape of the work.

* [x] Decide the reference-code approach — sequence, derived, or dropped (2.1)
* [x] Decide whether dark mode is in scope for this pass (2.2)
* [x] Decide on a category icon picker and a `color` field, or resolver-only (2.3)
* [x] Confirm the deterministic icon/colour fallback rule for null-icon categories (2.3)
* [x] Drop or specify an affordance for the press-and-hold FAB gesture (2.4)
* [x] Get the six undocumented colours confirmed or replaced (2.5)
* [x] Get darker replacements for `content.subtle` and `content.quiet`, which fail WCAG AA as drawn (9.3)
* [x] Commission or schedule the nine missing icons (2.6)
* [x] Settle the split/transfer/card-payment terminology per context (2.7)
* [x] Confirm where a dark-mode toggle lives, given there is no settings screen
* [x] Record every answer in `docs/design-tasks/updates/GROUP-21-DESIGN-DECISIONS.md`

## 22. Typography And Font Loading

* [x] Add `src/app/fonts.ts` with Space Grotesk, Manrope and IBM Plex Mono via `next/font/google`
* [x] Apply all three CSS variables to `<html>` in the root layout
* [x] Point the `heading`, `body` and `mono` font tokens at the variables
* [x] Add the `fontSizes` steps for the scale in 4.2
* [x] Add `letterSpacings` tokens
* [x] Add the `eyebrow` and `badge` text styles; extend `amount` to carry the mono family
* [x] Verify no screen sets a font family inline
* [x] Add the font files to the service-worker precache list
* [x] Verify offline load still renders in the right faces

## 23. Design Tokens

* [x] Replace the colour palette in `src/theme/tokens.ts` (3.1)
* [x] Add `borderWidths`, `shadows`, `radii` and the revised `sizes` tokens
* [x] Rewrite `src/theme/semantic.ts` with both modes on every value (3.3)
* [x] Override semantic `radii.l1/l2/l3` to `0`
* [x] Add the `borderRadius: 0 !important` global reset
* [x] Update `src/theme/raw-colors.ts` and its four consumers (3.2)
* [x] Regenerate the PWA icons and verify the manifest and `theme-color`
* [x] Confirm no component references a raw token directly
* [x] Confirm `npm run build` produces no unresolved token warnings

## 24. Dark Mode Infrastructure

Skipped entirely if group 21 defers it — but the tokens from group 23 still carry `_dark`
values.

* [x] Add a colour-mode provider that sets a `dark` class on `<html>`
* [x] Verify against Chakra's condition: `.dark &, .dark .chakra-theme:not(.light) &`
* [x] Persist the preference and honour `prefers-color-scheme` on first visit
* [x] Prevent the flash of wrong theme before first paint
* [x] Emit the correct `theme-color` per mode
* [x] Add the toggle control, in the location group 21 chose
* [x] Verify both dark screens in the handoff match — palette and mechanism only; the layout comparison is inherited by groups 30 and 34, which have the screens to compare (see GROUP-24 section 5)
* [x] Add a test that the provider renders both modes

## 25. Icon System

* [x] Create `src/components/icons/registry.ts` with all 28 glyphs from 6.2 — landed as `registry.tsx` plus `names.ts`; the tables list **29**, not 28 (see GROUP-25 section 3.3)
* [x] Create the `<Icon name size />` component with `currentColor` and `aria-hidden` defaults
* [x] Add the fixed-ink rule for icons inside swatches and avatars (6.1)
* [x] Add the nine missing glyphs from 2.6 — fourteen in the end: the nine, plus `receipt`/`plane`/`ellipsis` for the seeded defaults and `sun`/`moon` for the group 24 toggle
* [x] Create `src/features/categories/icon-map.ts` — name lookup plus deterministic fallback (6.4)
* [x] Add the account-type icon and swatch mapping
* [x] Add the transaction-type icon mapping for the activity list
* [x] Unit-test the resolver, including `icon: null` and an unknown name
* [x] Verify the fallback is stable across a rename

## 26. Form Primitives

* [x] Restyle `Field` labels to the mono uppercase eyebrow treatment
* [x] Restyle the required marker
* [x] Restyle `TextInput` and `TextAreaInput` resting, focused and invalid states (7.2)
* [x] Add the offset-shadow focus treatment without layout shift (5.3) — constant 2px border, colour carries the promotion; see GROUP-26 section 3.1
* [x] Add the `₹` prefix to `AmountInput` as a non-interactive sibling
* [x] Restyle `SelectInput`, keeping the native element and adding the `chevron-down`
* [x] Restyle error text to mono `negative`
* [x] Verify `aria-invalid` and the label/error association still hold
* [x] Verify the existing `Field` tests pass unchanged — all six unedited

## 27. Buttons And Actions

* [x] Implement the five button tones from 7.1
* [x] Implement the disabled treatment
* [x] **Fix the clipped-Cancel bug** — primary `flex: 1`, Cancel `flex-shrink: 0` and `nowrap` — owned by a new `FormActions` component so it cannot recur; measured at 402px (GROUP-27 section 5)
* [x] Restyle the ghost/Cancel button as underlined text with a visible focus state
* [x] Add the icon-only square button variant with a required `aria-label`
* [x] Restyle `AppLink`, including the mono uppercase card-action link
* [x] Audit every form for a reachable Cancel — eight converted, one conditional Cancel made unconditional, two auth forms exempt with a link out

## 28. Surfaces And Feedback

* [x] Split `Card` into container and `emphasis` (subject) variants (7.3)
* [x] Restyle `CardHeader`, `CardBody`, `CardList`, `DetailList`, `DetailRow`
* [x] Build the summary-tile variant with its semantic top-edge colours — moved into `components/ui/Card.tsx`; the dashboard copy is deleted
* [x] Restyle `Alert` to the square tinted treatment with icons — rewritten rather than wrapped; note the tint/swatch foreground split in GROUP-28 section 3.4
* [x] Restyle `EmptyState`
* [x] Build the `Stamp` component with its usage rule (5.4)
* [x] Build the registration-tick wrapper for the sign-in card
* [x] Build the graph-paper background for the unauthenticated layout
* [x] Restyle `ErrorState`, `OfflineBanner` and `SkipToContent`

## 29. Money, Identity And Status Components

* [x] Build `Amount`
* [x] Build `DirectionAmount` — arrow plus colour plus words, all three (9.1) — `label` is a required prop, so the words cannot be omitted
* [x] Rebuild `BalanceBadge` on it
* [x] Build `StatusBadge` with the five badges in 7.4
* [x] Build `Avatar` — square, ink border, initials, direction-coloured fill
* [x] Build `CategorySwatch` and `AccountSwatch` — plus `TransactionTypeSwatch`; all three live in their features because `components/ui` may not import feature logic (GROUP-29 section 3.5)
* [x] Build `ReferenceCode`
* [x] Unit-test that a zero and a settled balance still read correctly
* [x] Verify no component conveys direction by colour alone

## 30. Application Shell And Navigation

* [x] Restyle the desktop header with icon + label nav and the teal active underline (7.5) — underline measured flush at 58px against a 60px header
* [x] Add the diamond logo mark
* [x] Add the avatar badge and icon-only sign-out
* [x] Build the slim mobile header — **fixes the crushed-title bug** — measured at 402px: every header button 44×44, page header stacks, title one line (GROUP-30 section 3.3)
* [x] Restyle `BottomNav` as icon-over-label with the active underline
* [x] Make `PageHeader` stack title and actions below 768px
* [x] Add the "AS OF" render-timestamp eyebrow to the dashboard header
* [x] Widen the content column to `sizes.content` — measured 1360px
* [x] Restyle the install prompt banner — not rendered in a headless run, so unreviewed in practice
* [x] Verify `SkipToContent` still reaches `main#main`
* [x] **Fixed a latent group 23 bug**: raw `colors.surface` collided with semantic `colors.surface.DEFAULT`, making the variable cyclic and every `bg="surface"` transparent (GROUP-30 section 3.1)

## 31. Mobile Quick-Add

* [x] Build the FAB (7.7) — measured 52×52 at right 20 / bottom 84, teal, 2px ink, `4px 4px 0`
* [x] Build the expanded pill menu and scrim — pill bottoms measured at the artboard's 148/204/260/316
* [x] Rotate the glyph in the open state — settles at `rotate(45deg)`, suppressed under `_motionReduce`
* [x] Mount it in the app shell, `fixed`, clear of the tab bar and the safe-area inset — `main`'s mobile `pb` raised 112px → `calc(136px + env(safe-area-inset-bottom))`, measured flush at the bottom of the scroll
* [x] Make it keyboard operable — `aria-expanded`, focus trap, `Escape`, focus return (GROUP-31 sections 3.4–3.6)
* [x] Confirm it does not interfere with full-page screenshot capture — appears once, like the tab bar already did
* [x] Verify it appears on every mobile screen, not just the dashboard — checked on all twelve authenticated mobile routes, absent at 1440px
* [x] **Removed the mobile quick-action row**, which the handoff's mobile dashboard does not draw (GROUP-31 section 3.8)

## 32. Ledger Reference Codes

Shape depends entirely on the group 21 decision.

* [x] Implement the chosen approach from 2.1 — Option B, **derived from `clientId`** rather than the `ObjectId`; group 21's stated offline property is only achievable that way, and `AddExpense-Light.html` draws a code on an unsaved record (GROUP-32 section 3.1, with a correction note added to GROUP-21 section 3.1)
* [x] If sequential: allocate inside the existing `withTransaction()` and prove no gaps or duplicates under concurrent writes — **not applicable**, option B allocates nothing; the seam for A is `referenceCodeFor`
* [x] Surface the code in the transaction, settlement and expense view models — `TransactionListItem.referenceCode` (inherited by the transfer, card-payment and shared-expense views) and `SettlementView.referenceCode`
* [x] Render via `ReferenceCode` in the activity list, detail pages and dashboard — measured against `Activity-Light.html` (reference before amount, 14px gap) and `Dashboard-Light.html` (stacked, right-aligned)
* [x] Handle the offline case — the add-expense form shows `#6EDA7 · draft`, the **same** code the saved record carries; a record already queued is still not rendered in any list, which is an offline-layer gap recorded in GROUP-32 section 6
* [x] Add integration tests for uniqueness and stability — 11 tests in `tests/integration/reference-codes.test.ts`; stability holds through an edit, and the *absence* of uniqueness and ordering is asserted too
* [x] **Fixed a test-fixture bug**: `clientId()` ended in a constant `-aaaaaaaa`, so every record in every integration test derived the same code `#AAAAA` (GROUP-32 section 3.7)

## 33. Auth Screens

* [x] Restyle sign-in to `Login.html` — ticks, shadow, graph paper, input prefix icons; card measured at 440px with `8px 8px 0`, eyebrow 11px `#1D7A6C` at 0.1em, glyphs 15px at left 14px
* [x] Design and build sign-up from the same components (not drawn — 10) — same card, eyebrow, heading, fields and link; **no prefix icons**, deliberately (GROUP-33 section 3.3)
* [x] Restyle both validation-error states — checked at 1440px and 402px: coral summary alert, `negative` borders, a mono message under each field
* [x] Keep the deliberate "which half was wrong" ambiguity on a failed sign-in — verified in a browser: one form-level `role="alert"`, **zero** fields marked `aria-invalid`
* [x] Restyle the unauthenticated layout — three flex bands rather than the artboard's absolute insets, so the tall sign-up card does not overlap them on a phone (GROUP-33 section 3.2); the page `h1` is now the page title, not the product name
* [x] Verify at 402px — card 366px, `h1` one line, no horizontal overflow, currency/timezone stacked
* [x] **Fixed a group 26 bug found here**: Chakra's Input recipe sets `position: relative`, so a positioned prefix painted *behind* the input — the new icons **and** `AmountInput`'s `₹`, invisible in the app while every assertion passed (GROUP-33 section 3.5)

## 34. Dashboard

* [x] Restyle the quick-action grid — a leading glyph per action, from the list shared with the mobile quick-add; primary measured teal with `4px 4px 0`, the other three with no shadow
* [x] Restyle the four summary tiles with their semantic top edges — measured teal / butter / coral / mint, figure 24px desktop and 19px mobile, padding `18px 20px`
* [x] Restyle the net-position banner with the `equals` "computed" marker — `#DCF3EE` fill, 28px figure, marker `#1D7A6C` and `aria-hidden`; foreground is `content.onTint`, not ink (GROUP-34 section 3.2)
* [x] Restyle the spending breakdown with category swatches — 20px `CategorySwatch` per row; `DashboardCategorySpending` now carries `icon`, unresolved, so the one resolver stays the only one
* [x] Restyle the account, owes-you, you-owe, recent-activity and settlement cards — `AccountSwatch`, directional `Avatar`, `CardActionLink` on every header; **card debt now reads coral, as drawn** (GROUP-34 section 3.3)
* [x] Restyle the empty dashboard — captured at both widths; the quick-action row is correctly absent on a phone there too
* [x] Verify against all four dashboard designs — full-page captures at 1440×900 and 393×860 in both modes
* [x] Verify nothing implies a cached total (9.1) — scanned the rendered text for "live", "cached", "refresh", "last updated", "syncing", "stale": **zero matches** in both modes at both widths
* [x] **Added `StatusBadge kind="overLimit"`** rather than relabelling `partSettled`, which would have made an account condition read as a settlement state (GROUP-34 section 3.4)
* [x] **Fixed the recent-activity card**: it was wrapped in a `CardBody`, which inset its rows and left a blank band under the header rule (GROUP-34 section 3.6)

## 35. Activity And Transaction Detail

* [x] Restyle the date-grouped list with type swatches — one bordered card per day with the date above it; swatch measured 26px, outlined not filled, carrying the category's own glyph
* [x] Add the type and settlement `StatusBadge`s — a plain personal expense stays **unbadged**, a split carries both (GROUP-35 section 3.2)
* [x] Add reference codes to rows — landed in group 32; measured here as reference-before-amount with the drawn 14px gap
* [x] Keep the "₹1,600.00 of ₹4,800.00" share-of-total treatment (9.1)
* [x] Restyle search, the search button and the dashed filter-active marker — Search uses a **new `tone="contrast"`** (ink fill, inverted label, no shadow); the active chip measured 1.5px dashed `#1D7A6C` with the 8px diamond
* [x] Make an active filter legible without opening the panel — the closed toggle reads `Filters · N active`; inactive it is an ordinary button, because a dashed chip reading "0 active" would be an alarm about nothing
* [x] Restyle the end-of-list mono notice — centred, tracked, uppercase, `content.subtle`
* [x] Restyle the personal, shared, transfer and card-payment detail pages — the same badges the rows carry, `Avatar` participant rows, and the "not spending" note moved into a tinted `ExplainerNote`
* [x] Keep the three amounts distinct on a shared expense — full bill, own share, and each participant's share; "Your share" only renders when it differs
* [x] Restyle the in-app and global not-found pages — rebuilt on `EmptyState` with a new optional status `eyebrow`; the global page keeps its own `main#main`
* [x] **Fixed the crushed-title bug in a second place**: at 393px a `StatusBadge` cannot shrink, so it reduced the description to `C…` over `HD…`, and the truncating meta line then overflowed under the reference code (GROUP-35 section 3.6)

## 36. Transaction Forms

* [x] Restyle the add-expense form card and its side rail (8) — new `FormLayout`; measured 733/523px (1.40 ratio), gap 24px, card `6px 6px 0` with `36px 40px` padding, tint panel `#DCF3EE` at 22px
* [x] Restyle the mobile stacked layout — rail **below** the form, by source order rather than an `order` property, so the keyboard sequence matches (GROUP-36 section 3.1)
* [x] Restyle the split form and the split editor, keeping the running allocated total — now stated **against** the amount: `Allocated ₹3,200.00 of ₹4,800.00`, with a tick when they match (GROUP-36 section 3.5)
* [x] Restyle the transfer form (not drawn — 10) — same shell and rail as add-expense
* [x] Restyle the card-payment form, including the "Pay full balance" shortcut (not drawn) — now a `secondary` button, and **not offered on a card at zero**, which previously read "Pay full balance (₹0.00)" (GROUP-36 section 3.8)
* [x] Restyle the edit-expense state — no switcher and no tint panel, but it keeps the reference box, which says the code survives the edit
* [x] Restyle the four prerequisite guards as warning `Alert`s — each renders **instead of** the form, verified with no `<form>` in the document
* [x] Restyle every validation-error state — `negative` borders and mono messages, from `Field`
* [x] Verify Cancel is reachable on all of them — measured on all four at 1440px and 393px: same row as the submit, inside the card, non-zero width
* [x] **Consolidated group 35's `ExplainerNote` into `TintPanel`** — one tint panel with an optional eyebrow, not two that can drift (GROUP-36 section 3.4)

## 37. Accounts Screens

* [x] Restyle the list, totals card and account swatches — totals are now the dashboard's four `SummaryTile`s with semantic edges; eyebrow group headings; 32px `AccountSwatch` per row measured teal / mint / coral
* [x] Restyle the bank and credit-card detail pages — swatch and archived badge in the header meta slot, a whole-row activity link, `DetailList` position card
* [x] Restyle the create and edit forms, including the card-details fieldset — `FormLayout` + rail; the fieldset is an inset block on `surface.sunken` with a mono `<legend>`, still a real `fieldset`/`legend` pair
* [x] Restyle the archive control and the archived-account alert — the inline confirmation is an inset block (no modal, 9.1); new `StatusBadge kind="archived"`, the one badge with its own foreground (GROUP-37 section 3.2)
* [x] Restyle the empty state
* [x] Restyle the over-limit alert — measured coral, and "Over limit ·" stays in words on the row beside the colour
* [x] **Fixed a caption that contradicted its figure**: available credit goes negative over the limit, and the hint read "Still usable" (GROUP-37 section 3.6)

## 38. People And Settlements Screens

* [x] Restyle the people list with avatars and `DirectionAmount` — `Circle` replaced with the square `Avatar` (5.1); two `SummaryTile`s replace the totals list; the archived badge stacks below the name on a phone
* [x] Restyle all three person-detail states — owes you, you owe, settled — avatar in the header meta slot, both gross figures rather than one net number, "Settle up" promoted into the header
* [x] Restyle the person create and edit forms — `FormLayout` + rail
* [x] Restyle settle-up to `SettleUp-Light.html`, including the `BALANCED` stamp — column measured at exactly 820px; stamp measured `2px dashed rgb(46,138,97)` at `rotate(-7deg)` and `aria-hidden`, beside the figure that proves it (GROUP-38 section 3.1)
* [x] Restyle the unbalanced state — `Alert`, not a stamp (5.4) — verified: stamp absent, butter alert present, submit disabled
* [x] Restyle the settlements list and detail — reference codes landed in group 32; `SettlementSummaryView.referenceCode` added here for the person page's history rows, closing group 32's last gap
* [x] Restyle the archive control and its outstanding-balance guard — inline inset block; the guard **warns**, it does not block, because archiving is reversible and keeps the balance
* [x] Verify direction is in words everywhere — checked on the list row, the person header badge, every obligation row, the settle-up sentence, the settlement-history rows and the settlements list
* [x] **Confirmed group 35's both-badges activity row in a browser** for the first time: `["Split", "Split", "Settled", "Settled"]`

## 39. Categories Screen

* [x] Restyle the tree with swatches and the one-level indent — one 24px step is the whole hierarchy, and a child gets the smaller swatch as a second signal
* [x] Restyle the inline add and edit forms — no modal (9.1) — verified: `role="dialog"` absent, the row becomes an inset block on `surface.sunken`
* [x] Add the icon picker, if group 21 chose one — a real `role="radiogroup"` with 18 curated 44px tiles writing a registry name into the existing `icon` field; **no colour input**, because the colour is derived from the id (GROUP-39 sections 3.1–3.3)
* [x] Wire the icon and colour resolver (6.4) — `CategorySwatch` on every row, from the one resolver
* [x] Restyle the archived badge and the archive/restore controls — `StatusBadge kind="archived"`, measured `content.subtle`
* [x] Verify the nine seeded defaults all render an icon — **9 swatches, 9 distinct glyphs.** They resolved correctly already via group 25's aliases; `DEFAULT_CATEGORIES` now holds registry names directly as a cleanup, with a test pinning it (GROUP-39 section 3.7)
* [x] Verify a null-icon category renders the fallback — created one with no icon chosen; the swatch renders with `ellipsis`
* [x] **Fixed the picker's tile geometry**: `SimpleGrid` stretched each tile to its column (measured 130×44), so square swatches rendered as wide rectangles (GROUP-39 section 3.5)

## 40. Accessibility And Contrast Audit

The group most likely to be skipped and most likely to be needed.

* [x] Measure every text/background pair against WCAG AA at its real size and weight — 30 pairs × 2 modes, asserted every run in `src/theme/contrast.test.ts`. Three more failures found and darkened: `tealText`, `coralText`, `mintText`
* [x] Get a darker `content.subtle` from the designer — measured at 3.5:1, fails AA (9.3) — done in group 21 (`inkTertiary #6A6682`), now locked by a test
* [x] Get a darker `content.quiet` — measured at 2.5:1, fails AA and AA-large (9.3) — done in group 21 (`inkQuiet #706C88`), now locked by a test
* [x] Measure ink on all five swatch fills in dark mode (light mode is clear) — 7.10:1 (teal) to 11.06:1 (butter); all five asserted
* [x] Verify a visible focus state on every interactive element, including ghost buttons — 0 exceptions across 8 routes × 2 modes. Found the icon picker had none at all, and that the "missing" button ring was a transition-measurement artefact
* [x] Verify no information is carried by colour alone — the only tone-coloured figure is `DirectionAmount`, whose words label is a required prop
* [x] Verify every rotated stamp is accompanied by plain text — `Stamp` is `aria-hidden` by default; its one call site sits beside the figure that proves it
* [x] Verify touch targets meet `sizes.touch` — form controls were 40px; the skip link 41px; a settlements link 21px. All now ≥44, desktop and 393px
* [x] Verify every icon-only control has an accessible name — 0 exceptions
* [x] Keyboard-walk every screen, including the quick-add menu — Enter opens, focus lands on the thumb-nearest action, Tab cycles 5 stops inside the layer, Escape restores focus
* [ ] Screen-reader pass over the money components and the split and settle-up editors — **not done, needs a real screen reader**; recorded in section 6 of the update
* [x] Repeat the whole pass in dark mode — every check above ran in both modes. Two of the three worst defects were dark-mode only
* [x] Record what could not be automatically verified and needs manual assistive-technology testing — eight items, including forced-colors mode, which is the biggest open risk

## 41. Verification And Handoff Refresh

* [x] `npm run verify` passes — typecheck, eslint, 677 unit tests
* [x] `npm run test:all` passes — 66 files, 1,690 tests
* [ ] `npm run test:e2e` passes — **25 of 27**. The two failures are one pre-existing auth defect: sign-out leaves `authjs.session-token` alive because NextAuth re-issues the cookie on RSC prefetches racing the response. Diagnosed with evidence in GROUP-41-VERIFICATION.md section 3.1; needs its own task. The suite did find one real restyle regression — `EmptyState`'s title had stopped being a heading — now fixed
* [x] `npm run build` succeeds — 35 routes
* [x] Re-run `npm run screenshots` and diff every screen against `design/ux/screens/` — all eleven artboards compared; every divergence already recorded as a decision
* [x] Add dark-mode captures to the screenshot script, if dark shipped — two new profiles, 18 screens each, chosen so every semantic colour is rendered at least once
* [x] Update `design/screenshots/README.md` — the two "layout defects" entries are gone, replaced by the measurements that show them fixed
* [x] Confirm both bugs in 9.2 are fixed, with evidence — Cancel measured inside the card at both widths; the mobile title measured at 26px on one line
* [x] Send the refreshed captures back to the designer for sign-off — 143 PNGs, plus a new "what needs your sign-off" section listing every deviation and every undrawn screen
* [x] List every screen that was built without a design and needs review — section 6 of the refreshed screenshots README, ordered by how far it is from anything drawn

---

# 2. Recommended order

```text
21  decisions              blocks everything
22  typography             independent
23  tokens                 needs 22 for the font tokens
24  dark mode              needs 23
25  icons                  needs 23 for swatch colours
26  form primitives    ─┐
27  buttons             │  need 23 + 25, can run in parallel
28  surfaces            │
29  money components   ─┘
30  shell                  needs 25-29
31  quick-add              needs 30
32  reference codes        independent of the restyle; needed by 34, 35, 38
33  auth               ─┐
34  dashboard           │
35  activity            │  screen application, parallelisable
36  transaction forms   │
37  accounts            │
38  people/settlements  │
39  categories         ─┘
40  accessibility          needs every screen
41  verification           last
```

Groups 26 to 29 are the ones to get right. Every screen group afterwards is an application of
them, and a compromise made in a primitive is a compromise repeated forty times.

---

# 3. Definition of done

## Completing a group

Same bar as `docs/13-MVP-TASK-GROUP.md`:

```text
Every checkbox in the group is ticked
tsc --noEmit passes
eslint passes
The unit and integration suites pass
next build succeeds
```

Plus, for this series specifically:

```text
The screens the group touched have been compared against design/ux/screens/
by opening both side by side — not from memory
Any divergence from the handoff is recorded, with the reason
No component references a raw token directly
No new rounded corner, soft shadow, or non-mono numeral has been introduced
```

## Required: write an update document

**Every task group must be documented in `docs/design-tasks/updates/` before it is considered
complete.** One file per group:

```text
docs/design-tasks/updates/GROUP-<number>-<SHORT-NAME>.md

docs/design-tasks/updates/GROUP-21-DESIGN-DECISIONS.md
docs/design-tasks/updates/GROUP-23-DESIGN-TOKENS.md
docs/design-tasks/updates/GROUP-25-ICON-SYSTEM.md
```

Write it for a developer who did not do the work and needs to extend, review or debug it.
Cover the same seven headings as the MVP series:

```text
1. What was built            plain-language summary of the capability delivered
2. Files added or changed    grouped by layer, with the purpose of each
3. Key decisions             what was chosen, what was rejected, and why
4. Business rules enforced   the financial rules this group is responsible for
5. How it was verified       commands run, tests added, what they prove
6. Known gaps                what is deliberately deferred, and to which group
7. Notes for the next group  anything the following group needs to know
```

For a visual series, two of those carry extra weight:

- **Key decisions** — where the handoff was ambiguous, what was chosen, and what the designer
  said if they were asked. Six months from now the hex value is in the code; the reason it is
  that hex value is not.
- **Known gaps** — which screens in the coverage matrix (10) were built without a design and
  still need review. Silence reads as approved.

`docs/design-tasks/updates/README.md` holds the index. Add a row for each group as it
completes.
