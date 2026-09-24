# Group 34 — Dashboard

The dashboard rebuilt against all four of its artboards, and the "computed" marker that states the
app's central rule on the page where it matters most.

---

## 1. What was built

Reading down a 1440px screen: page header with the `AS OF` render stamp, four quick actions each
carrying its own glyph, four summary tiles on semantic top edges, the net-position band on the accent
tint with an `= COMPUTED` marker, the spending breakdown with a category swatch per row, the accounts
card with type swatches, the two people panels with directional avatars, recent activity with
reference codes, and recent settlements.

On a 393px phone the quick-action row is gone — the handoff's mobile dashboard does not draw it, and
group 31's floating button replaced it — so the page header runs straight into a two-up tile grid.

Three things changed that were not strictly "styling": the spending breakdown needed a category icon
carried through the view model, `StatusBadge` gained an `overLimit` kind, and the recent-activity list
stopped being wrapped in a card body that inset its rows.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `src/features/dashboard/components/NetPosition.tsx` | The tinted band, the 28px figure, and the `equals` "computed" marker. |
| `tests/ui/dashboard.test.tsx` | 9 tests for the parts a screenshot cannot pin and the states a seeded browser run could not reach. |

### Changed — dashboard

| File | Change |
| --- | --- |
| `src/app/(app)/dashboard/page.tsx` | Uses `NetPosition` instead of a plain card; recent-activity header uses `CardActionLink`; the list is no longer wrapped in `CardBody`. |
| `src/features/dashboard/components/QuickActions.tsx` | Leading `Icon` per action, `size="lg"`, 7px gap. |
| `src/features/dashboard/components/SpendingSummary.tsx` | Headline figure in its own body block above a `CardList`; `CategorySwatch` per row; `CardActionLink`. |
| `src/features/dashboard/components/AccountBalances.tsx` | `AccountSwatch` per row; `StatusBadge kind="overLimit"`; `CardActionLink`; card debt now reads coral, as drawn. |
| `src/features/dashboard/components/PeopleBalances.tsx` | `Avatar` per row with the direction mapped from the balance; `CardActionLink`. |
| `src/features/dashboard/components/RecentSettlements.tsx` | `CardActionLink`. |
| `src/features/dashboard/view-models/dashboard-view-model.ts` | `DashboardCategorySpending.icon`. |
| `src/features/dashboard/queries/dashboard-queries.ts` | Carries `category.icon` through, from records already fetched for the names. |

### Changed — shared components

| File | Change |
| --- | --- |
| `src/components/ui/StatusBadge.tsx` | New `overLimit` kind — butter fill, `alert-triangle`, "Over limit". |
| `src/components/ui/AppLink.tsx` | `CardActionLink` gains `whiteSpace="nowrap"` and `flexShrink="0"`. |
| `src/features/transactions/components/TransactionList.tsx` | `RecentTransactionList` now renders a `CardList` with its own row padding, so rows reach the card's edges. |

`CardActionLink` was built in group 27 and had **no call site until now** — this group is what it was
for.

---

## 3. Key decisions

### 3.1 The "computed" marker earns its place

`Dashboard-Light.html` draws `equals` plus the word "computed" in teal at the right-hand end of the
net-position band. It would be easy to read that as a badge and drop it.

It is the opposite of a badge. Section 9.1 forbids anything implying a stored or cached total — no
"live" dot, no "last updated", no refresh affordance — and this says, in as many words, that the
number is the result of an equation recalculated during this render. It is the same claim the page
header's `AS OF` eyebrow makes about every other figure. Keeping it is keeping a product rule visible.

It is `aria-hidden`. "Computed" describes how the figure was produced, not what it is, and the label
above already reads "Net position — cash and bank minus what you owe on cards" — which *is* the
equation in words. A screen reader announcing "equals computed" after the amount would add nothing.

### 3.2 Net position is a band, not a fifth tile

It is the one figure on the page that is a *difference* rather than a total. It only means anything
once a card exists to subtract, its label has to state what was subtracted from what, and at 28px it
is the largest figure on the screen — the answer the four tiles build up to. A fifth tile could carry
none of that.

The foreground is `content.onTint`, not ink: `brand.muted` inverts lightness between colour modes
(`tealTint` light, `darkTealTint` dark), so ink on it measures 14.6:1 in one mode and 1.2:1 in the
other. This is the lesson group 28 wrote down as "a tint is not a swatch".

### 3.3 Card debt reads coral, reversing a pre-restyle decision

`AccountBalances` deliberately showed a card's outstanding balance in plain ink, with a comment:
"anything owed is just a fact, not an error". The artboard draws it in coral (`#D1523F`), and gives
the matching tile a coral top edge unconditionally. The design treats card debt as a liability on
sight.

Followed, with one condition the artboard has no example of: **nothing owed is not a liability**, so a
card at zero reads in plain ink rather than colouring "₹0.00" as bad news. Over-limit stays carried by
the badge, in words — colour is never the only signal.

### 3.4 `overLimit` is its own badge kind

It shares the butter fill and the `alert-triangle` with `partSettled`, so `<StatusBadge
kind="partSettled" label="Over limit" />` would have looked identical and saved a line. Rejected:
`kind` names the *meaning*, and an account condition relabelled as a settlement state is a lie the
label override cannot fix. The badge list is now three families — settlement status, record type, and
account condition.

### 3.5 The category icon goes through the view model

`CategorySwatch` derives colour from a category's **id** and its glyph from `Category.icon`, so the
breakdown needed the icon. It could have been fetched in the component; instead
`DashboardCategorySpending` carries it, from the same records the query already loads for the names —
no extra query, and the page still performs no lookups of its own.

The icon is carried **unresolved**. Resolving it in the view model would put a second resolver beside
the one in `features/categories/icon-map.ts`, and the point of that module is that a category looks
the same in a list, a picker and a chart.

### 3.6 Recent activity lost its `CardBody`

`RecentTransactionList` used a padded `Stack` inside a `CardBody`, which inset the rows from the
card's edges and left a blank band between the header rule and the first row. Every other card on the
page uses `CardList`, whose rows run full width and start immediately under the rule.

Now the list pads its own rows with the same values `CardList` uses and the page renders it directly.
The empty case keeps a `CardBody`, because a sentence *should* be inset.

### 3.7 The quick actions carry the shared glyph, not a local one

Each button's icon comes from `QUICK_ADD_ACTIONS`, the same list the mobile quick-add pills read. The
two affordances for the same four routes therefore cannot end up with different icons — which is the
reason that module exists.

`Button` still has no `leadingIcon` prop (group 27's decision): a child plus a `gap` says it with no
new API.

### 3.8 `CardActionLink` never wraps

At 393px "VIEW ALL" broke across two lines beside "Spending in September 2026", which made the header
look like it had a two-line action in it. `whiteSpace: nowrap` and `flex-shrink: 0` fix it at the
component, since every card header has the same shape.

---

## 4. Business rules enforced

- **Nothing on this page implies a cached total.** Checked by scanning the rendered page text for
  "live", "cached", "refresh", "last updated", "syncing" and "stale" — **zero matches** in both modes
  at both widths. The only freshness signal is `AS OF`, a render timestamp, and the net-position
  band's "computed".
- **Every figure is recomputed on load.** Unchanged by this group and now stated on screen. The page
  performs no arithmetic of its own; all seven blocks read formatted strings from the view model.
- **Spending means the user's own share, and excludes transfers and card payments.** The card's
  subtitle says so, because a user who has just moved ₹50,000 between accounts will otherwise wonder
  why the number did not move.
- **A credit card shows what is owed and what is left, never a signed balance.** "-₹15,000" is a
  correct signed value and the wrong thing to lead with. The row says `₹14,097.00` / "owed" with
  available credit in the subtitle.
- **Direction is never colour alone.** The two people panels pair a directional avatar fill with a
  `BalanceBadge` that states "owes you" or "you owe"; the account rows pair the figure with "owed" or
  "balance"; the over-limit card carries a worded badge.
- **The two people panels are split, not one signed list.** A single list forces the reader to decode
  a sign on every row, and getting that wrong is the most consequential misreading on the screen.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    611 pass
npm run test:integration                             508 pass
npx vitest run --project ui                          295 pass  (286 + 9)
npx vitest run --project offline                      150 pass
npm run build                                        clean
npx eslint src tests                                 clean
```

### Measured in Chromium against `Dashboard-Light.html`

| | Drawn | Measured (1440×900) |
| --- | --- | --- |
| Content width | 1360px | **1360** |
| `h1` | 32px | 30px (`pageTitle` — the token scale, see gaps) |
| Quick actions | 4, primary teal with `4px 4px 0`, others no shadow | 4, `rgb(127,209,195)` + `rgb(30,27,41) 4px 4px 0`, second `none` |
| Quick-action glyphs | one each | **4** |
| Tile edges | teal, butter, coral, mint | `rgb(127,209,195)`, `rgb(252,228,155)`, `rgb(255,199,184)`, `rgb(191,235,210)` |
| Tile figure | 24px | **24px** |
| Tile padding | `18px 20px` | **`18px 20px`** |
| Net position fill | `#DCF3EE` | `rgb(220,243,238)` |
| Net position figure | 28px | **28px** |
| "computed" | `#1D7A6C` | `rgb(29,122,108)`, and `aria-hidden` |
| Card action links | mono, uppercase, `#1D7A6C`, no underline | `"IBM Plex Mono"`, `uppercase`, `rgb(29,122,108)`, `none` |
| Account swatch | 32px | 32px × 2 |
| Category swatch | 20px | 20px |

At 393px, against `Mobile-Dashboard-Light.html`: quick-action grid `display: none`, tile figure
**19px**, tile padding `14px 16px`, net-position figure 24px, content width 393.

### All four artboards

Captured full-page at 1440×900 and 393×860, in light and dark. Dark mode matches
`Dashboard-Dark.html` and `Mobile-Dashboard-Dark.html`: tile edges keep their swatch hues, the
net-position band sits on `darkTealTint` with the teal marker still legible, the coral card figure
reads as `darkCoralText`, and the offset shadows flip to `darkInk`.

### What the browser run could not reach, and what covers it instead

The seeded run had no person with an outstanding balance — the shared-expense form needs a
participant checkbox that is fragile to drive, and the people screens are group 38's. So the two
people panels were verified in `tests/ui/dashboard.test.tsx`: the mint fill for "owes you", the coral
fill for "you owe", the initials, the direction stated in words beside the avatar, and the action link
disappearing when the panel is empty.

### The empty dashboard

Captured at both widths. The empty state, the "Record your first expense" call to action and the
accounts block all render; on a phone the quick-action row is correctly absent there too.

---

## 6. Known gaps

- **The `h1` is 30px, the artboard's is 32px.** 30px is `fontSizes.pageTitle`, set in group 22 from
  the type-scale table in section 4.2 — which the artboard's own header contradicts by 2px. The token
  won, because one page disagreeing with the scale is better than a scale with an exception in it.
  **Worth a designer's ruling.**
- **The spending breakdown was verified with one category.** The seeded expenses carried no category,
  so the row shown is "Uncategorised" with the hashed fallback swatch. The four-row case with four
  distinct swatch colours is drawn but has not been seen in the app. **Group 39** touches categories
  and should capture it.
- **Recent settlements was verified empty.** Needs a settlement, which needs a person with a balance —
  **group 38**.
- **Row descriptions are still service-generated.** The card-payment row reads "Credit card payment"
  where the artboard reads "Part payment". That is the description the card-payment service writes,
  not a styling question, and it is the kind of copy **group 36** should look at when it rebuilds that
  form.
- **The net-position marker stacks below the figure on a phone.** The artboard has no mobile
  net-position band to compare with, so the column layout below `md` is ours.
- **Unreviewed by the designer:** coral card debt replacing the previous plain ink (3.3), the
  `overLimit` badge (3.4), and the mobile net-position stacking.

---

## 7. Notes for the next group

- **`CardActionLink` is the card-header action.** Every card on the dashboard now uses it. `AppLink`
  is for links in prose; `RowLink` is for a whole row. A card header action in `AppLink` is a bug from
  here on.
- **`RecentTransactionList` pads its own rows.** Do not wrap it in a `CardBody`. Same for anything new
  that renders a `CardList`.
- **Group 35 (activity and transaction detail)** shares `TransactionList.tsx` with this page. The
  dashboard variant is the flat one; the grouped variant still has the pre-restyle row and needs the
  type swatch and badges. Keep reference-before-amount in the grouped list and reference-below-amount
  in the flat one — the two artboards genuinely differ.
- **Group 36 (transaction forms)** owns the auto-generated descriptions that show up in recent
  activity, and the card-payment copy in particular.
- **Group 38 (people and settlements)** gets the two dashboard panels for free — they already render
  avatars and balances — but should capture the dashboard once a person has a balance, which is the
  state neither the browser run nor the artboard comparison has covered.
- **Group 39 (categories)** should recapture the spending breakdown with four categorised rows.
- **Group 40** should include the tile hint text (`content.subtle` on `surface`), the `content.onTint`
  label on `brand.muted` in both modes, and the coral figure on `surface`, and keyboard-walk the four
  quick actions plus every card action link.
- **Group 41** should recapture `19-dashboard` and `05-dashboard-empty` at both widths — the existing
  screenshots predate every group from 22 on.
