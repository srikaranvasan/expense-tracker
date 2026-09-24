# Group 38 — People And Settlements Screens

Settle-up rebuilt to `SettleUp-Light.html`, the `BALANCED` stamp placed at last, and direction stated
in words on every row that has one.

---

## 1. What was built

The people list opens with two tiles — owed to you, owed by you — then rows carrying a directional
square avatar, the name, and a `BalanceBadge` that says which way the money goes. The person detail
page shows the same avatar above the title, both gross figures rather than one net number, and the
`BALANCED` stamp beside the words "You are square" when there is nothing to settle.

Settle-up is a centred 820px column with no side rail: an avatar and the sentence "Ravi Shankar **pays
you**" at the top, the payment amount with its outstanding hint, and the allocation box whose footer
carries the allocated figure with the stamp beside it once it matches. Unbalanced is a warning `Alert`,
never a stamp.

This is also the first group that could reach a settled shared expense in a browser, so the activity
badges group 35 built and could not photograph are now confirmed: `Split` and `Settled` on the same
row.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `tests/ui/people.test.tsx` | 11 tests. Mostly the direction-in-words rule and the stamp's contract. |

### Changed

| File | Change |
| --- | --- |
| `src/app/(app)/people/page.tsx` | Two `SummaryTile`s instead of a `DetailList`; archived toggle as a `CardActionLink`. |
| `src/app/(app)/people/[id]/page.tsx` | Avatar + archived badge in the header meta slot; "Settle up" promoted into the header; the `BALANCED` stamp on the settled state; reference codes on the settlement-history rows. |
| `src/app/(app)/people/new/page.tsx`, `[id]/edit/page.tsx`, `[id]/settle/page.tsx` | Card wrappers removed; settle-up capped at 820px. |
| `src/features/people/components/PersonList.tsx` | `Circle` → `Avatar`; `StatusBadge kind="archived"`; badge stacks below the name on a phone. |
| `src/features/people/components/PersonObligationList.tsx` | `StatusBadge` instead of a hand-rolled chip, and **no badge on `unsettled`**. |
| `src/features/people/components/PersonArchiveButton.tsx` | The inline confirmation restyled as an inset block. |
| `src/features/people/components/PersonForm.tsx` | `FormLayout` + rail. |
| `src/features/people/view-models/person-view-model.ts` | `SettlementSummaryView.referenceCode` — group 32's last missing money list. |
| `src/features/settlements/components/SettleUpForm.tsx` | Rebuilt to the artboard: avatar + direction sentence + reference, the allocation box, the `BALANCED` stamp, account/date two-up, `FormLayout`. |

---

## 3. Key decisions

### 3.1 The `BALANCED` stamp, in two places, never alone

`Stamp` was built in group 28 and had no call site until now. It appears on the settle-up allocation
footer and on a settled person's balance card.

Both obey the rule the component exists to enforce (5.4): **the stamp is never the only carrier of its
message.** On settle-up it sits beside the allocated figure that proves it; on the person page beside
the sentence "You are square with Ravi Shankar." It stays `aria-hidden`, so assistive technology reads
the text and not a decorative duplicate.

Measured: `rotate(-7deg)`, 2px dashed, `rgb(46,138,97)` — exactly the artboard's `#2E8A61`.

### 3.2 Unbalanced is an `Alert`, and the submit is disabled

No "UNBALANCED" stamp. A rotated dashed stamp's visual language is "checked and approved", so using it
for a blocking error makes the error look ornamental. The warning alert says what to do, and the submit
stays disabled until the numbers agree — verified in a browser: stamp absent, alert on butter, submit
`disabled: true`.

### 3.3 Settle-up has no side rail

Every other form page in the app is two columns. `SettleUp-Light.html` draws a centred 820px column,
and the reason is the allocation box: it is the subject of this screen, and a rail beside it would
compete with the one thing the user came here to get right. `FormLayout` with no rail gives the same
emphasised card; the page caps the width. Measured at exactly 820px.

### 3.4 The person page shows both gross figures, not one net number

A person can owe you for one expense while you owe them for another. "₹400" hides which way each half
went. The header's `BalanceBadge` states the net *in words*; the card states what it was computed from.

### 3.5 "Settle up" moved into the page header

It was a full-width button inside the balance card. In the header it sits where every other primary
page action sits, and it disappears when there is nothing to settle or the person is archived — an
enabled button that leads to "nothing to settle" is a dead end.

### 3.6 `unsettled` obligations carry no badge

Every row in the "unsettled expenses" card is unsettled; a chip on each is a column of identical
badges. Same rule the activity list follows for a plain personal expense. The two states worth calling
out — settled, part settled — keep theirs, and now come from `StatusBadge` so they match the activity
row and the expense detail page.

### 3.7 The avatar is a square

`PersonList` used Chakra's `Circle`. Nothing in this design is round (5.1), and `Avatar` was already
built for exactly this. Its fill encodes direction — mint owes-you, coral you-owe, and the one
non-bright fill when square — which is why it only ever appears beside a `BalanceBadge`.

### 3.8 The archive guard warns, it does not block

Archiving is reversible and keeps the balance and the history, so refusing to archive someone with an
outstanding balance would be protecting the user from nothing. The confirmation states the balance and
says what archiving actually does.

### 3.9 The settle-up reference sits in the card, not the page header

`SettleUp-Light.html` puts `Settlement · STL-0412` above the title. Same decision as group 36: the code
comes from the `clientId` the client component generates, so a header eyebrow would push a client
boundary onto the page for a repeat of something already shown. It sits beside the direction sentence
at the top of the card instead.

---

## 4. Business rules enforced

- **Direction is in words everywhere.** Checked on every surface: the list row (`owes you`), the
  person header badge, each obligation row (`18 Sept 2026 · owes you`), the settle-up sentence
  (`Ravi Shankar **pays you**`), the settlement history rows (`directionLabel`), and the settlements
  list. Colour is never the only signal.
- **A balance is derived from allocations alone**, and the page says so — "Derived from shared expenses
  and settlements". Nothing here is stored.
- **A payment must be fully allocated.** The server rejects a mismatch outright, so the form spreads
  oldest-first, keeps every line editable, shows the running total, and disables the submit until it
  balances.
- **A balance can always be traced to the expenses behind it.** The obligation rows link to the
  transaction and show what is left against what it started as.
- **Archiving preserves the balance and the history.** It only removes the person from the pickers.
- **Both halves of a balance stay visible.** Gross owed-to-you and gross owed-by-you, never collapsed.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    611 pass
npm run test:integration                             508 pass
npx vitest run --project ui                          343 pass  (332 + 11)
npm run build / npx eslint src                       clean
```

### Measured in Chromium

| | Drawn | Measured |
| --- | --- | --- |
| Settle-up column | 820px centred | **820** |
| `BALANCED` stamp | 2px dashed `#2E8A61`, rotated | `dashed`, `2px`, `rgb(46,138,97)`, `rotate(-7deg)`, `aria-hidden="true"` |
| Allocation box | 1.5px ink, 22px padding | ink border, 22px |
| Avatar, owes you | mint | `rgb(191,235,210)`, initials `RS` |
| People tiles | — (undrawn) | 2, edges `rgb(191,235,210)` / `rgb(255,199,184)` |
| Form card | `6px 6px 0` + rail | matches, rail eyebrow present |
| Unbalanced | Alert, no stamp | stamp absent, alert `rgb(252,228,155)`, submit `disabled` |
| Reference on settle-up | — | `#FC7D5` |

### The state group 35 could not reach

With a real shared expense settled through this screen, the activity list returned badges
`["Split", "Split", "Settled", "Settled"]` — confirming group 35's `TypeBadge`/`SettlementBadge` pair
in a browser for the first time.

### Captured

People empty state, person form, all three person-detail states (settled, owes-you, after settling),
the people list, settle-up balanced and unbalanced, the settlements list and detail, the activity list
with both badges, the dashboard with a person balance, the archive confirmation, the people list at
393px, and settle-up at 393px in dark mode.

---

## 6. Known gaps

- **The settle-up header eyebrow is not built** (3.9). Deliberate; the artboard draws it.
- **The person create/edit forms, the people list and the settlements list are undrawn.** Composed from
  drawn components. **Designer review.**
- **The "you owe" direction of settle-up was not captured.** It needs a shared expense someone else
  paid, which the shared form can express but the seeded run did not exercise. The direction select
  appears only when both directions have outstanding amounts — also uncaptured.
- **`Stamp`'s `neutral` tone still has no call site.** `AUDITED · OK` is mentioned in 5.4 and appears
  nowhere.
- **The settlement detail page keeps group 32's reference row** and was not otherwise restyled beyond
  what group 28 did to its cards.
- **Two tiles on the people page is a judgement call.** The dashboard shows the same pair; a single net
  figure was rejected, but four tiles (gross and net both ways) was not tried.
- **Unreviewed by the designer:** the promoted "Settle up" header action, the unbadged `unsettled`
  state, the people tiles, and the reference placement on settle-up.

---

## 7. Notes for the next group

- **`Stamp` now has two call sites**, both with text beside them. A third must do the same.
- **`FormLayout` has seven consumers.** Group 39's category forms are inline rather than page-level, so
  they are the first that should **not** use it.
- **`SettlementSummaryView.referenceCode`** closes group 32's last gap — every money list in the app
  now shows a reference.
- **Group 39** should follow the "do not badge the default" rule for its archived categories, and reuse
  `StatusBadge kind="archived"`.
- **Group 40** should include: the mint and coral avatar fills with `content.onSwatch` in dark mode, the
  `neutral` avatar fill (`surface.sunken`, still the one non-bright fill), the stamp's `positive` on
  `surface`, and a keyboard walk of settle-up — a live amount field that rewrites several allocation
  fields beneath it is the most complex keyboard surface in the app.
- **Group 41** should capture `24-people`, `25-person-detail-owes-you`, `26-person-detail-you-owe`,
  `27-person-detail-settled`, `28-person-edit`, `10-people-empty`, `11-person-new`,
  `18-settlements-empty` and the settle-up screens afresh.
