# Group 46 — Forms Get A Way Up And A Way Out

Ten form routes gained a back link, and seven `router.back()` calls became hierarchy pushes.

This is the group that fixes the defect the audit was written around.

---

## 1. What was built

### Back links

| Route | Parent | Label |
| --- | --- | --- |
| `/accounts/new` | `/accounts` | Accounts |
| `/people/new` | `/people` | People |
| `/transactions/new` | `/transactions` | Activity |
| `/transactions/new/shared` | `/transactions` | Activity |
| `/transactions/new/transfer` | `/transactions` | Activity |
| `/transactions/new/card-payment` | `/transactions` | Activity |
| `/accounts/[id]/edit` | `/accounts/[id]` | the account's name |
| `/people/[id]/edit` | `/people/[id]` | the person's name |
| `/people/[id]/settle` | `/people/[id]` | the person's name |
| `/transactions/[id]/edit` | `/transactions/[id]` | the record's description |

A create form's parent is its section list. An **edit** form's parent is the record.

### Cancel

```text
before   onCancel={() => router.back()}
after    onCancel={() => router.push(cancelHref)}
```

Seven call sites. Every one now lands on the same place its back link points at.

---

## 2. Files added or changed

### Form components — the Cancel change

| File | `cancelHref` |
| --- | --- |
| `src/features/accounts/components/AccountForm.tsx` | `/accounts/${account.id}` on edit, else `/accounts` |
| `src/features/people/components/PersonForm.tsx` | `/people/${person.id}` on edit, else `/people` |
| `src/features/transactions/components/ExpenseForm.tsx` | `/transactions/${expense.id}` on edit, else `/transactions` |
| `src/features/transactions/components/SharedExpenseForm.tsx` | same |
| `src/features/transactions/components/TransferForm.tsx` | same |
| `src/features/transactions/components/CardPaymentForm.tsx` | same |
| `src/features/settlements/components/SettleUpForm.tsx` | always `/people/${view.personId}` |

### Route files — the `parent` prop

`accounts/new`, `accounts/[id]/edit`, `people/new`, `people/[id]/edit`, `people/[id]/settle`,
`transactions/new`, `transactions/new/shared`, `transactions/new/transfer`,
`transactions/new/card-payment`, `transactions/[id]/edit` (all four of its branches).

### Unchanged, deliberately

- **`src/components/ui/FormActions.tsx`.** Not one line. `onCancel` is still required and the
  flex geometry that fixed the clipped-Cancel bug is untouched. Only what the callers *pass* it
  changed.
- **`CategoryForm.tsx`.** It is an inline form on `/categories` and passes its own `onDone`
  dismiss handler, not a route. It never called `router.back()` and needs no parent — the
  categories page is a nav destination.

---

## 3. Key decisions

### 3.1 Seven call sites, not eight

The audit says "eight forms" in several places, inherited from the design series' group 27 note
("eight converted"). The actual count of `router.back()` calls was **seven**; the eighth form in
group 27's tally is `CategoryForm`, which uses `onDone`.

Recorded because the discrepancy will otherwise look like a missed file. The audit's section 5.9
tally of ten `HISTORY-ONLY` *routes* is correct — six create routes plus three edits plus
settle-up — because four routes share `ExpenseForm`/`SharedExpenseForm` between create and edit.

### 3.2 An edit form's parent is the record

`/accounts/[id]/edit` goes to `/accounts/[id]`, not `/accounts`.

The change the user was making would have been visible on the record, so that is where abandoning
it should land. It is also already on screen — `PageHeader`'s `description` names the account — so
this made an existing string into a destination rather than adding one.

### 3.3 The scroll-position and filter-state regression, accepted

The honest cost of 3.1 in group 42. `router.back()` restored scroll position and preserved a
filtered list URL; a push does not.

Concretely: open `/transactions?accountId=abc`, click a row, click Edit, click Cancel. Before, you
returned to the filtered list at your old scroll position. Now you land on
`/transactions/[id]` — the record.

Accepted, because the alternative is a conditional Cancel whose destination depends on
`window.history.length`, and unpredictability is the defect being fixed. The record links onward to
the list. If this turns out to matter, the fix is scroll restoration on the list route, not a
conditional.

### 3.4 `SettleUpForm` always returns to the person, never to `/settlements`

Settling up is an action *on a person*. The balance the user was reading is on the person's page,
and that is where abandoning the payment should return — even though a successful submit lands on
the settlement.

So this one form's Cancel and its success path deliberately differ, which is correct: cancelling
returns you to where you were, saving takes you to what you made.

### 3.5 No `FormSwitcher` was added to any edit form

`FormSwitcher` offers "Split instead · Transfer · Pay card" on the four create forms. It is absent
from every edit form because **a record's type is fixed once written**, and offering a conversion
the app does not do would be an invitation to a rejected submission.

Naming it because this group touched all four edit branches and adding the switcher there would
have looked like consistency.

---

## 4. Business rules enforced

- **A record's type is fixed once written** — 3.5.
- **A form always has a reachable way out.** `FormActions.onCancel` stays required, so the
  guarantee group 27 established survives this change. What group 46 added is that the way out now
  goes somewhere predictable.
- **Nothing about validation, amounts or settlement rules was touched.** Every change in this
  group is a destination.

---

## 5. How it was verified

```text
npx tsc --noEmit        clean
npx eslint .            clean
npx vitest run          1711 passed
npm run build           succeeds
```

### The cold-URL assertions — the ones that matter

`tests/e2e/navigation.spec.ts`. Each opens `about:blank`, then `goto`s the form, so **there is no
history to walk**:

```text
Cancel on a cold URL
  ok  a create form cancels to its section list
        /accounts/new  → Cancel → /accounts
        /people/new    → Cancel → /people
  ok  the expense form cancels to Activity even when opened directly
        /transactions/new → Cancel → /transactions
  ok  an edit form cancels to the record, not to the list
        /accounts/<id>/edit → Cancel → /accounts/<id>
```

This is the point of the whole group and worth being explicit about: **a test that reached these
forms by clicking a link would pass with or without the fix**, because `router.back()` works when
there is history. The cold `goto` is the case that was broken.

### The unit-level assertions

`tests/ui/navigation.test.tsx` covers what does not need a browser: that `PARENTS` labels match
`NAV_ITEMS`, that the record-parent helpers build the right hrefs, and that `FormActions` calls a
push rather than a history walk.

### What was *not* re-measured

The `FormActions` row geometry. It was not modified — the fix is in `onCancel`, and the flex
properties, the `wrap`, and the button order are byte-identical. Group 48 re-measures it anyway
from the recaptured screenshots, because "we did not touch it" is a weaker claim than a
measurement.

---

## 6. Known gaps

- **Scroll position and filter state are not preserved on Cancel** — 3.3, accepted by decision.
- **`/transactions/[id]/edit` for a *settled* expense** is handled in group 47, not here. This
  group gave its four working branches a parent; the guard branch needed links to two records and
  a new query.
- **The offline expense path is unchanged.** `ExpenseForm`'s offline save still
  `router.push("/transactions")` on success, which was already a push and already correct.

---

## 7. Notes for the next group

Group 47 is the largest in the series and finishes three things this group left: the five
prerequisite guards (which have no Cancel at all, because the guard replaces the form), the
"Cannot edit" screen, and the records that detail pages name without linking.

Note that `/transactions/[id]/edit` is touched by both groups — this one added `parent` to the four
working branches, group 47 rebuilds the guard branch. Same file, different code paths.
