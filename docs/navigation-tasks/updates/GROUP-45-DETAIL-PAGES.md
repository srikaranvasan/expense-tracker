# Group 45 — Detail Pages Get A Way Up

Six detail screens, one prop each. No new components — groups 43 and 44 did that work.

---

## 1. What was built

A back link on every detail page in the application:

| Screen | Back link goes to | Label |
| --- | --- | --- |
| `/accounts/[id]` | `/accounts` | Accounts |
| `/people/[id]` | `/people` | People |
| `/transactions/[id]` — expense | `/transactions` | Activity |
| `/transactions/[id]` — **shared** expense | `/transactions` | Activity |
| `/transactions/[id]` — transfer | `/transactions` | Activity |
| `/transactions/[id]` — card payment | `/transactions` | Activity |
| `/settlements/[id]` | `/settlements` | Settlements |

Two of these do more than remove friction:

- **`/settlements/[id]` closes a real dead end** (audit 6.1). `/settlements` is not in the tab
  bar, so this page previously could not reach its own list at all — the only options were nav
  destinations in other sections entirely.
- **The shared-expense variant had nothing in its header** (audit 6.2), because `ExpenseDetail`
  renders `Edit` only when `isExpense && !expense.isShared`. The back link is unconditional, so
  the most complex record in the app is no longer the hardest one to leave. Group 47 adds the
  other half — linked participant rows.

---

## 2. Files added or changed

| File | Change |
| --- | --- |
| `src/app/(app)/accounts/[id]/page.tsx` | `parent={PARENTS.accounts}` |
| `src/app/(app)/people/[id]/page.tsx` | `parent={PARENTS.people}` |
| `src/app/(app)/settlements/[id]/page.tsx` | `parent={PARENTS.settlements}` + the comment explaining why this one matters |
| `src/features/transactions/components/ExpenseDetail.tsx` | `parent={PARENTS.transactions}` |
| `src/features/transactions/components/TransferDetail.tsx` | `parent={PARENTS.transactions}` |
| `src/features/transactions/components/CardPaymentDetail.tsx` | `parent={PARENTS.transactions}` |

Three of those are components rather than route files, because `/transactions/[id]` delegates its
whole render to one of them by record type. That is also why the single route `/transactions/[id]`
appears as four rows in the table above.

---

## 3. Key decisions

### 3.1 "Activity", not "Transactions"

`/transactions` is labelled **Activity** in the tab bar, and the back link says the same. Taking
the label from `NAV_ITEMS` via `PARENTS` rather than typing it is what guarantees that; a literal
`{ href: "/transactions", label: "Transactions" }` would have looked entirely reasonable in a
review and given one screen two names.

There is an e2e assertion specifically for this — it checks the "Activity" link is present **and**
that no "Back to Transactions" link exists.

### 3.2 The parent is the section list, not wherever the user came from

`/accounts/[id]` goes to `/accounts` even when the user arrived from the dashboard, or from an
expense's newly-linked account row (group 47), or from a filtered activity list. Hierarchy, not
history — the same reasoning as group 42 section 3.6.

The one consequence worth naming: arriving at an account from a transaction and going "back"
lands on `/accounts`, not on the transaction. That is correct for a link labelled "Accounts",
which is exactly why the label names its destination rather than saying "Back".

### 3.3 The `meta` slot was left alone

`/accounts/[id]` and `/people/[id]` put their identity swatch and archived badge in `meta`, above
the title. Those now sit below the back link, and the order — back link, then swatch, then title —
was checked against the group 44 structure rather than assumed: `meta` is inside the title row, the
back link is above it, so the swatch still aligns to the title's baseline on desktop.

---

## 4. Business rules enforced

None changed. Two preserved:

- **A shared expense still offers no inline edit.** `canEditInline` is untouched. The back link
  makes the page leavable; it does not make a settled or shared expense editable, which is a
  financial rule (`docs/02-DATA-MODEL.md`) and not a navigation one.
- **The three amounts on a shared expense stay visibly distinct.** Nothing in this group touches
  the amount rows.

---

## 5. How it was verified

Type check, lint and the full unit/UI suite:

```text
npx tsc --noEmit        clean
npx eslint .            clean
npx vitest run          1711 passed
```

The assertions that actually prove this group are in `tests/e2e/navigation.spec.ts`, because they
need a **cold URL** and a real browser:

```text
back links on detail pages
  ok  an account detail page returns to the accounts list
  ok  an expense detail page returns to Activity, not to Transactions
  ok  a person detail page returns to the people list
the settlement dead end
  ok  a settlement detail page can reach its own list
```

Each opens `about:blank` first and then `goto`s the record, so there is no history behind it —
then asserts the link is visible, clicks it, and asserts the landing URL. A test that navigated by
clicking in from a list would have passed before this group existed.

---

## 6. Known gaps

- **Settlement history rows on `/people/[id]` and participant rows on a shared expense** are
  linked in group 47, not here. Until then the shared-expense page has a back link but its
  participant rows are still inert.
- **`/transactions/[id]` has one back link for four record types.** A card payment arguably
  belongs to its card as much as to the activity list. Left as Activity because that is the list
  the record appears in; the card is reachable from the newly-linked "Card" row (group 47).
- **No screenshot review yet** — the recapture is group 48.

---

## 7. Notes for the next group

Group 46 does the same for the ten form routes, with one difference that matters: **an edit form's
parent is the record, not the section list.** Use `accountParent`/`personParent`/
`transactionParent`, and make the form's `onCancel` push to the same href so the back link and
Cancel cannot disagree.
