# Group 37 — Accounts Screens

Four screens with no artboard, built from the component set the first sixteen groups produced.

---

## 1. What was built

The accounts list opens with four summary tiles on semantic edges — the same four figures the dashboard
shows, so a user moving between the two screens recognises them — then one bordered card per account
type with a mono heading above it. Every row carries the account's 32px identity swatch, its figure and
a word saying what the figure is.

The detail pages show the swatch and any archived badge above the title, a position card that adapts to
bank or card, a single-row activity link, and an inline archive confirmation. The create and edit forms
use the shared `FormLayout`, with the card-details fieldset as an inset block.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `tests/ui/accounts.test.tsx` | 9 tests. Higher stakes than usual — there is no artboard to check a screenshot against. |

### Changed

| File | Change |
| --- | --- |
| `src/app/(app)/accounts/page.tsx` | Totals as four `SummaryTile`s instead of a `DetailList`; the archived toggle as a `CardActionLink`; the available-credit hint follows the sign. |
| `src/app/(app)/accounts/[id]/page.tsx` | `AccountSwatch` + archived badge in the header's meta slot; the activity link is a full-width `RowLink` with a chevron. |
| `src/app/(app)/accounts/new/page.tsx`, `[id]/edit/page.tsx` | Card wrappers removed — `AccountForm` owns its layout. |
| `src/features/accounts/components/AccountList.tsx` | Eyebrow group headings; `AccountSwatch` per row; `StatusBadge kind="archived"`; a "balance" caption; coral card debt; badges stack below the name on a phone. |
| `src/features/accounts/components/AccountForm.tsx` | `FormLayout` + rail; 22px rhythm; the card-details fieldset as an inset block with a mono legend. |
| `src/features/accounts/components/AccountArchiveButton.tsx` | The inline confirmation restyled as an inset block. |
| `src/components/ui/StatusBadge.tsx` | New `archived` kind, and a per-kind `fg` override it needed. |

---

## 3. Key decisions

### 3.1 The totals are the dashboard's tiles, not a detail list

This screen is undrawn, so it borrows rather than invents. The same four figures — bank and cash, card
outstanding, available credit, net position — appear on the dashboard as tiles with semantic top edges,
and a user arriving here from there should meet the same objects. A `DetailList` would have been a
different reading of identical data.

The edges keep their meanings: teal for money held, coral for a liability, mint for headroom, sky for a
neutral computed figure.

### 3.2 `StatusBadge` gained a per-kind foreground, for one kind

Every other badge fill is one of the five swatch colours, which are bright in both palettes — which is
why `content.onSwatch` (ink in both modes) is safe on them. `archived` sits on `surface.sunken`, which
is **paper in light mode and `darkPaper` in dark**, so fixed ink would have vanished the moment the
theme flipped.

So `BadgeStyle` gained an optional `fg`, used once. The alternative — making every badge's foreground
explicit — would have removed the rule that makes the other six correct by construction. Its border
drops to `line.card` too: archiving is housekeeping, not news, and a full ink outline would shout.

### 3.3 Card debt is coral here as well

Group 34 reversed the pre-restyle "anything owed is just a fact" decision for the dashboard, following
the artboard. The list row now matches, with the same exception: **a card at zero reads in plain ink**,
because "₹0.00 owed" is good news. Over-limit stays carried by words — "Over limit · ₹x available" —
beside the colour.

### 3.4 Every row says what its figure is

A bank row's number could be a balance, a total or a limit. Adding the word "balance" under it costs a
line and removes the guess. It is also what stops the coral card figure being colour-only information,
which 9.1 forbids.

### 3.5 The badge stacks below the name on a phone

The same fix group 35 made in the activity list, applied before it could bite: a `StatusBadge` cannot
shrink, so sharing a row with a name crushes the name at 393px.

### 3.6 The available-credit hint follows the sign

Available credit goes negative when a card is over its limit, and "Still usable" beside "-₹10,097.00"
is a caption contradicting its own number. Found by rendering the page against an over-limit card. The
figure is correct either way; only the caption had to keep up.

### 3.7 The card-details fieldset is an inset block, and stays a real `<fieldset>`

`surface.sunken` with the soft card outline and a mono `<legend>` — the same treatment the split editor
and the archive confirmation get, because they are the same thing: a group of controls inside a card.
The native `fieldset`/`legend` pair is kept so the grouping is *announced*, not only drawn.

### 3.8 The activity link is a whole row

It was a small text link inside a card body. A full-width `RowLink` with a leading glyph and a trailing
chevron is far easier to hit on a phone and matches every other list row in the app.

### 3.9 The archive confirmation stays inline

No modal (9.1). It appears where the button was, so the question is asked in the place the answer
belongs, and the destructive option is `danger` with a plainly worded "Keep it" beside it.

---

## 4. Business rules enforced

- **Totals include archived accounts.** An archived account still holds money and still owes it.
  Excluding it would make the net position disagree with reality the moment anything was archived.
- **A credit card shows what is owed and what is left, never a signed balance.** "-₹20,097.00" is
  correct and the wrong thing to lead with.
- **Archiving is reversible and preserves history.** The confirmation says so in words: transactions
  are kept, the account leaves the pickers. Nothing is deleted.
- **Type cannot change after creation.** The edit form renders it read-only with a hint, because
  changing it would reinterpret every amount already recorded against the account.
- **An opening balance is a starting point, not a stored total.** The form's rail says so — every later
  figure is recomputed from it.
- **Over-limit is a fact, not a block.** The card still accepts spending; the alert and the badge
  report it.
- **A missing account and another user's account are indistinguishable** — both `notFound()`.
  Unchanged, and the point.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    611 pass
npx vitest run --project ui                          332 pass  (323 + 9)
npm run test:integration                             508 pass
npx vitest run --project offline                      150 pass
npm run build / npx eslint src tests                 clean
```

### Measured in Chromium

| | Expected | Measured (1440×1000) |
| --- | --- | --- |
| Summary tiles | four, semantic edges | 4: `rgb(127,209,195)`, `rgb(255,199,184)`, `rgb(191,235,210)`, `rgb(192,219,247)` |
| Group headings | mono eyebrow, 11px | `"IBM Plex Mono"`, `11px` ×3 |
| Row swatches | 32px, teal / mint / coral | `32`: `rgb(127,209,195)`, `rgb(191,235,210)`, `rgb(255,199,184)` |
| Form card | `6px 6px 0`, two columns | `rgb(30,27,41) 6px 6px 0`, `row`, rail eyebrow present |
| Card fieldset | mono legend, inset fill | `"IBM Plex Mono"`, `uppercase`, `rgb(250,247,242)` = `surface.sunken`, 3 inputs |
| Detail swatch | 32px, coral for a card | `32x32`, `rgb(255,199,184)` |
| Over-limit alert | coral | `rgb(255,199,184)`, "This card is over its credit limit." |
| Archive confirm | inset block | `rgb(250,247,242)` |
| Archived badge | quiet, not ink-on-swatch | `rgb(106,102,130)` = `content.subtle` |

Captured: the empty state, both forms, the card fieldset, validation errors, the card detail page, the
list with and without an over-limit card, the archive confirmation, the archived list, and the list at
393px in light and dark.

---

## 6. Known gaps

- **No artboard for any of these four screens** (section 10). Everything here is composed from drawn
  components, but the compositions themselves are unreviewed. **The whole group needs designer review.**
- **The detail pages keep a `DetailList` rather than tiles.** Deliberate — a single account's position
  is a set of labelled facts, not a set of headline figures — but it is a judgement call.
- **The archived-account alert and the over-limit alert can appear together.** Two stacked alerts is
  correct and untidy; the artboard has no example.
- **The `Manage` card holds one control.** It is a card for the sake of consistency with the transaction
  detail pages; a bare button would be lighter and less consistent.
- **The statement-day and payment-due-day fields are plain number inputs.** No day picker, and no
  validation beyond 1–31 — a 31st statement day in February is accepted and is a domain question
  nobody has asked yet.
- **Unreviewed by the designer:** the summary tiles on this screen, the `archived` badge, the whole-row
  activity link, and the negative-available-credit caption.

---

## 7. Notes for the next group

- **`StatusBadge kind="archived"`** is the quiet badge, and the only one with its own foreground. A
  future non-swatch fill must do the same or it will disappear in one of the two modes.
- **`FormLayout` now has five consumers.** Group 38's person and settle-up forms should be the sixth
  and seventh.
- **The "say what the figure is" caption** is the pattern for any bare money figure in a row. Group 38's
  people rows already do it through `BalanceBadge`.
- **Group 38** should give the person detail page the same shape this group gave the account detail page:
  identity in the header meta slot, a position card, a whole-row activity link, and an inline archive
  confirmation with its outstanding-balance guard.
- **Group 40** should include: `content.subtle` on `surface.sunken` (the archived badge — the one
  non-swatch badge fill), the tile hints, the "balance" captions, and a keyboard walk of the
  archive confirmation, which appears and disappears in place.
- **Group 41** should capture `06-accounts-empty`, `20-accounts`, `21-account-detail-bank`,
  `22-account-detail-credit-card`, `07-account-new`, `08-account-new-credit-card`,
  `09-account-new-validation-errors` and `23-account-edit` afresh.
