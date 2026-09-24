# Group 36 — Transaction Forms

The four transaction forms rebuilt to `AddExpense-Light.html`: an emphasised card with a side rail
beside it, the reference of the record about to be written, and the split editor's running total
stated against the amount rather than on its own.

---

## 1. What was built

A shared two-column form shell. The form is the emphasised card — 2px ink, 6px offset shadow, 36/40
padding — and beside it a rail holding the "why this matters" tint panel and the reference box that
shows the code the record will carry, marked `· draft` when the save is going to the offline queue. On
a phone the two stack and **the rail comes after the form**.

Every form's page header now offers the other three record types, so a user who started an expense and
realised it was a transfer can say so. The split editor is an inset fieldset whose footer reads
`Allocated ₹3,200.00 of ₹4,800.00` with a tick when they match. The four prerequisite guards are
warning alerts that render *instead of* the form.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `src/components/ui/FormLayout.tsx` | `FormLayout`, `TintPanel`, `ReferenceBox` — the two-column shell and both rail panels. |
| `src/features/transactions/components/FormSwitcher.tsx` | "The other three record types", in a form's page header. |
| `tests/ui/transaction-forms.test.tsx` | 11 tests: source order, the tint foreground, the switcher's label exception. |

### Changed — forms

| File | Change |
| --- | --- |
| `src/features/transactions/components/ExpenseForm.tsx` | Renders `FormLayout` with its own rail; the inline reference from group 32 moved into the rail; Paid from + Category two-up; date capped at 260px; 22px field rhythm. |
| `src/features/transactions/components/TransferForm.tsx` | `FormLayout` + rail; the "not spending" sentence moved from the form's foot into the rail. |
| `src/features/transactions/components/CardPaymentForm.tsx` | Same, plus "Pay full balance" restyled and **no longer offered on a card at zero**. |
| `src/features/transactions/components/SharedExpenseForm.tsx` | Same. |
| `src/features/transactions/components/SplitEditor.tsx` | Inset block on `surface.sunken`; new `SummaryRow`; the running total now reads *against* the amount. |

### Changed — pages

| File | Change |
| --- | --- |
| `src/app/(app)/transactions/new/page.tsx` and the three siblings | Card wrapper removed (the forms own it); `FormSwitcher` in the header. |
| `src/app/(app)/transactions/[id]/edit/page.tsx` | Card wrappers removed; no switcher on an edit screen. |

### Changed — detail pages

| File | Change |
| --- | --- |
| `src/features/transactions/components/ExpenseDetail.tsx` | `ExplainerNote` deleted — it was group 35's stop-gap for the same panel. |
| `src/features/transactions/components/TransferDetail.tsx`, `CardPaymentDetail.tsx` | Use `TintPanel` instead. |

---

## 3. Key decisions

### 3.1 The rail comes after the form in **source order**

Section 8 stacks the rail below the form on a phone. Done with source order and a responsive
`flex-direction`, not an `order` property — `order` moves pixels and leaves the tab sequence behind,
and the rail is explanation a keyboard user would then have to tab through before reaching the amount
field. Pinned by a test that compares the two indexes in the rendered HTML.

### 3.2 The form renders the layout, not the page

The obvious shape was for each page to render `FormLayout` and pass the form into it. It cannot work:
**the rail shows the reference of the record about to be written, and that comes from the `clientId`
the client component generates.** A page is a Server Component and cannot know it.

Generating the id on the server instead was considered and rejected. It would put a fixed `clientId`
in the page's HTML, and the server's create path is idempotent on that id — so a cached add-expense
page replayed twice, which is exactly what the service worker makes possible offline, would produce
one expense where the user recorded two.

So the forms own both columns, and the pages are a `PageHeader` plus a form. The guards fall out of
this correctly: a "add an account first" warning now renders *instead of* the layout rather than inside
a form card, which is what it always should have done.

### 3.3 The reference appears once, in the rail

The artboard shows it twice — as a `Record · TXN-08232` eyebrow above the page title, and in the rail's
reference box. Only the rail box is built.

The eyebrow carries no information the box does not, and putting it in the page header would push a
client boundary onto four server-rendered pages for a repeat. The rail box is also the only place in
the app that explains what the code *is*, which is why its `hint` is a required prop rather than an
optional one.

### 3.4 `TintPanel` replaced `ExplainerNote` rather than sitting beside it

Group 35 built `ExplainerNote` in `ExpenseDetail.tsx` for the "not spending" note, and flagged
promoting it when a third consumer arrived. The rail is that consumer, and it is the same panel from
section 8 — so there is one component with an optional eyebrow, not two tints that can drift.

The foreground is `content.onTint` throughout, never ink: `brand.muted` inverts lightness between
colour modes, so ink on it measures 14.6:1 in one mode and 1.2:1 in the other.

### 3.5 The running total is stated **against** the amount

The footer read `Allocated ₹3,200.00`. A custom or percentage split that does not add up is rejected
outright — the server will not absorb the difference — so the useful figure is the gap, and a bare
allocated total leaves the reader to subtract. It now reads `₹3,200.00 of ₹4,800.00`, gains a tick and
`positive` colour when they match, and states the rule in words when they do not.

The percentage mode gets the same treatment against 100%. Both comparisons use `Number()` **only to
choose a colour and a tick** — the decimal arithmetic that decides whether the split is accepted is
the server's, as it was.

A `safeFormat` helper wraps `money()` because the amount field is a live value: while someone types
"48" on the way to "4800" it passes through states `money()` rejects, and the footer should skip the
comparison for a frame rather than crash the form.

### 3.6 "Split instead", and only there

The switcher reads `Split instead` where every other route to that form says `Split a bill`. Group 21
settled it (2.7): in a header beside a form you have already begun, "instead" is the whole point of the
control; on a dashboard with nothing in progress there is no "instead" to speak of.

Implemented as a one-entry override map keyed by href, so the exception is named in one place rather
than being a free hand to reword any of the four. The dashboard's wording is asserted untouched in the
same test.

### 3.7 No switcher on an edit screen

Offering "Transfer instead" while editing an existing expense would invite a conversion this app does
not do — a record's type is fixed once written. The edit screens also get no `TintPanel`: the
explanation is about *recording*, and someone who opened an existing record to fix a typo has read it.
They keep the reference box, which says the code survives the edit.

### 3.8 "Pay full balance" is not offered on a card at zero

Found by rendering the form against a card with no spending on it: the shortcut read
`Pay full balance (₹0.00)` and would have filled the amount with a value the server rejects. It now
requires an outstanding balance above zero, not merely the presence of a figure.

It also moved from `ghost` to `secondary`. Ghost reads as a link, and this is an action that changes a
field's value.

### 3.9 Paid from and Category are two up

As drawn. They are both "which bucket", they are the shortest controls on the form, and pairing them
keeps the amount and the description — the two fields that actually get typed into — full width above.
One column below `md`.

The date input is capped at 260px on desktop, also as drawn: a date field stretched across a 700px card
looks like it is expecting something longer than a date.

---

## 4. Business rules enforced

- **A form never appears when its prerequisites are missing.** All four guards render a warning alert
  *instead of* the form — verified with no `<form>` in the document: no account for an expense, no
  person for a split, fewer than two accounts for a transfer, no card or no funding account for a card
  payment. A form that cannot be submitted is worse than an explanation.
- **A card payment's destination is only ever a credit card, and a transfer's never is.** Unchanged,
  and still only a convenience — `domain/transactions/transfer-rules.ts` is the guarantee.
- **Overpaying a card is warned about, never blocked.** The user really did pay that money; refusing to
  record it would make the app disagree with their bank statement.
- **A split that does not add up is visible before submission**, and the footer says which rule is
  broken rather than only colouring the figure.
- **When somebody else paid, no account of the user's is charged.** The account picker disappears and a
  cleared hidden field goes with the form, so switching payer mid-edit cannot leave a stale account.
- **A reference survives an edit**, which the edit screens' rail says in words.
- **Cancel is reachable on every form.** Measured on all four at 1440px and 393px: same row as the
  submit, inside the card, non-zero width. This is the bug group 27 fixed and this group re-checked
  after moving every form into a narrower column.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    611 pass
npm run test:integration                             508 pass
npx vitest run --project ui                          323 pass  (312 + 11)
npx vitest run --project offline                      150 pass
npm run build                                        clean
npx eslint src tests                                 clean
```

### Measured in Chromium against `AddExpense-Light.html`

| | Drawn | Measured (1440×1000) |
| --- | --- | --- |
| Columns | `flex: 1.4` / `1`, gap 24px | **733px / 523px** = 1.40, gap `24px` |
| Form card | 2px ink, `6px 6px 0`, padding `36px 40px` | `2px`, `rgb(30,27,41) 6px 6px 0`, **`36px 40px`** |
| Rail | column, gap 16px | gap `16px` |
| Tint panel | `#DCF3EE`, 1.5px, padding 22px | `rgb(220,243,238)`, `22px` |
| Tint body | `#4A465B` | `rgb(74,70,91)` = `inkOnTint` |
| Reference box | white, "Reference" + code + hint | `rgb(255,255,255)`, `Reference #E933A Kept for the life…` |
| Amount prefix | `₹` at left 14px, 19px | `left 14`, `19px`, **`z-index: 1`** |
| Paid from + Category | side by side | same row: **true** (and false at 393px) |
| Actions | submit `flex: 1`, Cancel beside it | submit 532px, Cancel inside the card, same row |
| Switcher | Split instead · Transfer · Pay card | exactly those three |

At 393px: column, **rail below the card**, card padding `24px 20px`, the pair stacked, Cancel still
inside the card at 353px against a 357px card.

The `₹` prefix reporting `z-index: 1` is the group 33 fix holding — this is the first time the amount
field has been re-measured since the prefix became visible at all.

### The other three forms

Transfer and card payment measured identically (same shell, same rail). Card payment's shortcut:
`secondary` fill, 2px border. Split editor: inset background `rgb(250,247,242)` = `surface.sunken`, and
the footer read `Allocated ₹4,800.00 of ₹4,800.00` after typing 4800 with one participant.

### Guards and validation

All four guards render on butter `rgb(252,228,155)` with **no form in the document**. An empty submit
marks the amount field invalid with `rgb(209,82,63)` = `negative`.

### Both modes, both widths

Add expense captured at 1440×1000 and 393×900 in light and dark; the other three at 1440px; the shared
form at both widths.

---

## 6. Known gaps

- **The page-header reference eyebrow is not built** (3.3). Deliberate; the artboard draws it.
- **The notes textarea keeps a vertical resize handle.** The artboard sets `resize: none`. Resizing is
  a usability win and the handle is the only visible difference. **Designer review.**
- **The date input uses the browser's native calendar indicator**, not the registry's `calendar` glyph
  that the artboard draws. A native `<input type="date">` indicator cannot be replaced cross-browser
  without giving up the native picker, which `DESIGN.md` is explicit about keeping. **This is why
  `calendar` has no call site** — worth recording for group 41, which was going to ask.
- **Income has no form.** Out of MVP scope; the type exists in the model and the activity list renders
  it.
- **The split editor's participant rows were not compared against an artboard** — none exists. The
  method select, the per-person amount fields and the "Include yourself" button are all ours.
- **Offline is only wired on the personal expense form.** So `· draft` still has exactly one call site,
  and the rail's draft state is unreachable on the other three.
- **Unreviewed by the designer:** the omitted header eyebrow, the textarea handle, "Pay full balance"
  as a `secondary` button, the split footer's `of ₹X` phrasing and tick, and the absence of a rail on
  the edit screens.

---

## 7. Notes for the next group

- **`FormLayout` is the form-page shell, and it belongs to the form, not the page.** If a form needs a
  rail, the form renders the layout. **Group 37** (accounts) and **group 38** (people, settle-up) should
  use it; both have something worth explaining beside the fields.
- **`TintPanel` is the one tint panel.** With an eyebrow in a rail, without one inside a card. Do not
  add a second.
- **`ReferenceBox` requires its `hint`.** It is the only place a user is told what a reference code is.
- **A guard renders instead of the form, not inside it.** Four examples now.
- **`FormSwitcher` reads `QUICK_ADD_ACTIONS`.** A fifth record type would appear in the dashboard row,
  the mobile quick-add and every form header from one edit.
- **Group 38** should check `SettleUp-Light.html` for a rail of its own — it draws a
  `Settlement · STL-0412` eyebrow, which is the same reference-box content this group built.
- **Group 40** should include: `content.onTint` on `brand.muted` in both modes, the rail's hint text
  (`content.subtle` on `surface`), the split footer's `positive` figure, and a keyboard walk of the
  add-expense form — nine controls, a two-up grid, and a Cancel that must stay reachable.
- **Group 41** should recapture `14-expense-new-needs-account` and the four form screenshots, and can
  record `calendar` as intentionally unused (see gaps).
