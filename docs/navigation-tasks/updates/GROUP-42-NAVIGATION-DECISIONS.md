# Group 42 — Navigation Decisions And Sign-off

The twelve questions `01-NAVIGATION-AUDIT.md` left open, answered. Nothing in groups 43-48 is
decided again; where one of those groups needed a judgement call it is recorded here and cited
by section number.

Read this one even if you are only touching a single screen. The answers below constrain
everything after them.

---

## 1. What was built

Nothing. This group is decisions only, plus the two investigations that had to happen before the
work could be costed:

- **The view-model audit** (3.9). The result changed the shape of group 47: every id needed to
  turn a named record into a link is *already* on the view models. What looked like the most
  expensive task in the series turned out to need no data-layer change at all.
- **The blocking-settlement investigation** (3.10). The one place an id is genuinely missing,
  and how it is obtained without touching a repository.

---

## 2. Files added or changed

| File | Change |
| --- | --- |
| `docs/navigation-tasks/updates/GROUP-42-NAVIGATION-DECISIONS.md` | This document |
| `docs/navigation-tasks/updates/README.md` | Index created |

No source files. That is the point of a decisions group.

---

## 3. Key decisions

### 3.1 Back link only, no breadcrumb — audit 7.1, option A

**Decided: a single back link on every screen that has a parent. No breadcrumb anywhere.**

The app is three levels deep at its worst (`/accounts/[id]/edit`). A breadcrumb earns its
complexity in a deep tree where a user genuinely needs to choose which ancestor to return to;
here the choice is between "the record" and "the list", and the record's own page links to the
list. Two taps, both obvious.

Three further reasons, in order of weight:

1. **There is no breadcrumb in the handoff.** Nothing in `design/ux/screens/` draws one. Adding
   one means inventing a visual pattern, which
   `docs/design-tasks/01-DESIGN-SYSTEM.md` section 10 is explicit should be a question for the
   designer rather than a decision made in code.
2. **A breadcrumb at 402px truncates**, and a truncated breadcrumb is decoration. Three segments
   plus a record name ("Accounts / HDFC Savings / Edit") does not fit, and the fix would be
   ellipsing the middle — which removes the only segment a back link would have used.
3. **The reversal is cheap in one direction only.** Wrapping `BackLink` in a breadcrumb later is
   a change to one component's internals. Adding a back link later is a change to twenty pages.

Rejected: option B (breadcrumb only) for the reasons above; option C (both, breadcrumb at level
3 only) because a rule of the form "this appears on some screens and not others" is the kind of
inconsistency that decays, and nobody would remember which side of the line a new screen fell on.

### 3.2 `/settlements` stays out of the tab bar — audit 7.1, option B

**Decided: `NAV_ITEMS` keeps its five entries. Reachability is fixed with links instead.**

A sixth tab means six icon-over-label stacks in `BottomNav`'s 64px row at 402px. "Settlements"
is the longest label in the set — two characters longer than "Categories" — and the row uses
`justify="space-around"` with `flex: 1` per tab, so a sixth entry takes roughly 17% off every
label's width. That is the crushed-label failure the restyle closed twice already
(`docs/design-tasks/01-DESIGN-SYSTEM.md` section 9.2), and reopening it to solve a *linking*
problem is the wrong trade.

What fixes it instead, both in group 47:

- `/settlements/[id]` gets a back link to `/settlements`, so the detail page is no longer a
  dead end.
- `/people` gets a permanent entry point to `/settlements`, so the list is reachable from a tab
  bar destination rather than only from a dashboard card. `/settlements` already links *to*
  `/people` ("Settle up with someone"); this closes the loop.

The second one matters more than it looks. It means `/settlements` is two taps from anywhere —
People, then the settlements link — which is what "in the navigation" actually buys, without
the layout cost.

Rejected: option C (fold settlements into Activity as a filter). Settlements are not
transactions; they have their own collection, their own view models and their own list query.
Presenting them as a transaction filter would be a lie about the data model, and
`docs/02-DATA-MODEL.md` keeps them apart deliberately.

**Because the tab bar is unchanged, `BottomNav` was not re-measured.** The group 47 checkbox
asking for a 402px re-measurement is therefore ticked as not-applicable, with this paragraph as
the reason.

### 3.3 The back link's visual register

**Decided: `CardActionLink`'s treatment — mono, uppercase, tracked, `brand.fg`, no underline at
rest, underline on hover and focus.**

The reasoning in `AppLink.tsx` for `CardActionLink` applies unchanged: a bordered button in this
position would compete with the page header's own primary action ("Edit", "Settle up", "Pay
card"), while the eyebrow treatment reads as a quiet way onward. It is also already in the app,
so this adds no new visual idea — which is the bar section 10 of the design system sets.

`BackLink` does **not** reuse the `CardActionLink` component, though. It needs a leading icon and
its own accessible-name rule, and threading both through `CardActionLink` would make that
component's contract worse for its eight existing callers. It reuses the *register*, not the
code — the shared value is `textStyle="eyebrow"`, which is a token.

### 3.4 Wording: the label is the destination, the accessible name says "Back to"

**Decided:**

```text
visible          [‹] ACCOUNTS
accessible name  "Back to Accounts"
```

`label` is the destination's own name, matching the nav item's wording exactly so the back link
and the tab bar cannot describe the same place differently. The `aria-label` prefixes it.

Why both rather than one:

- Visible "← Accounts" is the conventional, compact form and does not spend a phone's header
  width on the word "Back".
- An accessible name of just "Accounts" is useless in a screen reader's link list, where a user
  hears a flat list of names with no spatial context. "Back to Accounts" stands on its own.
- WCAG 2.5.3 *Label in Name* is satisfied: the visible string "Accounts" is contained in the
  accessible name "Back to Accounts", so a speech-input user saying "click Accounts" still
  activates it. Reversing this — visible "Back", name "Accounts" — would fail it.

For a record parent the label is the record's name, so an edit form reads `[‹] HDFC SAVINGS` and
announces "Back to HDFC Savings".

### 3.5 `chevron-left` — confirmed missing, being added

`src/components/icons/names.ts` holds 43 glyphs: `chevron-down` (line 43, `HANDOFF_GLYPHS`) and
`chevron-right` (line 84, `IN_HOUSE_GLYPHS`). There is no left-facing chevron.

**Decided: add `chevron-left` to `IN_HOUSE_GLYPHS`**, drawn as `chevron-right` mirrored —
`M10 3L5 8L10 13` against that glyph's `M6 3L11 8L6 13` — at the same `stroke: 2` and in the same
16-unit box.

Rejected: reusing `arrow-out` or rotating an existing glyph with CSS. The registry's rule is one
glyph per meaning with the geometry in the path data, specifically so a contact sheet of the set
can be read (`registry.tsx` header). A CSS-rotated chevron also rotates its stroke caps, which is
visible at 14px.

Note the compiler enforces the pair: `ICONS` is typed `Record<IconName, IconGlyph>`, so a name
without a drawing and a drawing without a name are both build errors. The addition is two edits,
not one.

### 3.6 Cancel pushes to the parent, unconditionally — audit 7.4

**Decided: every `onCancel` becomes `router.push(parentHref)`. No history check.**

The tempting hybrid — `window.history.length > 1 ? router.back() : router.push(parent)` — is
rejected for two reasons:

1. **It is not a reliable signal.** `history.length` counts the whole tab's session, including
   entries from before the user reached this app. It is non-zero on a fresh tab that navigated
   once, and it says nothing about *where* `back()` will land.
2. **It reintroduces the defect.** The finding in audit 4.3 is that Cancel's destination is
   unpredictable. A conditional makes it unpredictable *and* conditional, which is harder to
   test and harder to explain.

The cost is real and worth naming: `back()` restores scroll position and preserves a filtered
list URL, and a push does not. So cancelling out of an edit form reached from
`/transactions?accountId=abc` now lands on `/transactions/[id]`, the record — not back at the
filtered list. That is the correct hierarchical answer, and the record page links onward to the
list. Accepted deliberately; revisit only if a user reports it.

### 3.7 `Alert` gains an `action` prop — audit 7.5

**Decided: add `action?: ReactNode` to `Alert`, rendered below the description inside the text
stack.**

`Alert`'s props today are `tone`, `title` and `children`. The alternative was nesting each
guard's action inside `children`, which was rejected because five guards would each lay their
action out slightly differently — and the whole reason `FormActions` exists is that eight forms
independently laying out the same row is how a defect ships eight times.

An `action` slot also matches how `CardHeader`, `PageHeader` and `EmptyState` already separate
prose from action, so it is the shape a reader of this codebase expects.

It is optional, so all existing `Alert` callers are unaffected.

### 3.8 Guard screens get the parent back link as well as their action

**Decided: yes.**

A guard replaces the entire form, so `FormActions` never renders and there is no Cancel on the
page (audit 5.7). Without a back link the action is the *only* thing that moves — and it moves
the user **deeper**, to `/accounts/new`. A user who opened the expense form by mistake would have
no way out but the tab bar.

The parent is the same one the form itself uses (`/transactions`), because the guard is a state
of that route, not a different place.

### 3.9 The view-model audit — no data-layer change needed

The investigation audit 7.6 asked for, with the result. **Every id is already there.**

| Consumer | Field needed | Present on | Verdict |
| --- | --- | --- | --- |
| `ExpenseDetail` account row | `accountId` | `TransactionListItem:68` | already there |
| `ExpenseDetail` category row | `categoryId` | `TransactionListItem:72` | already there |
| `TransferDetail` from/to rows | `fromAccountId`, `toAccountId` | `TransactionListItem:70-71` | already there |
| `CardPaymentDetail` from/card rows | `fromAccountId`, `toAccountId` | `TransactionListItem:70-71` | already there |
| `SettlementDetail` account row | `accountId` | `SettlementView:30` | already there |
| Shared-expense participant rows | `personId` | `ExpenseParticipantView:143` | already there |
| `/people/[id]` settlement history rows | `id` | `SettlementSummaryView:127` | already there |

`ExpenseDetailView`, `TransferDetailView` and `CardPaymentDetailView` all extend
`TransactionListItem` (`TransferListItem` and `CardPaymentListItem` are straight aliases of it),
which is why the ids are on the detail views without being listed in their own type bodies. That
is easy to miss reading the detail type alone, and it is why this table exists.

**Consequence: group 47's linking work is presentational only.** No view model, query or
repository changes. This was costed as the expensive task in the series and is not one.

### 3.10 The one id that is genuinely missing — the blocking settlement

The "Cannot edit" screen (audit 6.3) tells the user to remove a settlement. To link it, the page
needs that settlement's id, and it has only a boolean: `isExpenseSettled()` returns
`Promise<boolean>`.

**Decided: add `getSettlementsBlockingExpense(userId, expenseId)` beside it, returning the
distinct settlement ids.** It composes two calls that already exist —
`expenseSplitRepository().listByTransaction()` then
`settlementAllocationRepository().listBySplitIds()` — and reads `settlementId` off each
allocation (`SettlementAllocation` carries it, `entities.ts:35`). **No repository interface
change.**

`isExpenseSettled()` is left alone. It has three call sites and a narrower contract, and the
edit page can ask the richer question directly.

On the wording of the link: an expense can be blocked by more than one settlement, because
different shares can be settled by different payments. The screen links **each** blocking
settlement rather than picking one, and falls back to the person's settlement history if the
list somehow comes back empty — which would mean the boolean and the id query disagreed, and the
screen should still be leavable when they do.

### 3.11 Screenshots: one new capture, not two

The audit's section 9 says "two screens in section 6 have no screenshot". **That is wrong, and
this is the correction.** Section 6 lists three screens and two of them are already captured:

```text
6.1  /settlements/[id]          desktop/49-settlement-detail.png     captured
6.2  shared expense detail      desktop/41-expense-detail-shared.png captured
6.3  "Cannot edit"              —                                    NOT captured
```

**Decided: add one shot, `55-expense-edit-settled`,** for the 6.3 state. The seeded dataset
already records a settlement through the UI, so a settled expense exists by the time the capture
run reaches it; the shot is a navigation to that expense's `/edit` URL.

The audit has been corrected in place so the next reader does not go looking for a second
missing screen.

---

## 4. Business rules enforced

None directly — no code. Two rules constrain what the following groups may do, and both are
restated because navigation work is exactly when they get broken:

- **A record's type is fixed once written.** No edit screen may offer to convert an expense into
  a transfer, which is why `FormSwitcher` is absent from every edit form and why group 46 must
  not add it while adding a parent link.
- **A settled expense cannot be edited.** The "Cannot edit" screen exists to enforce it. Group
  47 makes that screen navigable; it must not make the expense editable, and it must not offer
  a "remove settlement" action of its own — removal belongs on the settlement, where the
  consequences are visible.

---

## 5. How it was verified

Decisions are verified by being checked against the code they describe, not by a test run.

| Claim | How it was checked |
| --- | --- |
| `chevron-left` is absent | Read `names.ts` in full; 43 names, `chevron-down` and `chevron-right` only |
| The registry enforces name/glyph pairs | `ICONS` is annotated `Record<IconName, IconGlyph>` in `registry.tsx` |
| `Alert` has no action slot | Read `Alert.tsx`; `AlertProps` is `tone`, `title`, `children` |
| Every linking id is present | Read all four view-model files and both settlement/person view models; table in 3.9 |
| `SettlementAllocation` carries `settlementId` | `src/domain/settlements/entities.ts:35` |
| The blocking query needs no repository change | `listBySplitIds` and `listByTransaction` both already on the interfaces |
| `isExpenseSettled` has 3 call sites | Searched `src` and `tests`; edit page ×2, its own definition |
| Only one section-6 screen lacks a capture | Cross-read `EXPECTED_SHOTS` against audit section 6 |

---

## 6. Known gaps

- **No designer sign-off on the back link.** It introduces no new visual idea — it reuses
  `textStyle="eyebrow"` and an existing colour token — but its *placement* above the page title
  is not drawn in any artboard. Flagged for the same review queue as the forty undrawn screens
  in `design/screenshots/README.md` section 6.
- **`chevron-left` joins the fourteen in-house glyphs awaiting review.** Fifteen now.
- **The scroll-position regression in 3.6** is accepted, not solved. If it turns out to matter,
  the fix is a scroll-restoration key on the list route, not a conditional Cancel.
- **`/settlements` is still not a nav destination.** By decision (3.2), not oversight. It is two
  taps from anywhere after group 47, which is the bar this series set for it.

---

## 7. Notes for the next group

Group 43 builds `BackLink`. Everything it needs is settled:

- Two props, `href` and `label`, both required (3.4).
- Visible text is `label`; accessible name is `Back to ${label}` (3.4).
- `textStyle="eyebrow"`, `color="brand.fg"`, underline on hover and focus only (3.3).
- Leading `chevron-left`, which group 43 also adds to the registry — **two files**, `names.ts`
  and `registry.tsx`, or the build fails (3.5).
- No `router.back()` anywhere in it (3.6).

Group 44 then adds `parent?: { href, label }` to `PageHeader`. The one thing to be careful about
is the crushed-title fix; the prop goes in a wrapper *above* the existing `Flex`, never into it.
