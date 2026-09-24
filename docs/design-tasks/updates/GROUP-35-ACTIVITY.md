# Group 35 — Activity And Transaction Detail

The activity list rebuilt to `Activity-Light.html`, the four detail pages restyled, and the
crushed-title bug found in a second place.

---

## 1. What was built

The activity screen is now one bordered card per day with a mono date above it. Each row carries a
26px outlined swatch holding the record's own glyph, the description and its account/category line,
badges for what the record is and where it stands, and a right-hand cluster of reference code then
amount — with `₹1,600.00 of ₹4,800.00` kept as two figures on a split.

Above the list: search, an ink-filled Search button, and a filter toggle that says how many filters
are active **without being opened** — becoming the dashed teal chip with the diamond marker when
something is. Below it: the end-of-ledger notice, mono and tracked.

The four detail pages carry the same badges the list rows do, and the transfer and card-payment pages
explain in a tinted panel that the record is not spending. Both not-found pages moved onto
`EmptyState` with a mono status eyebrow.

**The bug worth reading about is section 3.6** — at 393px a badge crushed the description to a single
character, which is section 9.2's crushed-title bug in a place nobody had looked.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `tests/ui/activity.test.tsx` | 17 tests, mostly about which badges appear on which record and that a plain expense gets none. |

### Changed — the list

| File | Change |
| --- | --- |
| `src/features/transactions/components/TransactionList.tsx` | Day eyebrow outside the card, `CardList` rows, `TransactionTypeSwatch`, `TypeBadge`/`SettlementBadge` on `StatusBadge`, the share-of-total pair, and the responsive badge stacking. |
| `src/features/transactions/components/TransactionFilters.tsx` | One search row; `tone="contrast"` Search; new `FilterToggle` with the dashed active state. |
| `src/features/transactions/components/TransactionHistory.tsx` | Threads `categoryIcons`; the end-of-list notice restyled. |
| `src/features/transactions/queries/expense-queries.ts` | `TransactionListView.categoryIcons`. |
| `src/app/(app)/transactions/page.tsx` | Passes `categoryIcons`. |

### Changed — detail and not-found

| File | Change |
| --- | --- |
| `src/features/transactions/components/ExpenseDetail.tsx` | `StatusBadge` header chips, `Avatar` participant rows, new exported `ExplainerNote`, `NotesBlock` restyled. |
| `src/features/transactions/components/TransferDetail.tsx` | Type badge; the "not spending" note moved into `ExplainerNote`. |
| `src/features/transactions/components/CardPaymentDetail.tsx` | Same. |
| `src/app/(app)/not-found.tsx`, `src/app/not-found.tsx` | Rebuilt on `EmptyState` with a status eyebrow. |

### Changed — shared components

| File | Change |
| --- | --- |
| `src/components/ui/Button.tsx` | New `tone="contrast"` — ink fill, inverted label, no shadow. |
| `src/components/feedback/EmptyState.tsx` | Optional `eyebrow`. |

---

## 3. Key decisions

### 3.1 One card per day, with the date outside it

`Activity-Light.html` draws a bordered card per day group with a mono date **above** it, not one long
card with date rows inside. The date is a divider rather than a row, and giving each day its own
container is what makes a day's rows read as a unit.

The label stays an `h2` labelling a `section`, so a screen-reader user can move day by day instead of
scrolling one undifferentiated list. It uses `content.subtle`, not the eyebrow default of
`content.muted`: it is quieter than a field label.

### 3.2 Badges come from `StatusBadge`, and the default is unbadged

The row previously hand-rolled three Chakra `Badge`s with their own fills. They are now `StatusBadge`,
so a settled split looks the same in the list, on the detail page and on the person screen.

A plain personal expense gets **no badge**. That is the same rule the settlement badge already
followed — most rows are personal expenses, and saying so on every one of them is noise that hides the
exceptions. A shared expense gets **two**: `Split` states what the record is, `Part settled` states
where it stands, exactly as drawn.

### 3.3 The type swatch is outlined, not filled

The third swatch case in the design, and the one that looks like the other two. A category or account
swatch is filled with colour; a transaction-type swatch is `surface` with an ink outline (6.4), because
the colour on this row belongs to the badges. An expense borrows its **category's** glyph, so a column
of activity is readable as groceries, transport, bills at a glance.

### 3.4 `categoryIcons` is a lookup map, not a field on the row

It sits beside `categoryNames` in the view, for the same reason: the icon belongs to the category, and
copying it onto every row that shares one is a second copy to keep honest. It is carried
**unresolved** — `features/categories/icon-map.ts` stays the only place that decides what an icon
string means. Built from the records the query already fetches for the names, so it costs no query.

### 3.5 `tone="contrast"` for Search

The artboard's Search button is solid ink with inverted text and no shadow — neither the teal primary
nor the white secondary. A new tone rather than a call-site override, because `tone` is this project's
vocabulary for what an action *means*, and this one means "commits something, but is not the page's
primary action": the primary is "Add expense" in the header, and a second teal button directly below
it would give one screen two primaries. `secondary` would leave the search row with no obvious commit.

No shadow, as drawn — the offset shadow is what marks the page's primary action, and the ink fill is
already the heaviest thing in the row.

### 3.6 The bug: a badge crushed the description at 393px

At 402px this was the *page header* bug that section 9.2 exists for. At 393px it was the row.

A `StatusBadge` cannot shrink — it is `nowrap` with a fixed border — so in a row that shared its width
with the description, the badge took its space first. Measured: "Cash withdrawal" rendered as `C…` over
`HD…` in about 90px. The fix is the one `PageHeader` already uses: **stop sharing the row below the
breakpoint.** The badges sit beside the description above `md` and below it on a phone.

One DOM position with a responsive `direction`, not two copies with one hidden — rendering the badges
twice would have a screen reader announce every one of them twice.

That exposed a second, subtler fault. With `direction: column` the wrapper had `align-items:
flex-start`, which sizes each child to its **content** width — so the truncating text was unbounded and
the meta line ran out of the row and *underneath* the reference code. `align: stretch` on the stacked
axis binds it to the row's width so `truncate` has something to truncate against, and `flex="1"` on the
left cluster makes it claim the space the amount cluster leaves rather than overflow into it.

After: every description renders in full or ellipsises cleanly, and nothing overlaps.

### 3.7 The filter toggle carries its own state

A collapsed panel that hides the fact that two filters are narrowing the list is how a user comes to
believe they have lost transactions. So the closed state reads `Filters · 2 active`.

When something is active it becomes the dashed teal chip with the 8px diamond — the audit motif
reserved for exactly this (5.4). Dashed appears in only two places in the whole design, here and on
`Stamp`, which is what makes it register as "provisional" rather than as decoration. When nothing is
active it is an ordinary secondary button: a dashed teal chip reading `Filters · 0 active` would be an
alarm about nothing.

The marker is solid `brand.fg` rather than the mark's usual teal fill with an ink border — at 8px
inside a teal chip the two-tone version reads as a smudge.

### 3.8 `ExplainerNote` reuses the "why this matters" tint panel

The transfer and card-payment pages both have to say, in words, that the record is **not spending**. A
user looking at a ₹10,000 movement needs to be told it is absent from their monthly total; the
alternative is noticing that the dashboard number did not change, which is worse.

Section 8 names the tint panel for the form side rails, and it is the right device here too. Exported
from `ExpenseDetail.tsx` beside `NotesBlock`, which the two pages already share. `content.onTint`, not
ink, because `brand.muted` inverts between colour modes.

### 3.9 The not-found pages get a status eyebrow, not a big "404"

`EmptyState` gained an optional `eyebrow`, and the two not-found pages use `RECORD NOT FOUND` and
`ERROR 404`. That is the ledger register doing the work an illustration would do elsewhere — the same
voice as the `AS OF` stamp and the end-of-list notice.

Optional, deliberately: an empty *list* is not a condition, it is a list with nothing in it, and
stamping it would overstate the case.

`Stamp` was not used. Group 28 gave it `positive` and `neutral` tones only, and adding an error tone
for a 404 would undo that decision from the wrong end.

### 3.10 The search field keeps its visible label

The artboard has no label above the search input — placeholder only. The visible mono label was kept:
every other field in the app has one, and a placeholder-only field loses its name the moment anything
is typed. Recorded as a divergence in section 6.

---

## 4. Business rules enforced

- **The three amounts on a shared expense stay distinct** (9.1). The list row keeps
  `₹1,600.00 of ₹4,800.00`; the detail page keeps Amount, Your share, and each participant's share in
  the "Split between" card. Collapsing any two of them leaves "did this cost me ₹4,800 or ₹1,600?"
  open, which is the misreading these screens exist to prevent. "Your share" only renders when it
  differs, so a personal expense is not padded with a row repeating the line above it.
- **A record with nothing to settle carries no settlement badge.** `settlementStatus` is null for a
  personal expense — it creates no obligations — and a row reading "Unsettled" would be describing a
  debt that does not exist.
- **A transfer and a card payment are not spending, and both pages say so.** Neither appears in the
  monthly total, and the tinted note states it rather than leaving the user to infer it from a number
  that did not move.
- **Two accounts read as a direction, not a list.** `HDFC Savings → Cash wallet`, because the
  direction is the whole meaning of a transfer.
- **Colour is never the only signal.** Every badge is a word with a glyph; the share-of-total is two
  labelled figures; the filter chip says "1 active" as well as turning teal.
- **An active filter is visible without opening the panel**, so a narrowed list is never mistaken for
  a shorter ledger.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    611 pass
npm run test:integration                             508 pass
npx vitest run --project ui                          312 pass  (295 + 17)
npx vitest run --project offline                      150 pass
npm run build                                        clean
npx eslint src tests                                 clean
```

### Measured in Chromium against `Activity-Light.html`

| | Drawn | Measured (1440×900) |
| --- | --- | --- |
| Day label | 11px mono, `#8B87A0`, 0.09em, 10px above the card | `11px`, `rgb(106,102,130)`, `0.99px`, gap **10** |
| Day card | 1.5px `rgba(30,27,41,0.18)`, no shadow | `rgba(30,27,41,0.18)`, `none` |
| Row padding | `16px 24px` | **`16px 24px`** |
| Type swatch | 26px, white, 1.5px | **26×26**, `rgb(255,255,255)` |
| Badge | 10px mono on `#C0DBF7` | `10px` on `rgb(192,219,247)` |
| Search button | `#1E1B29` fill, `#FAF7F2` label, no shadow | `rgb(30,27,41)`, `rgb(250,247,242)`, `none` |
| Filter chip, active | 1.5px dashed `#1D7A6C` | `dashed`, `rgb(29,122,108)`, label `Filters · 1 active`, 1 marker |
| Filter chip, inactive | — (not drawn) | `solid`, ink — an ordinary secondary button |
| End-of-list | centred mono, uppercase, `#8B87A0` | `"IBM Plex Mono"`, `uppercase`, `center`, `rgb(106,102,130)` |
| Reference vs amount | reference first, 14px gap | reference before amount: **true** |

The greys are group 21's AA replacements, not the artboard's `#8B87A0`/`#B4B0C4`.

### At 393px

Before the fix: `Cash withdrawal` → `C…`, meta → `HD…`, and the meta line overlapping the reference
code. After: descriptions measured at 125–170px, rendering in full or ellipsising cleanly, badges on
their own line, no horizontal overflow, and the search row stacked.

### Detail pages and not-found

Card payment: type badge present, the explainer note on `rgb(220,243,238)` with `rgb(74,70,91)`
(`inkOnTint`), and the Reference row in the Record card. Captured the personal-expense and
card-payment pages, both not-found pages, and the list in dark mode.

Global 404 confirmed to carry its own `main#main` — it sits outside the `(app)` group, so
`SkipToContent` has nothing else to target — and to read `Error 404 / Page not found`.

---

## 6. Known gaps

- **The search field keeps a visible label the artboard does not draw** (3.10). Deliberate, and worth
  a designer's ruling.
- **No mobile activity artboard exists.** The badge stacking, the stacked search row and the
  truncation behaviour at 393px are all ours.
- **Row descriptions are still service-generated.** The card-payment row reads "Credit card payment"
  where the artboard reads "Part payment". **Group 36** owns that copy.
- **The category-glyph path was verified by unit test, not on screen.** The seeded browser run used
  `recordPersonalExpense`, which sets no category, so every expense row showed the `ellipsis`
  fallback. `resolveTransactionIcon` is covered in `icon-map.test.ts` and the swatch renders, but a
  screen with four distinct category glyphs has not been captured. **Group 39** should do it.
- **No shared-expense row or detail page was captured in a browser.** The participant checkbox on the
  shared-expense form is fragile to drive; the badges, the share-of-total pair and the `Avatar`
  participant rows are covered by `tests/ui/activity.test.tsx` instead. **Group 38** reaches this
  state naturally.
- **The expanded filter panel was not restyled beyond its container.** The seven fields inside it are
  `Field` primitives already, and the panel is a plain bordered box; the artboard never opens it.
- **`Stamp` still has no call site.** Group 38 places the `BALANCED` stamp.
- **Unreviewed by the designer:** the `contrast` tone (3.5), the inactive filter button (3.7), the
  mobile badge stacking (3.6), `ExplainerNote` (3.8), and both not-found pages (3.9).

---

## 7. Notes for the next group

- **`tone="contrast"` exists now.** Ink fill, inverted label, no shadow. Use it for a commit that is
  not the page's primary action. There is exactly one call site; a second should have the same reason.
- **A badge in a row must not share width with text below `md`.** `StatusBadge` cannot shrink. Stack
  it, and use `align: stretch` on the stacked axis or the truncating text beside it will overflow
  instead of ellipsising — the two halves of 3.6.
- **`ExplainerNote` is exported from `ExpenseDetail.tsx`.** Group 36's side rail wants the same tint
  panel; consider promoting it to `components/ui` when there is a third consumer.
- **`EmptyState` takes an `eyebrow`.** Use it for a *condition*, not for an empty list.
- **Group 36 (transaction forms)** owns the auto-generated descriptions, and should check the amount
  field's spacing now that the `₹` prefix is visible for the first time (group 33).
- **Group 38 (people and settlements)** is the first group that can reach a shared expense with a
  settled or part-settled state in a browser. When it does, capture an activity row and an expense
  detail page with both badges — this group could not.
- **Group 39 (categories)** should capture the activity list with four distinct category glyphs.
- **Group 40** should include: the day eyebrow and meta line (`content.subtle` on `surface`), the
  reference code at 11px, `content.onTint` inside `ExplainerNote`, the `contrast` tone's inverted
  label on ink, and the dashed chip's `brand.fg` on `surface`. Also keyboard-walk the search row —
  three controls in one form — and confirm the filter toggle's `aria-expanded` is announced.
- **Group 41** should recapture `13-activity-empty` and the activity and detail screenshots; all of
  them predate this group.
