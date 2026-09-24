# Group 47 — The Dead Ends And The Guards

The largest group in the series and the one with the most user impact. Groups 45 and 46 removed
friction; this one removes walls.

---

## 1. What was built

Four separate pieces of work, all of which were "the page names something and does not link to
it" in one form or another.

### The five prerequisite guards now have an action

Each told the user to go and create a record, without saying where — on a screen that also had no
Cancel, because a guard replaces the whole form and `FormActions` never renders.

| Form | Guard | Action added |
| --- | --- | --- |
| `ExpenseForm` | "Add an account first" | "Add an account" → `/accounts/new` |
| `SharedExpenseForm` | "Add someone first" | "Add a person" → `/people/new` |
| `SharedExpenseForm` | "Add an account first" | "Add an account" → `/accounts/new` |
| `TransferForm` | "Add another account first" | "Add an account" → `/accounts/new` |
| `CardPaymentForm` | "Add the accounts first" | "Add an account" → `/accounts/new` |

These are screens `14`–`17` in `design/screenshots/README.md`, and between them they are the most
common first experience in the app: a brand-new user taps "Add expense" before creating anything.

### "Cannot edit" — the worst screen in the app, rebuilt

It had a title and a paragraph. The paragraph named two records — *this expense* and *the
settlement* — and linked to neither. No Cancel, no back link, and `/settlements` is not in the tab
bar. It now has:

- a back link to the expense,
- a link to **each** blocking settlement,
- and a fallback to `/settlements` if that list somehow comes back empty.

### Shared-expense participant rows are links

The other half of audit 6.2. A shared expense has no `Edit` action, so with group 45's back link
it had exactly one way off the page. Its participant rows now open each person.

### Records that detail pages named but did not link

| Component | Row | Now links to |
| --- | --- | --- |
| `ExpenseDetail` | Account | `/accounts/[id]` |
| `ExpenseDetail` | Category | `/transactions?categoryId=[id]` |
| `TransferDetail` | From, To | `/accounts/[id]` |
| `CardPaymentDetail` | Paid from, Card | `/accounts/[id]` |
| `SettlementDetail` | Account | `/accounts/[id]` |
| `/people/[id]` | each settlement history row | `/settlements/[id]` |

### `/settlements` reachability

`/people` gained a "Settlement history" link, so the list is reachable from a tab-bar destination.

---

## 2. Files added or changed

| File | Change |
| --- | --- |
| `src/components/feedback/Alert.tsx` | New optional `action?: ReactNode` slot, rendered below the description |
| `src/features/transactions/queries/settlement-status.ts` | New `getSettlementsBlockingExpense()` |
| `src/app/(app)/transactions/[id]/edit/page.tsx` | The "Cannot edit" branch rebuilt |
| `src/features/transactions/components/ExpenseDetail.tsx` | New exported `AccountRef`; account + category rows linked; participant rows made `RowLink`s |
| `src/features/transactions/components/TransferDetail.tsx` | From/To rows linked via `AccountRef` |
| `src/features/transactions/components/CardPaymentDetail.tsx` | Paid-from/Card rows linked via `AccountRef` |
| `src/app/(app)/settlements/[id]/page.tsx` | Account row linked |
| `src/app/(app)/people/[id]/page.tsx` | Settlement history rows became `RowLink`s |
| `src/app/(app)/people/page.tsx` | "Settlement history" link; footer became a `Flex` of two links |
| `src/features/transactions/components/ExpenseForm.tsx` | Guard action |
| `src/features/transactions/components/SharedExpenseForm.tsx` | Two guard actions |
| `src/features/transactions/components/TransferForm.tsx` | Guard action |
| `src/features/transactions/components/CardPaymentForm.tsx` | Guard action |

**No view model, query result shape, repository interface or database schema changed.** See 3.1.

---

## 3. Key decisions

### 3.1 Every id was already there — this group is presentational

The group 42 audit's most useful finding. `ExpenseDetailView`, `TransferDetailView` and
`CardPaymentDetailView` all extend `TransactionListItem`, which carries `accountId`,
`fromAccountId`, `toAccountId` and `categoryId`. `ExpenseParticipantView` carries `personId`.
`SettlementView` carries `accountId`. `SettlementSummaryView` carries `id`.

None of that is visible from reading the detail types, because the fields come from the base type —
which is exactly why it was worth checking before costing the work. This was expected to be the
expensive task in the series and turned out to need no data-layer change at all.

The **one** exception is 3.3.

### 3.2 `AccountRef`, because three cases repeated across three files would drift

```text
no name          "—"            the account was deleted, or none was recorded
name, no id      plain text     should not happen, but a label beats a broken link
name and id      a link
```

Six rows across four files. Written inline it would be six ternaries, and the middle case is the
one somebody would forget. Exported from `ExpenseDetail.tsx`, which already exports `NotesBlock`
to its two siblings for the same reason.

It renders a plain `AppLink`, matching `/settlements/[id]`'s existing linked person row rather than
inventing a primitive. That page was the only one already doing this correctly, so it set the
precedent.

### 3.3 The blocking settlement needed a new query, but no new repository method

`isExpenseSettled()` returns a boolean, which is all the *guard* needs and not enough for the
*screen* the guard renders.

`getSettlementsBlockingExpense()` composes two existing calls —
`expenseSplitRepository().listByTransaction()` then
`settlementAllocationRepository().listBySplitIds()` — and reads `settlementId` off each allocation.
No interface change.

It returns a **list**, not one id: an expense can be blocked by more than one settlement, because
different shares can be cleared by different payments. Picking one to link would hide the others
from someone trying to unblock the record.

`isExpenseSettled()` was left alone. It has a narrower contract and three call sites, and the edit
page can simply ask the richer question.

### 3.4 "Cannot edit" links the settlement but does not offer to remove it

The screen tells the user to remove a settlement. It would be easy to put a "Remove settlement"
button on it, and that is deliberately not done.

Removal belongs on the settlement's own page, where its amount, its direction and the expenses it
cleared are all on screen. A destructive action on a page that shows none of its consequences is
worse than one extra tap — and this is money.

### 3.5 The empty-list fallback

If `getSettlementsBlockingExpense()` returns nothing while `isExpenseSettled()` returned true, the
screen links to `/settlements` instead. That state should be impossible — both read the same
allocations.

It is there because **this screen's entire defect was being inescapable**, and shipping a version
that becomes inescapable again on an empty array would be a poor outcome for the group that fixed
it.

### 3.6 The category links to filtered activity, not to a category page

There is no category detail route, and `/categories` is a management screen for renaming and
archiving — not a place to see what was spent. "What else went to Groceries?" is the question
someone clicking a category on an expense is actually asking, and
`/transactions?categoryId=…` answers it.

### 3.7 The user's own participant row is not a link

`participant.personId` is null for the account holder, because there is no `/people` record for
them. A row that looks like a link and does nothing is worse than plain text, so the same condition
covers both: `!participant.isUser && participant.personId !== null`.

This is why that list mixes `RowLink` and `Flex` children. Both carry the same padding so the rows
read as one list.

### 3.8 `Alert` got an `action` slot rather than the guards nesting their own

Five guards each laying out their own action is five chances to lay it out differently — the exact
argument that made `FormActions` a component instead of a documented pattern. The slot also matches
how `CardHeader`, `PageHeader` and `EmptyState` already separate prose from action.

Optional, so all pre-existing `Alert` callers are untouched.

### 3.9 `/settlements` reachability: a link on `/people`, not a sixth tab

Group 42 section 3.2 decided this. "Settlement history" on `/people` in the same mono register as
the archived-people toggle, so the list is two taps from anywhere via a tab-bar destination.

`/settlements` already linked *to* `/people` ("Settle up with someone"); this closes the loop.

**`BottomNav` was not re-measured at 402px, because it was not changed.** The group's checkbox for
that measurement is recorded as not-applicable with this as the reason.

---

## 4. Business rules enforced

This is the group where navigation work came closest to financial rules, so these are the ones it
was careful about:

- **A settled expense cannot be edited.** The guard is untouched. This group made its screen
  navigable; it did not make the expense editable, and it did not add a removal shortcut (3.4).
- **A record's type is fixed once written.** No conversion offered anywhere.
- **The three amounts on a shared expense stay visibly distinct.** Making a participant row a
  `RowLink` changed its target, not its content: the name and the share still render exactly as
  before, and the total, the user's share and each participant's share remain three separate
  figures.
- **Direction is always words.** Settlement history rows became links and kept their
  `directionLabel` text ("They paid you"), so the direction is still stated rather than implied by
  colour or sign.
- **Archived records stay reachable.** `AccountRef` links an archived account like any other; the
  account's own page carries the archived warning. Hiding the link would make history harder to
  audit.

---

## 5. How it was verified

```text
npx tsc --noEmit        clean
npx eslint .            clean
npx vitest run          1711 passed  (68 files)
npm run build           succeeds
```

### E2E, on cold URLs

```text
prerequisite guards
  ok  the expense form offers a way to create the account it needs
        /transactions/new (no accounts) → "Add an account" → /accounts/new
  ok  the split form offers a way to add the person it needs
        /transactions/new/shared (no people) → "Add a person" → /people/new
  ok  a guard screen still has a back link, since it has no Cancel
        asserts zero Cancel buttons AND a visible "Back to Activity"
the settlement dead end
  ok  a settlement detail page can reach its own list
  ok  the people list can reach the settlements list
```

That third one is the assertion worth keeping: it asserts the **absence** of a Cancel button
alongside the presence of the back link, which is what makes the back link load-bearing on a guard
screen rather than a nicety.

### Unit

`tests/ui/navigation.test.tsx` asserts `Alert`'s action renders as a link with the right href, and
that it lands in the text stack rather than beside the icon.

### The new screenshot

`55-expense-edit-settled` was added to `EXPECTED_SHOTS` — the "Cannot edit" state, which had **no
capture at all** through twenty-one design groups. The capture asserts the `Cannot edit` heading is
visible before shooting, so if the seed ever changes such that the shared expense is unsettled, the
run notes it rather than silently photographing a working edit form under a misleading name.

### What e2e does not cover

The six linked `DetailRow`s and the settlement-history rows are not walked by an e2e test. They are
one-line changes of an existing `DetailRow` value to an `AppLink`, they are type-checked against
ids proven present in 3.1, and they are visible in the recaptured screenshots. Recorded as a
deliberate omission rather than an oversight.

---

## 6. Known gaps

- **No e2e coverage for the "Cannot edit" screen's links.** Reaching it requires seeding a shared
  expense, settling it, and then opening its edit URL — which the screenshot script now does, so
  the state is at least photographed and reviewed. An e2e test for it would be the natural next
  addition.
- **The three remaining guard actions** (`SharedExpenseForm`'s account guard, `TransferForm`,
  `CardPaymentForm`) are not individually e2e-tested; two of the five are. The other three are
  identical one-line additions.
- **`AccountRef` does not indicate an archived account.** The link works and the destination says
  so, but the row itself gives no hint. Arguably fine, arguably a missing badge.
- **The category link uses a query parameter that `/transactions` validates and may ignore.** If
  `categoryId` fails the schema the list renders unfiltered with a notice, which is the existing
  behaviour for any hand-edited filter and not a new failure mode.

---

## 7. Notes for the next group

Group 48 verifies and recaptures. Two things specific to this group to check in the new set:

1. **`55-expense-edit-settled` exists** in `desktop/` and `mobile/`. If it is missing, the run's
   notes will say the guard did not render — which would mean the seed changed.
2. **The linked `DetailRow` values still right-align and truncate.** They became `AppLink`s inside
   a layout that previously held strings, and `AppLink` is `inline-flex`; worth a look on
   `43-transfer-detail` and `45-card-payment-detail` at both widths.
