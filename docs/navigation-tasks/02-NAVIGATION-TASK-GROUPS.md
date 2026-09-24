# Navigation Task Groups 42-48

The work. Seven groups, 99 checkboxes, that give every screen in the app a named way back.

The findings live in [`01-NAVIGATION-AUDIT.md`](01-NAVIGATION-AUDIT.md) — the route-by-route
audit, the four defect classes, the proposed contracts. **Bracketed numbers below are section
numbers in that file**, so `(7.3)` means section 7.3 of `01-NAVIGATION-AUDIT.md`. Where a rule
comes from the visual language instead, the citation says so by name.

Conventions match `docs/13-MVP-TASK-GROUP.md` and `docs/design-tasks/02-DESIGN-TASK-GROUPS.md`:
tick each box as the work lands, not in a batch at the end, and write an update document per
group before calling it done (section 3).

## Numbering

Groups 1-20 are the MVP (`docs/13-MVP-TASK-GROUP.md`). Groups 21-41 are the "Ledger Geometry"
restyle (`docs/design-tasks/02-DESIGN-TASK-GROUPS.md`). This series continues from **42** so a
group number is unambiguous across the whole project. Update documents for **this** series go in
`docs/navigation-tasks/updates/`, not `docs/updates/` and not `docs/design-tasks/updates/`.

## Scope

In scope: on-screen wayfinding — a way up, a way out of a form, a way out of a guard, and links
to the records a page names.

Out of scope, and deliberately so:

- A desktop sidebar. `docs/04-USER-FLOWS.md` section 2 asks for one; there is nothing to put in
  it until Reports and Settings exist, and adding one is a layout change, not a wayfinding fix.
- Settings and Reports screens. Their absence is a known gap, recorded in
  `design/screenshots/README.md` section 5.
- `loading.tsx` route-level pending states. Noted in the audit (3) because it surfaced while
  enumerating routes; it is a different piece of work.
- Any change to `NAV_ITEMS` beyond the `/settlements` decision in group 42.

---

# 1. The groups

## 42. Navigation Decisions And Sign-off

Nothing else starts until these are answered. Each one changes the shape of the work.

* [x] Decide back link, breadcrumb, or both (7.1) — recommendation is back link only, written so a breadcrumb can wrap it later
* [x] Decide whether `/settlements` joins `NAV_ITEMS` (7.1) — recommendation is no, and fix reachability instead
* [x] If a sixth tab is chosen, measure `BottomNav` at 402px **before** committing to it — **not applicable**: no sixth tab, and the estimated ~17% label-width cost is what decided it (GROUP-42 section 3.2)
* [x] Confirm the back link's visual register — `CardActionLink`'s mono uppercase eyebrow, or something new
* [x] Confirm the wording convention: "Accounts", "Back to accounts", or "← Accounts"
* [x] Confirm the accessible name convention, which must name the destination (8.1)
* [x] Check whether `chevron-left` exists in `src/components/icons/registry.tsx`; schedule it if not (7.2)
* [x] Decide whether Cancel pushes to the parent unconditionally, or keeps `router.back()` when history exists (7.4) — recommendation is unconditional push
* [x] Decide whether a guard screen gets the parent back link as well as its action (7.5)
* [x] Decide whether `Alert` gains an `action` prop or the guards nest theirs in `children` (7.5)
* [x] Audit `ExpenseDetailView`, `TransferDetailView` and `CardPaymentDetailView` for `accountId` / `categoryId`, and cost 7.6 from what is actually there
* [x] Decide whether the two unphotographed dead-end states join `EXPECTED_SHOTS` (9) — there is **one**, not two; the audit was wrong and has been corrected. `55-expense-edit-settled` added (GROUP-42 section 3.11)
* [x] Record every answer in `docs/navigation-tasks/updates/GROUP-42-NAVIGATION-DECISIONS.md`

## 43. The Back Link Primitive

The one component every other group in this series consumes. Get it right here and the
remaining groups are applications of it.

* [x] Add `chevron-left` to the icon registry if group 42 found it missing
* [x] Create `src/components/layout/BackLink.tsx` with the contract in 7.2 — `href` and `label`, both required
* [x] Render a real `next/link` anchor via `asChild`, so it middle-clicks and opens in a new tab (8)
* [x] **No `router.back()` inside it.** It is a hierarchy link; that is the entire point (4.3)
* [x] Apply the register group 42 confirmed — mono uppercase eyebrow, `brand.fg`, underline on hover and focus
* [x] Add `minH="touch"` and `_focusVisible={{ boxShadow: "hardFocus" }}`, matching the other link primitives
* [x] Give it an accessible name that names the destination (8.1)
* [x] Unit-test that it renders an `<a>` with the given `href`, not a button
* [x] Unit-test the accessible name
* [x] Verify it references no raw token directly

## 44. `PageHeader` Learns About Parents

One component change that reaches twenty screens. The riskiest group in the series, because
`PageHeader` carries a bug fix that must not regress.

* [x] Add the optional `parent?: { href: string; label: string }` prop (7.3)
* [x] Render `BackLink` **above** the title row, inside the same `as="header"` element
* [x] Keep it ahead of the `h1` in reading order (8.1)
* [x] Wrap in a `Stack` above the existing `Flex` — do **not** add it into the title row
* [x] Keep the 22px/28px bottom margin on the outermost element so page rhythm is unchanged
* [x] Keep `parent` optional: the 5 nav destinations and 2 boundary screens have no parent (7.3)
* [x] **Measure at 393px that the title still renders on one line** — the crushed-title fix is load-bearing (`docs/design-tasks/01-DESIGN-SYSTEM.md` 9.2)
* [x] Verify `meta` and `action` still behave at both widths, with and without `parent`
* [x] Verify the existing `PageHeader` tests pass unchanged — **three of four did; one selector changed deliberately.** It read `container.firstElementChild`, which is now the new wrapper and column at every width, so it would have passed while asserting nothing (GROUP-44 section 3.3)
* [x] Add a test for the parent row: present when passed, absent when not
* [x] Record the before/after measurements in the update document

## 45. Detail Pages Get A Way Up

Closes `NO-WAY-UP` on the four detail routes (5.5). No new components — group 43 and 44 did
that work.

* [x] `/accounts/[id]` — `parent` → `/accounts`
* [x] `/people/[id]` — `parent` → `/people`
* [x] `ExpenseDetail` — `parent` → `/transactions`
* [x] `TransferDetail` — `parent` → `/transactions`
* [x] `CardPaymentDetail` — `parent` → `/transactions`
* [x] `/settlements/[id]` — `parent` → `/settlements`. **This one closes a dead end** (6.1)
* [x] Verify each label matches the nav item's own wording, so "up" and the tab bar agree
* [x] Confirm the archived/status badges in `meta` still sit correctly with a parent row above
* [x] Open each of the six URLs cold, with no history, and confirm the upward path works

## 46. Edit And Action Forms Get A Way Up And A Way Out

Closes `NO-WAY-UP` and `HISTORY-ONLY` on the ten form routes (5.4, 5.6). The `parent` of an edit
form is the **record**, not the section list.

* [x] `/accounts/new` — `parent` → `/accounts`; Cancel pushes there
* [x] `/people/new` — `parent` → `/people`; Cancel pushes there
* [x] `/transactions/new` — `parent` → `/transactions`; Cancel pushes there
* [x] `/transactions/new/shared` — same
* [x] `/transactions/new/transfer` — same
* [x] `/transactions/new/card-payment` — same
* [x] `/accounts/[id]/edit` — `parent` → `/accounts/[id]`; Cancel pushes there
* [x] `/people/[id]/edit` — `parent` → `/people/[id]`; Cancel pushes there
* [x] `/people/[id]/settle` — `parent` → `/people/[id]`; Cancel pushes there
* [x] `/transactions/[id]/edit` — `parent` → `/transactions/[id]`; Cancel pushes there
* [x] Replace `router.back()` in all eight `onCancel` handlers with a push to the parent (7.4)
* [x] **Do not touch `FormActions`' geometry.** Only what `onCancel` does changes (8)
* [x] Verify the clipped-Cancel measurements still hold at 393px and 1440px
* [x] Verify the `FormSwitcher` lateral links still work alongside the new parent row
* [x] **Open each form URL cold and cancel.** This is the assertion that proves the fix (9, point 3)
* [x] Verify cancelling a form opened from the quick-add FAB no longer returns to an unrelated screen

## 47. The Dead Ends And The Guards

The three screens a user cannot leave (6), and the five guards that tell a user to go somewhere
without saying where (5.7). Highest user impact in the series.

### The guards

* [x] `ExpenseForm` "Add an account first" — action → `/accounts/new`
* [x] `SharedExpenseForm` "Add someone first" — action → `/people/new`
* [x] `SharedExpenseForm` "Add an account first" — action → `/accounts/new`
* [x] `TransferForm` "Add another account first" — action → `/accounts/new`
* [x] `CardPaymentForm` "Add the accounts first" — action → `/accounts/new`
* [x] Apply the guard-screen back link, if group 42 decided in favour (7.5)
* [x] Verify a guard screen has a way off it even though `FormActions` never renders there

### The "Cannot edit" state — the worst screen in the app (6.3)

* [x] Link the expense the alert names → `/transactions/[id]`
* [x] Link the settlement the alert tells the user to remove → `/settlements/[id]`, or to the person's settlement history if the id is not in scope
* [x] Give the screen a `parent` → `/transactions/[id]`
* [x] Verify the alert's prose and its links say the same thing

### Shared expense detail (6.2)

* [x] Make "Split between" participant rows link to `/people/[id]`
* [x] Confirm a shared expense now has at least one way off the page besides the tab bar
* [x] Keep the three amounts visibly distinct — linking a row must not change what it reads (`docs/design-tasks/01-DESIGN-SYSTEM.md` 9.1)

### `/settlements` reachability (5.3, 6.1)

* [x] Apply group 42's decision — add to `NAV_ITEMS`, or add a permanent entry point on `/people`
* [x] If the nav gained a sixth tab, re-measure `BottomNav` at 402px and record it — **not applicable**: `NAV_ITEMS` is unchanged, so `BottomNav` was not touched
* [x] Verify `isActiveNavItem` highlights the right section for `/settlements/[id]`
* [x] Make settlement history rows on `/people/[id]` link to `/settlements/[id]` (5.5)

### Records that are named but not linked (7.6)

Scope confirmed by group 42's view-model audit. If an id is missing from a view model, that is
a task here, not a reason to skip the row.

* [x] `ExpenseDetail` — Account row → `/accounts/[id]`
* [x] `ExpenseDetail` — Category row → `/transactions?categoryId=[id]`
* [x] `TransferDetail` — From and To rows → `/accounts/[id]`
* [x] `CardPaymentDetail` — "Paid from" and "Card" rows → `/accounts/[id]`
* [x] `SettlementDetail` — Account row → `/accounts/[id]`
* [x] Add any missing id to the view models rather than reaching for a document in a component
* [x] Verify a linked `DetailRow` still right-aligns and truncates as it did

## 48. Verification And Recapture

Last. A navigation defect compiles, renders and passes most tests, so this group is the one that
proves the work.

* [x] Walk every screen in the 5.9 tally and confirm each non-OK row now has a named upward path
* [x] Assert the upward path is an anchor with an `href` — in a test, not in a browser (9, point 2)
* [x] E2E: open each of the eight form URLs cold, cancel, assert the landing route (9, point 3)
* [x] E2E: reach each of the three dead ends in section 6 and leave it by an on-screen link
* [x] E2E: hit all five guard screens and follow the action to the creation form
* [x] Measure the mobile page title at 393px on a screen with a parent row — one line (9, point 6)
* [x] Re-measure the `FormActions` row at 393px and 1440px; Cancel fully inside the card
* [x] Keyboard pass: tab order reaches the parent link before the `h1`'s content, focus is visible everywhere
* [x] Screen-reader pass: every back link's name states its destination (8.1)
* [x] Add the two unphotographed dead-end states to `EXPECTED_SHOTS` if group 42 decided to (9) — **one** state, `55-expense-edit-settled`; the other two in section 6 were already captured
* [x] `npm run screenshots` — full recapture, all four profiles
* [x] Review the new set for the parent row at both widths and in both themes
* [x] Update `design/screenshots/README.md` section 5: the navigation gaps it lists are now fixed or changed (9, point 8)
* [x] Update the section 4 flow graph in that README if any route's reachability changed
* [x] Confirm `tsc --noEmit`, `eslint`, the unit and integration suites, and `next build` all pass — all clean; 1,711 tests. Two **pre-existing flaky e2e specs** are documented in GROUP-48 section 3.2, neither in the navigation suite

---

# 2. Recommended order

```text
42  decisions              blocks everything
43  BackLink primitive     needs 42
44  PageHeader parent      needs 43
45  detail pages        ─┐
46  forms                │  need 44, can run in parallel
47  dead ends + guards  ─┘  largest; overlaps 45 and 46 on a few files
48  verification           last
```

Groups 43 and 44 are the ones to get right. Groups 45 to 47 are applications of them across
twenty pages, and a compromise made in the primitive is a compromise repeated twenty
times — the same argument `docs/design-tasks/02-DESIGN-TASK-GROUPS.md` makes about its form
primitives.

Groups 45, 46 and 47 touch overlapping files. `ExpenseDetail` gets a `parent` in 45 and linked
`DetailRow`s in 47; `/transactions/[id]/edit` gets a `parent` in 46 and its "Cannot edit" branch
fixed in 47. Run them in parallel if you like, but not on the same branch without coordinating
those three files.

## If only one group ships

Group 47. It closes the three screens a user cannot leave and the five guards that block a new
user's first action. Groups 45 and 46 remove friction; 47 removes walls.

---

# 3. Definition of done

## Completing a group

Same bar as the two preceding series:

```text
Every checkbox in the group is ticked
tsc --noEmit passes
eslint passes
The unit and integration suites pass
next build succeeds
```

Plus, for this series specifically:

```text
Every screen the group touched was opened at a COLD URL — no history — and left by
  an on-screen link
The mobile page title still renders on one line at 393px, measured
The FormActions row still fits its card at 393px and 1440px, measured
No modal, dialog or overlay was introduced
Every new navigation element is a real anchor with an href
No component references a raw token directly
```

The cold-URL clause is the one that matters. Clicking into a screen and clicking back out will
pass on a broken build, because `router.back()` works when there is history. That is the whole
defect.

## Required: write an update document

**Every task group must be documented in `docs/navigation-tasks/updates/` before it is
considered complete.** One file per group:

```text
docs/navigation-tasks/updates/GROUP-<number>-<SHORT-NAME>.md

docs/navigation-tasks/updates/GROUP-42-NAVIGATION-DECISIONS.md
docs/navigation-tasks/updates/GROUP-43-BACK-LINK-PRIMITIVE.md
docs/navigation-tasks/updates/GROUP-47-DEAD-ENDS-AND-GUARDS.md
```

Write it for a developer who did not do the work and needs to extend, review or debug it. Cover
the same seven headings as the MVP and design series:

```text
1. What was built            plain-language summary of the capability delivered
2. Files added or changed    grouped by layer, with the purpose of each
3. Key decisions             what was chosen, what was rejected, and why
4. Business rules enforced   the financial rules this group is responsible for
5. How it was verified       commands run, tests added, what they prove
6. Known gaps                what is deliberately deferred, and to which group
7. Notes for the next group  anything the following group needs to know
```

For a navigation series, three of those carry extra weight:

- **How it was verified** — which URLs were opened cold, and what the landing route was. A
  screenshot of a working back button proves nothing about the case that was broken.
- **Key decisions** — the wording of every label, and why. "Accounts" versus "Back to accounts"
  is the kind of choice that drifts across twenty pages if it is not written down once.
- **Known gaps** — any screen left without an upward path, and the reason. Silence reads as
  approved, and this series is specifically about screens nobody noticed.

`docs/navigation-tasks/updates/README.md` holds the index. Add a row for each group as it
completes.
