# Group 39 — Categories Screen

The category tree with swatches, and the icon picker group 21 decided on.

---

## 1. What was built

Each category row now carries the swatch it shows everywhere else in the app — colour derived from its
id, glyph from its `icon` — with a single 24px indent for the one level of nesting the model allows and
a smaller swatch on children. Adding and editing happen inline, in place, on an inset block.

The form gained an icon picker: eighteen 44px tiles as a real radio group, writing a registry name into
the `icon` field that already existed. There is no colour input, because the colour is derived and
cannot be got wrong.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `src/features/categories/components/CategoryIconPicker.tsx` | The picker. |
| `tests/ui/categories.test.tsx` | 7 tests, all about the radio-group contract. |

### Changed

| File | Change |
| --- | --- |
| `src/features/categories/icon-map.ts` | New `CATEGORY_ICON_CHOICES` — the curated subset the picker offers. |
| `src/features/categories/components/CategoryForm.tsx` | 22px rhythm; renders the picker. |
| `src/features/categories/components/CategoryManager.tsx` | `CategorySwatch` per row, `StatusBadge kind="archived"`, one-level indent, inline forms as inset blocks. |
| `src/app/(app)/categories/page.tsx` | Archived toggle as a `CardActionLink`. |
| `src/config/constants.ts` | `DEFAULT_CATEGORIES` now uses registry names rather than lucide names. |
| `src/features/categories/icon-map.test.ts` | Two tests pinning the defaults and the picker's list against the registry. |

---

## 3. Key decisions

### 3.1 An icon picker, and deliberately no colour picker

Group 21 (2.3) rejected adding a `Category.color` field and chose an icon picker instead. The colour
comes from an FNV-1a hash of the category's **id**, so it is stable across renames and cannot be got
wrong; the glyph is the one visual choice a user has an opinion about, and `Category.icon` already
existed as free text to hold it. No migration, no schema change.

The picker says so in a hint — "The colour is chosen for you and stays the same for this category" —
because a user who sees an icon picker will otherwise go looking for the colour one.

### 3.2 A real radio group, not a grid of buttons

`role="radiogroup"` with native radios gives one tab stop for the whole set, arrow-key navigation
between options, and a group name — three things a grid of `<button>`s would have to reimplement, and
the roving tabindex is the part that usually goes wrong.

The inputs are positioned and transparent, **not** `display: none`: hiding them that way takes them out
of the accessibility tree and off the keyboard, which is the standard way this pattern is broken. A test
asserts it.

The group is named with `aria-labelledby` rather than a `<label htmlFor>` — a label may only point at a
form control, and the group is a `div`.

### 3.3 Eighteen glyphs, not forty-three

The registry holds navigation glyphs, control glyphs (`chevron-down`, `edit`) and state glyphs
(`offline`, `check`). Offering `chevron-down` as a category icon would be offering nonsense.
`CATEGORY_ICON_CHOICES` is the set that can plausibly *mean* a kind of spending, ordered so the common
choices are in the first row.

It lives in `icon-map.ts`, not beside the component, for a reason group 25 wrote down: the `unit` test
project has no React transform, so importing a `.tsx` from `icon-map.test.ts` fails to parse. **Pure
data belongs in the pure module** — and this was rediscovered the hard way, by putting it in the
component first and watching the test file refuse to load.

### 3.4 Selection is the design's own emphasis, not a colour

A selected tile gets the full ink border, the `hardSm` offset shadow and the accent tint; an unselected
one has the soft outline and no shadow. Measured: `3px 3px 0` ink, `rgb(30,27,41)` border,
`rgb(220,243,238)` fill.

Not a colour change, deliberately: the category's swatch colour is derived from its id, so tinting the
tile with a colour here would promise a colour the category will not have.

### 3.5 Tiles are packed, not gridded

The first attempt used `SimpleGrid`, which stretched each tile to its column — measured **130×44** at
1440px, turning a row of square swatches into wide rectangles that no longer previewed anything. A
wrapping flex row of fixed 44px tiles keeps every tile square at every width. Found by measuring, not
by reading the code.

### 3.6 An unoffered stored icon is kept, not rewritten

A category whose `icon` is a name the picker does not offer — a lucide name from before this existed, or
one the registry renamed — shows as unselected and keeps its stored value. Silently rewriting it to the
fallback on first edit would change data the user never touched.

### 3.7 `DEFAULT_CATEGORIES` now holds registry names — a cleanup, not a fix

The nine defaults were seeded with lucide names: `utensils`, `shopping-bag`, `film`, `heart-pulse`,
`house`. **Nothing was broken.** Group 25 built `STORED_NAME_ALIASES` for exactly this, and all nine
resolved correctly — verified in a browser: nine categories, nine *distinct* glyphs.

They were changed anyway, because an alias table should be a migration concern for old data rather than
the mechanism by which rows the app creates today render correctly. **The aliases must stay** — every
account created before this change holds the old strings.

A test now asserts every default is a real registry name, so the next addition fails there rather than
quietly falling back to `ellipsis`.

### 3.8 One indent, no tree control

The model allows exactly one level of nesting, so a single 24px step is the whole hierarchy. A tree
control with expanders would be machinery for a depth of two. A child also gets the smaller swatch,
which is a second, quieter signal of the same thing.

### 3.9 Editing stays in place

No modal (9.1). The row becomes an inset block on `surface.sunken` so the form appears exactly where the
thing it edits was. Verified: `role="dialog"` absent, background `rgb(250,247,242)`.

---

## 4. Business rules enforced

- **Every category renders something.** `icon: null` is not an edge case — it is every category created
  before the picker existed. Verified in a browser: a category saved with no icon chosen still shows a
  swatch, with the `ellipsis` fallback glyph.
- **The nine seeded defaults each render their own glyph.** Nine swatches, nine distinct glyph shapes —
  not a column of identical fallbacks.
- **A category's colour never changes.** Derived from the id, not the name, so renaming "Food" to
  "Groceries" leaves it the same colour. There is no input that could change it.
- **Only one level of nesting.** The parent picker offers top-level categories only, and a category
  cannot be its own parent.
- **Defaults are ordinary user-owned records.** No system flag; every one can be renamed or archived.
  Marking them undeletable would be a limitation with no purpose.
- **Archiving is reversible and preserves history.** Archived categories keep their transactions and
  leave the pickers.

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    613 pass  (611 + 2)
npx vitest run --project ui                          350 pass  (343 + 7)
npm run test:integration                             508 pass
npm run build / npx eslint src                       clean
```

### Measured in Chromium

| | Expected | Measured |
| --- | --- | --- |
| Seeded defaults | nine, each with its own glyph | **9 swatches, 9 distinct glyphs** |
| Picker | radio group, 18 options | `role="radiogroup"`, `aria-labelledby`, 18 radios, all `name="icon"` |
| Tile | 44px square | **44×44** (130×44 before the fix — section 3.5) |
| Selected tile | ink border, offset shadow, tint | `rgb(30,27,41)`, `rgb(30,27,41) 3px 3px 0`, `rgb(220,243,238)` |
| New category | nothing pre-selected | `checkedCount: 0` |
| Editing a default | its stored icon pre-selected | `receipt` for Bills |
| Inline edit | not a modal | `role="dialog"` absent, `rgb(250,247,242)` |
| Archived badge | quiet | `rgb(106,102,130)` = `content.subtle` |
| Null-icon category | falls back, does not vanish | swatch present |

Captured: the list, the add form, the form with a glyph selected, after adding, the inline edit, the
archived list, a null-icon category, and the screen at 393px in light and dark.

---

## 6. Known gaps

- **The categories screen is undrawn** (section 10). The tree, the picker and the inline forms are all
  compositions of drawn components. **Designer review**, particularly the picker.
- **Nine ids produced a colour run.** Five of the nine seeded categories landed on sky or coral — the
  hash distributes well over many ids (group 25 tested it) but a set of nine can cluster, and the
  screen looks less varied than the five-colour palette suggests. Nothing is wrong; it is worth a
  designer's opinion on whether nine categories should be forced to spread.
- **No sub-category was created in the browser run.** The one-level indent and the smaller child swatch
  are implemented and unit-covered but not photographed.
- **The picker has no search or grouping.** Eighteen tiles fit in two rows; a longer list would need
  one.
- **`calendar` is in the picker but has no other call site.** Noted for group 41, which was going to
  ask: the artboard draws a `calendar` glyph on the date input, and a native `<input type="date">`
  indicator cannot be replaced cross-browser without giving up the native picker.
- **Unreviewed by the designer:** the picker (layout, selection treatment, the eighteen choices), the
  one-level indent, and the "colour is chosen for you" hint.

---

## 7. Notes for the next group

- **`CATEGORY_ICON_CHOICES` lives in `icon-map.ts`.** Pure data in the pure module — the `unit` project
  has no React transform, so a `.tsx` import from a unit test fails to parse.
- **`STORED_NAME_ALIASES` must not be deleted.** Every pre-existing account depends on it.
- **Group 40** should include: the picker's unselected tile (`content.muted` on `surface`), the selected
  tile (`content.onTint` on `brand.muted`) in both modes, the child row's 500-weight name, and a
  keyboard walk of the radio group — 18 options, one tab stop, arrow keys, and the selected tile must
  show a visible focus state distinct from its selected state.
- **Group 41** should capture `12-categories-defaults`, `29-categories` and `30-categories-add-form`
  afresh, and can now record `calendar` as intentionally unused outside the picker.
