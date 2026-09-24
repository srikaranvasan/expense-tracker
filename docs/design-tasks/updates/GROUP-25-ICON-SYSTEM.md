# Group 25 — Icon System

Forty-three glyphs, one component, and three resolvers that map application concepts onto them.
Section 6 of [`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md).

---

## 1. What was built

The app had no icons at all. It now has a single set with one way to draw them:

- **A registry of 43 glyphs.** Twenty-nine transcribed from `design/ux/`, fourteen drawn
  in-house because the handoff provides none for them.
- **`<Icon name size />`**, which owns every shared SVG attribute — so a glyph is only ever path
  data plus a stroke weight, and there is no per-icon opportunity to forget `aria-hidden`.
- **The fixed-ink rule**, as a prop rather than a convention: `onSwatch` paints the glyph in ink
  in *both* themes, because light ink on any of the five swatch fills measures around 2:1.
- **Three resolvers.** Categories need one (their stored icon may be unknown, aliased or null);
  accounts and transaction types need a total mapping the compiler can check.
- **119 new tests**, split so the pure logic runs without a DOM.

Two things were found by doing the work rather than reading the spec: the handoff draws 29
glyphs, not the 28 it claims, and the two chevrons' shallower viewBox would have made them paint
twice as heavy as the rest of the set.

---

## 2. Files added or changed

**The icon system**

| File | Purpose |
| --- | --- |
| `src/components/icons/names.ts` | **new.** `IconName`, `ICON_NAMES`, `HANDOFF_GLYPHS`, `IN_HOUSE_GLYPHS`, `isIconName`. No JSX |
| `src/components/icons/registry.tsx` | **new.** The 43 drawings, grouped as the design document groups them, plus `ICON_VIEWBOX` |
| `src/components/icons/Icon.tsx` | **new.** The renderer, and `ICON_SIZES` — the seven context sizes from 6.3 |

**Resolvers**

| File | Purpose |
| --- | --- |
| `src/features/categories/icon-map.ts` | **new.** Stored-name aliases, the FNV-1a swatch hash, the fallback |
| `src/features/accounts/icon-map.ts` | **new.** Total `AccountType` → glyph + swatch mapping |
| `src/features/transactions/icon-map.ts` | **new.** `TransactionType` → glyph, with expenses borrowing the category glyph |

**Theme**

| File | Change |
| --- | --- |
| `src/theme/semantic.ts` | adds `content.onSwatch` — ink in both modes, distinct from `brand.contrast` |

**Wiring**

| File | Change |
| --- | --- |
| `src/components/theme/ColorModeToggle.tsx` | uses `<Icon name="sun">` / `<Icon name="moon">`; the inline glyphs group 24 had to draw are gone |

**Tests**

| File | Count | Scope |
| --- | --- | --- |
| `src/components/icons/names.test.ts` | 47 | vocabulary, narrowing, account and transaction resolvers — `unit` project |
| `src/components/icons/registry.test.tsx` | 101 | glyph geometry and the `Icon` component — `ui` project |
| `src/features/categories/icon-map.test.ts` | 25 | the category resolver — `unit` project |

---

## 3. Key decisions

### 3.1 Names and drawings are separate modules

`names.ts` holds the vocabulary; `registry.tsx` holds the JSX.

The reason is not tidiness. The glyphs are JSX, so importing them drags a JSX transform into
whatever imports them — and the first attempt put `isIconName` in the registry, which made
`features/categories/icon-map.ts` a React-dependent module and its test unrunnable in the `unit`
project. The resolvers are pure functions over names; they have no business needing React.

The split could let the two files drift, so it does not: `registry.tsx` declares
`Record<IconName, IconGlyph>` rather than inferring its type, which makes the compiler reject a
name with no drawing **and** a drawing with no name. Neither can be added alone.

### 3.2 JSX in the registry rather than shape descriptors

Section 6.2 suggests a `registry.ts` mapping a name to `{ stroke, children }`. JSX cannot live
in a `.ts` file, so the choice was between `.tsx` and a declarative
`{ kind: "rect", x, y, … }` union with an interpreter in `<Icon>`.

JSX won for one reason: the path data is transcribed by hand from the handoff, and it now reads
character for character as the design document lists it. A descriptor layer would put an
interpreter between the reviewed value and the rendered pixel, and a bug in that interpreter
looks exactly like a bad transcription — the hardest kind of error to find in 43 glyphs.

### 3.3 There are 29 handoff glyphs, not 28

The design system document says "twenty-eight" twice. Its four tables list 6 + 10 + 7 + 6 = 29.
Nothing is missing and nothing was invented; the prose count is an arithmetic slip. Recorded in
`names.ts` and asserted in a test, so the next person to count does not go looking for a
thirtieth.

### 3.4 One viewBox for every glyph — the chevrons do not keep theirs

The handoff specifies `viewBox="0 0 12 8"` for `chevron-down`, and the first implementation
honoured it, with a per-glyph `viewBox` field to support it.

That is wrong in a shared sizing system, and a contact sheet of all 43 glyphs at one size made it
obvious: `<Icon>` scales the viewBox to the requested pixel size, so a 12×8 box rendered into a
14px square scales by 1.75 where a 16-unit glyph scales by 0.875. The same nominal `stroke: 2`
paints roughly twice as heavy. On the sheet the two chevrons were visibly chunky and spilling
outside their cells while everything else sat comfortably.

A shallower box is fine on an artboard, where a glyph is placed once at a known size. It is not
fine when `stroke` has to be comparable across a set. So the `viewBox` field was **removed**
rather than left as an override, and `ICON_VIEWBOX` is a rule with a comment explaining why —
the chevrons keep the design's intent (a 2px chevron, centred, no wasted air) by insetting the
path instead of shrinking the box.

This is a deliberate divergence from the handoff and is listed as such in section 6.

### 3.5 Paint attributes go on a `<g>`, not on the `<svg>`

`chakra("svg")` consumes `stroke`, `fill` and `strokeWidth` as **style props** and emits them as
CSS. Three glyphs override the weight on one of their own children — `accounts`' chip at 1.3,
`ticket`'s third rule at 1, `offline`'s slash at 1.6 — and those overrides are presentation
*attributes*. Mixing the two mechanisms across the parent/child boundary makes the result depend
on cascade rules that are easy to reason about wrongly and invisible when you do.

So the division is explicit: **Chakra owns layout and colour** on the `<svg>` (size, `display`,
`flex-shrink`, tokens, the `_dark` condition), and **SVG owns painting** on the `<g>`. Parent and
child then speak the same language and a child attribute reliably wins. A test asserts the chip
keeps its 1.3, which is what catches a future "simplification" that moves the weight back up.

### 3.6 `content.onSwatch`, a new semantic token

`DESIGN.md`: anything drawn inside a coloured swatch or avatar is ink in both themes. Measured,
light ink on the dark fills is 1.4:1 to 2.1:1 — the glyph disappears — against 7.1:1 to 11.1:1
for ink.

`brand.contrast` already holds "ink in both modes", and reusing it would have avoided a token.
It was rejected because the two mean different things: one is about the primary *button*, the
other about a decorative *fill*. They coincide today, and a future palette could move one without
the other. The comment at the definition says so.

Exposed as `<Icon onSwatch>` rather than left to call sites, because "remember to set the colour
manually every time you put an icon in a swatch" is a rule that gets broken on the fortieth
screen, not the first.

### 3.7 `aria-hidden` is the default; `label` is the opt-in

Almost every icon in this design sits beside a text label, where announcing it repeats the label
— worse than silence. Making hidden the default means a screen has to opt *in* to an announced
icon rather than remember to opt out.

`label` switches the SVG to `role="img"` with an accessible name. Its doc comment steers
icon-only *controls* to `aria-label` on the button instead, which is the case that actually
occurs (the header's sign-out and the colour-mode toggle); `label` is for the rarer standalone
informational glyph.

### 3.8 FNV-1a for the category colour, hashed on the id

The fallback rule group 21 specified. Two parts worth restating because both are load-bearing:

**Why the id and not the name.** Colour is how a user recognises a category in a list and in last
month's spending breakdown. A rename that silently re-colours a year of history is worse than
having no colour at all. A test asserts the colour survives a rename *and* an icon change.

**Why FNV-1a and not a sum of char codes.** Categories created seconds apart have ObjectIds
differing in the last character or two. A naive sum differs by one and lands them in adjacent
buckets, which shows up as runs of the same colour down a list of siblings. FNV-1a's
multiply-and-mix breaks that up — a test takes sixteen ids differing only in the final character
and requires at least four of the five buckets to appear.

`Math.imul` with `>>> 0` after it, because without the unsigned coercion the intermediate goes
through a signed conversion and the distribution degrades.

### 3.9 An unknown stored icon is treated exactly like `null`

`Category.icon` is free text holding lucide names. `resolveCategoryIcon` tries the alias table,
then the registry, then falls back to `ellipsis`. An icon nobody can draw is no more useful than
an icon nobody chose, so there is no third behaviour for "named but unknown" — it would only
produce an empty box.

`isIconName` uses a `Set` rather than `name in ICONS`, because `in` also matches inherited
properties: `"toString"` and `"constructor"` would pass and then fail to render. Three tests
cover that specifically.

The alias table maps only names that actually *differ* from a registry name. Anything already
matching passes straight through, which is what makes the group 39 icon picker cheap — it will
offer registry names and need no entry here.

### 3.10 The transaction-type swatch is the third swatch case, and the odd one

Category and account swatches are filled with a colour and their glyph follows the fixed-ink
rule. A transaction-type swatch is filled with `surface` and outlined in ink (6.4), so its glyph
is `currentColor` — ink on `surface` in dark mode would be invisible. The module comment says so
at the top, because the three cases look alike and only two of them behave alike.

An expense borrows its **category's** glyph rather than getting a generic "expense" one. A column
of activity rows should be readable at a glance as groceries, transport, bills; that is the most
informative thing in the row and a single glyph throws it away.

### 3.11 Credit cards are coral

The account colours are not arbitrary: teal is the brand, mint is positive, coral is negative. A
card is a liability rather than money held — `isAssetAccount` in `domain/accounts/entities.ts`
excludes it — so it gets the negative fill. Asserted, because it is the sort of thing that looks
like a free choice and is not.

---

## 4. Business rules enforced

- **Every category renders something.** `icon: null` is not an edge case: it is every category a
  user has ever created, because `CategoryForm` never offered the field. The resolver is total,
  and the nine seeded defaults are each asserted to resolve by name rather than by falling back.
- **Colour never carries meaning on its own.** The five `swatch.*` fills are deliberately
  separate from `positive`/`negative` in the semantic layer, so a decorative category colour
  cannot be mistaken for a direction signal. The direction glyphs (`arrow-in`, `arrow-out`) exist
  as *additions* to the words, per 9.1 — the registry comments say so at both.
- **A glyph inside a swatch stays legible in both themes** (3.6), enforced by a prop rather than
  a convention.
- **The "computed" marker exists.** `equals` is the visual half of the rule that every number is
  computed, never cached; group 34 puts it beside the net position.

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run verify` (typecheck, lint, 593 unit tests) | passes, no warnings |
| `npx vitest run --project ui` (142) | passes |
| `npm run build` | compiles clean |
| **visual contact sheet of all 43 glyphs at one size** | see below |

The contact sheet is what actually earned its keep. A throwaway test rendered every glyph at
28px onto a `paper` background, tinting the fourteen in-house ones so the two origins could be
compared side by side, and a Playwright screenshot made it viewable. Both files were deleted
afterwards.

It found the chevron problem in 3.4 immediately — the two chevrons were obviously heavier than
everything around them and bleeding past their cells — which no assertion in this group would
have caught, because each glyph was individually correct. It also confirmed the things that were
only reasoned about: `ticket` and `card` are distinguishable side by side (two inner rules
against one), `archive` and `restore` read as a pair, `offline` reads as "no signal" without a
curve, and the fourteen in-house glyphs sit at the same visual weight as the transcribed ones.

Rendering the sheet again after the chevron fix confirmed the set is now uniform.

The automated tests are split by what they need:

- `names.test.ts` (`unit`) — vocabulary counts, narrowing including inherited properties, and the
  account and transaction resolvers. No DOM.
- `icon-map.test.ts` (`unit`) — the category resolver: every seeded default, aliases, pass-through,
  four flavours of fallback, colour stability across a rename, bucket spread across near-identical
  ids, and a 1,000-id distribution check.
- `registry.test.tsx` (`ui`) — stroke weights in range for all 43, one viewBox for all 43, the
  per-child weight override, `aria-hidden` by default, `role="img"` with a label, named and
  arbitrary sizes, the fixed-ink rule, `flex-shrink`, the filled dots, and every glyph rendering
  without throwing.

**Not verified.** Nothing is rendered *in a screen* yet: no swatch, no avatar, no nav link exists
to put an icon in. The sizes in `ICON_SIZES` are transcribed from 6.3 and have been checked at
28px on a sheet, not at 11px inside a 20px swatch — which is where a 1.2-weight glyph is most
likely to turn to mush. Groups 28 to 39 are the first chance to look at that.

---

## 6. Known gaps

**Needs designer review** — the fourteen in-house glyphs, which is the whole `IN_HOUSE_GLYPHS`
list and is kept as code rather than prose so this section cannot go stale:

```text
search  filter  archive  restore  edit  delete  offline  install
chevron-right  receipt  plane  ellipsis  sun  moon
```

Three of them involved a judgement worth flagging:

- **`archive` / `restore`** are the same tray with the arrow reversed, rather than the
  conventional lidded box and circular arrow. Those two share no visual language, so a user
  would learn them separately; and a circular arrow needs an arc, which this set avoids.
- **`offline`** is ascending bars struck through, not a crossed-out cloud, which would need three
  curves. It pairs with `bar-chart` — the same bars without the slash.
- **`plane`** is a paper plane, four straight edges, rather than an airliner.

**Divergences from the handoff:**

- The chevrons are drawn in the 16-unit box, not the specified `0 0 12 8` (3.4). Visual intent
  preserved, geometry changed.
- `content.onSwatch` is a new token the design document does not name (3.6).

**Deferred:**

- **No icon is used at its real size yet** (5). Every size in `ICON_SIZES` is unexercised until
  groups 28 to 39.
- **The category icon picker** is group 39. Until then every user-created category shows the
  `ellipsis` fallback, which is correct but uniform — the categories screen will look
  under-coloured in a way the design does not intend.
- **`calendar`, `shield`, `bar-chart`, `bolt` and `cart` have no call site.** They are in the
  handoff's tables so they were transcribed, but nothing in the coverage matrix obviously needs
  them. Worth a look in group 41: an unused glyph is either a screen nobody built or a glyph
  nobody needs.
- **Dark-mode contrast for glyphs on tinted fills** has not been measured at real sizes. The
  fixed-ink rule rests on group 21's measurements of the fills; a 1.2-weight stroke at 11px is a
  different question from a block of colour, and it belongs to group 40.
- **No `receipt`, `plane` or `ellipsis` review against the seeded defaults in situ.** They resolve
  correctly; whether "Bills" reads as a receipt at 11px is a group 39 question.

---

## 7. Notes for the next group

Groups 26 to 29 are the ones that start consuming this. Four things to know:

- **Import from `@/components/icons/Icon` for rendering and `@/components/icons/names` for
  types and `isIconName`.** Importing the registry into a non-component module pulls JSX where it
  does not belong (3.1). `registry.tsx` re-exports the name helpers for convenience, but prefer
  `names` in logic.
- **Use a named size from `ICON_SIZES`** — `size="swatchSm"`, `size="tab"` — not a pixel value.
  The seven names are the seven contexts in 6.3, and they are the only place those numbers should
  appear.
- **Set `onSwatch` whenever the icon is inside one of the five fills or an avatar.** Forgetting it
  is invisible in light mode and erases the glyph in dark.
- **Do not add an `aria-label` to a decorative icon.** The default is already correct; a label on
  an icon beside text makes a screen reader say it twice.

Group 26 needs `mail`, `lock` and `chevron-down` for the field primitives. Note that
`chevron-down` is now a normal 16-unit glyph (3.4), so size it like any other input-prefix icon
rather than reaching for the handoff's pixel values.

Group 39 owns the icon picker. Its options should be **registry names**, which is why the alias
table only lists names that differ (3.9) — a picker writing `"cart"` needs no new entry, and a
picker writing `"shopping-cart"` does.

Group 41 should send `IN_HOUSE_GLYPHS` for sign-off, and should check the five glyphs listed in
section 6 that currently have no call site.
