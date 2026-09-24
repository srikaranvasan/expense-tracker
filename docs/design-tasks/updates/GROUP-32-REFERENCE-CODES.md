# Group 32 — Ledger Reference Codes

Every transaction and settlement now has a short code a person can read out, and it appears on the
list, the detail page, the dashboard and the form that is about to create the record.

---

## 1. What was built

`#293CF` — five characters, uppercase, mono. It sits beside the amount in the activity list, under it
on the dashboard, as a `Reference` row on every detail page, and on the add-expense form **before the
record is saved**, marked `· draft` when the save will go to the offline queue.

The code is derived, not allocated. It comes from the record's `clientId`, which means it exists the
instant the record does, never changes, and is the same string before and after sync. The derivation
lives in one function; the display lives in one component; the value travels on the view models
alongside `formattedAmount`.

One real bug surfaced, in the test fixtures rather than the app: `tests/helpers/fixtures.ts` generated
client ids ending in a constant `-aaaaaaaa`, so every record in every integration test shared the
reference `#AAAAA`. The new uniqueness test caught it on first run.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `tests/integration/reference-codes.test.ts` | 11 tests against a live database: the code reaches all five view models, is the code the client chose, survives an edit, and the exact ways it is *not* unique and *not* ordered. |

### Changed — the derivation and the display

| File | Change |
| --- | --- |
| `src/lib/utils/reference-code.ts` | Added `referenceCodeFor(record)` — the seam that names *which* id the code comes from. Rewrote the docblock to record the `clientId`-not-`ObjectId` correction and both accepted consequences. |
| `src/components/ui/ReferenceCode.tsx` | Prop `recordId` → **`code`**: the component no longer derives anything. Added `draft`, which appends `· draft`. |

### Changed — view models

| File | Change |
| --- | --- |
| `src/features/transactions/view-models/expense-view-model.ts` | `TransactionListItem.referenceCode: string \| null`, set in `toTransactionListItem`. Expense, transfer, card-payment and shared-expense views all inherit it from there. |
| `src/features/settlements/view-models/settlement-view-model.ts` | `SettlementView.referenceCode`, set in `toSettlementView`; `SettlementDetailView` inherits it. |

### Changed — render sites

| File | Change |
| --- | --- |
| `src/features/transactions/components/TransactionList.tsx` | `TransactionList` rows: reference + amount in one right-hand cluster with a 14px gap. `RecentTransactionList` (dashboard): reference stacked under the amount. |
| `src/features/transactions/components/ExpenseDetail.tsx` | `Reference` row, first in the "Record" card. |
| `src/features/transactions/components/TransferDetail.tsx` | Same. |
| `src/features/transactions/components/CardPaymentDetail.tsx` | Same. |
| `src/app/(app)/settlements/page.tsx` | Reference + amount cluster, matching an activity row. |
| `src/app/(app)/settlements/[id]/page.tsx` | `Reference` row on the "Payment" card. |
| `src/features/dashboard/components/RecentSettlements.tsx` | Reference stacked under the amount. |
| `src/features/transactions/components/ExpenseForm.tsx` | `RECORD #6EDA7`, and `· draft` when the save will be queued offline. |

### Changed — tests and fixtures

| File | Change |
| --- | --- |
| `tests/helpers/fixtures.ts` | **Bug fix.** `clientId()` ended in a constant `-aaaaaaaa`, so every derived reference code was identical. The varying part is now the tail, which is also how a real UUID behaves. |
| `src/lib/utils/reference-code.test.ts` | Three tests for `referenceCodeFor`, including that a queued record and its synced self produce the same code. |
| `src/components/ui/Amount.test.tsx` | Updated for the `code` prop; added the draft-marker test. |

### Changed — documentation

| File | Change |
| --- | --- |
| `docs/design-tasks/updates/GROUP-21-DESIGN-DECISIONS.md` | Section 3.1 carries a correction note, and the two "ObjectId" references now say `clientId`. The decision is unchanged; the field it named was wrong. |

No data-model change. No migration. No new index. Nothing was added to any Mongoose schema — which was
the whole point of choosing a derived code.

---

## 3. Key decisions

### 3.1 The code comes from `clientId`, not the server `ObjectId` — a correction to group 21

Group 21 section 3.1 said two things that cannot both be true:

> Codes render as `#` plus the last five hex characters of the record's `ObjectId` […]
> They are **available offline immediately**, because the id exists before the record syncs.

A record created offline has `serverId: null` until it syncs — `fromLocalTransaction` in
`src/offline/db/record-mapping.ts` returns `null` for exactly that reason. So an `ObjectId`-derived
code would be **absent** while offline and would then **change** the moment the server assigned one.
That is the opposite of a permanent reference, and it is the failure mode group 21 rejected option A
for having.

Every record in this app already carries a `clientId`: a UUID the client generates, required by every
create schema (`clientIdString` in `src/lib/validation/helpers.ts`), stored by the server, and
preserved through sync. Deriving from it gives the property group 21 actually asked for:

- present the instant the record exists locally, before any network call
- **identical before and after sync**
- uniform — no branch on whether a record has reached the server

The handoff settles it independently. `AddExpense-Light.html` draws `TXN-08232 · draft` on a record
that **has not been saved**. Only a client-generated id can produce a code at that moment. Deriving
from the server id would have made the drawn screen unbuildable.

So the group 21 decision stands — derive, do not sequence — and the field it named was wrong. Section
3.1 of that document now carries a correction note rather than being silently contradicted.

### 3.2 `ReferenceCode` takes a formatted string, not an id

The prop changed from `recordId` to `code`, and the component stopped deriving anything.

This codebase formats in view models. `Amount` takes `formattedAmount`, not a `Money`; rows take
`dateLabel`, not a `Date`. A component that derived its own code would be a second answer to a
question the view model already answers, and the two could disagree the day the derivation changes —
which, given 3.1 happened in this very group, is not hypothetical.

It also means the checkbox "surface the code in the view models" is load-bearing rather than
decorative: the view model is where the value comes from, and `referenceCodeFor` has exactly five call
sites.

### 3.3 `referenceCode` is nullable, even though it never is today

`clientId` is required and non-empty, so the field is always a string in practice. It is typed
`string | null` anyway, because that is what a server-allocated sequence returns before its first
sync. Group 21 committed to keeping the seam for option A; typing the field nullable now means
switching to it is a change to `referenceCodeFor` and not to every consumer.

### 3.4 Two placements, because the handoff draws two

- **Activity list and settlements list** — `Activity-Light.html` puts the reference and the amount in
  one right-aligned cluster, `gap: 14px`, reference first. Reference first is what keeps the column of
  amounts flush against the row's right edge; a reference in that column would break the alignment
  that makes a list of money scannable.
- **Dashboard** — `Dashboard-Light.html` stacks them: amount, reference underneath, both
  right-aligned. The narrower column has no room for a pair, and the reference is the less urgent of
  the two.

Both were measured rather than eyeballed; see section 5.

### 3.5 The reference is a row on the detail pages, not a header chip

On the three transaction detail screens it is the **first** row of the "Record" card, above Created
and Last updated: it is the record's *name*, and the other two are facts about it. A settlement has no
separate Record card, so it joins the "Payment" rows — last there, because it names the row rather
than describing the payment.

### 3.6 The draft state is the create form, which is what the handoff draws

`AddExpense-Light.html` shows `TXN-08232 · draft`. That is a record which does not exist yet, so the
draft state belongs to the **form**, and it is implementable only because of 3.1.

The marker shows when the save will go to the offline queue. Online the write is immediate and the
next thing on screen is the saved record, so `· draft` would be true for less time than it takes to
read.

`draft` renders as the **word** "draft", not a colour or a weight change, so it survives for a screen
reader and for anyone who cannot distinguish two greys (9.1).

What is *not* covered: a record already sitting in the offline queue is still not rendered in any list
— no list reads IndexedDB, and `fromLocalTransaction` cannot build a view model without a server id.
That gap predates this group and is recorded in section 6.

### 3.7 The fixture bug was fixed rather than worked around

`tests/helpers/fixtures.ts` built client ids as
`${prefix}-${timestamp36}-${counter36}-aaaaaaaa`. Unique overall, constant in the last five
characters — so once codes derived from the tail, thirty distinct expenses produced one distinct code.

The tempting fix was to use `newClientId()` in the new test and leave the fixture alone. Rejected: the
fixture's own comment claims it mirrors what a real client would generate, and a real `clientId` is a
UUID whose tail is random. Leaving it would mean every future test that touches id shape inherits a
misleading fixture. The counter moved to the end; the prefix stayed, because it makes a failure
message readable.

### 3.8 Uniqueness is tested as a practice, and its absence is tested as a fact

Five hex characters is about a million values, so two records can collide. The suite asserts both
halves:

- thirty records produce thirty distinct codes — realistic practice
- two hand-built client ids with the same tail produce the **same** code — so the limitation is
  written down rather than discovered

The second test is the more useful one. A reference is a human handle used alongside a date, an amount
and a description; it is never a lookup key, and there is deliberately no repository method that takes
one.

---

## 4. Business rules enforced

- **The reference is permanent.** Editing a record's amount, description and date leaves its code
  untouched, and a fresh read agrees with the mutation response. Asserted against a live database, not
  against the formatter, because "the id the server persisted is the id the code derives from" is a
  claim only a database can settle.
- **The reference implies no order and no count.** Group 21 accepted this explicitly. `#A3F09` is not
  "after" `#7B210`; nothing sorts, counts or paginates by it. The activity list is ordered by date, as
  it was. A test pins this so nobody builds on an ordering that is not there.
- **The reference is not an identifier.** Not unique, never queried, no index. Links and lookups still
  use the `ObjectId`; the code is display only.
- **No stored aggregate, no stored reference.** Consistent with section 9.1 and the rule that every
  figure on a screen is recomputed: the code is derived on every read from a field that already
  exists, so there is no second copy to fall out of step.
- **The code a user notes from the form is the code on the saved record.** The test that matters most
  in section 5 — it is the entire promise the `· draft` marker makes.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    611 pass  (608 + 3)
npm run test:integration                             508 pass  (497 + 11)
npx vitest run --project ui                          273 pass  (272 + 1)
npx vitest run --project offline                      150 pass
npm run build                                        clean
npx eslint src tests                                 clean
```

`tests/integration/reference-codes.test.ts` covers, against MongoDB: the code on transaction rows, on
the expense detail view, on settlement rows and the settlement detail view, and on every row in a
mixed list; that it equals the code the client could compute before posting; that it does not change
between reads; that it survives an edit which changes the amount, the description and the date and
bumps `syncVersion`; that it is *not* the `ObjectId`'s tail; distinctness across thirty records; a
constructed collision; and the absence of ordering.

### Measured in Chromium, against the artboards

| | Drawn | Measured |
| --- | --- | --- |
| Activity row | reference then amount, `gap: 14px`, same row | reference before amount, gap **14px**, same row |
| Activity code | 11px mono | `11px`, `"IBM Plex Mono"` |
| Dashboard row | amount, reference below, right-aligned | below: **true**, right edges within 3px |
| Detail row | `Reference` label + code | `Reference#293CFCreated…` — first row of the Record card |
| Detail code | mono, meta grey | `12px`, `rgb(114,110,138)` = `#726E8A` (`inkMeta`) |
| Form | `Record · TXN-08232` | eyebrow `RECORD` + `#5A842` |
| Form, offline | `TXN-08232 · draft` | `#6EDA7 · draft` |
| Dark mode | — (not drawn) | `rgb(143,138,168)` = `#8F8AA8` (`darkInkMeta`) |

The greys are group 21's contrast replacements, not the handoff's: the artboards draw `#B4B0C4`, which
group 21 measured at 2.1:1 and replaced with `inkMeta #726E8A`. So the code reads as slightly darker
than drawn, deliberately.

The offline check is the one worth repeating by hand: the form's code **before** going offline was
`#6EDA7`, and after was `#6EDA7 · draft` — the same code plus a marker, not a different code. That is
3.1 working, observed in a browser.

---

## 6. Known gaps

- **A queued offline record still does not appear in any list.** It has a reference now, and the form
  shows it, but the activity list is server-rendered and `fromLocalTransaction` returns `null` without
  a server id. So the draft row that would carry `· draft` in a list has no render path. This predates
  group 32 and is an offline-layer feature, not a styling one: it needs either a client-side merge of
  IndexedDB reads into the list or a view model built from `LocalTransaction`. **Not** assigned to a
  remaining design group — it should be scoped separately.
- **Only expenses can be created offline at all.** Settlements, transfers and card payments still post
  to the server (noted in `GROUP-15-OFFLINE-SYNC.md`), so `· draft` has exactly one call site today.
- **The form's reference is not yet in the side rail.** `AddExpense-Light.html` puts `Record ·
  TXN-08232` as an eyebrow at the top and `TXN-08232 · draft` in a tinted box in the side rail. The
  side rail does not exist yet — **group 36** builds it. The value and the draft logic are done and in
  the right component; only the placement moves. `ReferenceCode` already has the `tone="onTint"` the
  tinted box will need.
- **Only the expense form shows a pre-save reference.** The transfer, card-payment, shared-expense and
  settle-up forms do not. `SettleUp-Light.html` draws `Settlement · STL-0412`, so **group 36 and group
  38** should add it; the pattern is three lines.
- **The reference is absent from the person detail page's settlement history.** Those rows are inline
  in `src/app/(app)/people/[id]/page.tsx` rather than sharing a component. **Group 38** owns that
  screen and should add it, or better, extract the row.
- **Not reviewed by the designer:** the decision to derive from `clientId` rather than the `ObjectId`
  (3.1). It produces the same visible result — five hex characters — so there is nothing new to look
  at, but it is a documented deviation from the letter of group 21.
- **Codes are hex, not sequential.** `#A3F09`, not `#08231`. Group 21 accepted this; it remains the
  one visible divergence from the handoff, and option A is still available behind
  `referenceCodeFor`.

---

## 7. Notes for the next group

- **`referenceCodeFor(record)` is the only place that decides which id a code comes from.** Do not
  call `toReferenceCode` with a field of your own choosing; that is how the two answers appear again.
- **`ReferenceCode` takes `code`, not an id.** Get it from a view model's `referenceCode`. If you are
  in a create form and have no view model, call `referenceCodeFor({ clientId })` once and memoise it,
  as `ExpenseForm` does.
- **Use `tone="onTint"` inside any tinted panel.** `content.meta` measures 4.2:1 on `tealTint`, under
  AA, and `brand.muted` inverts between colour modes, so the dark case is far worse. Group 36's side
  rail and reference box both need it.
- **Group 35 (activity and transaction detail)** inherits the reference already placed in both. What
  is left there is the rest of the row — the type swatch, the badges and the meta line. The reference
  cluster should not need touching; if the row is restructured, keep reference-before-amount so the
  amount column stays flush.
- **Group 36 (transaction forms)** moves the form reference into the side rail, adds it to the other
  three transaction forms, and should reuse `ExpenseForm`'s memoised `referenceCode` pattern verbatim.
- **Group 38 (people and settlements)** adds the reference to the person page's settlement rows and to
  the settle-up form's eyebrow (`Settlement · STL-0412`).
- **Group 40** should include the code in the contrast pass: `content.meta` on `surface` is the light
  case, `darkInkMeta` on `darkSheet` the dark one, and the 11px size in the activity list is the
  smallest text in the app.
- **`tests/helpers/fixtures.ts` `clientId()` now varies at the end.** If you change it again, keep the
  tail unique — five characters of it are visible to users.
