# Group 29 — Money, Identity And Status Components

The components that carry the product rules. Section 7.4 of
[`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md), and section 9.1 for the rules themselves.

---

## 1. What was built

Eight components and one formatting function:

| Component | What it guarantees |
| --- | --- |
| `Amount` | mono, tabular figures, never wraps mid-figure |
| `DirectionAmount` | arrow **and** colour **and** words, all three, always |
| `BalanceBadge` | rebuilt on `DirectionAmount`; owns the settled case, which has no direction |
| `StatusBadge` | five closed kinds, each carrying its meaning as text |
| `Avatar` | square, ink border, derived initials, direction-coloured fill |
| `Swatch` | the generic bordered square |
| `CategorySwatch` / `AccountSwatch` / `TransactionTypeSwatch` | the three cases from 6.4, in their features |
| `ReferenceCode` | one site for the code format |

`toReferenceCode()` in `lib/utils/` derives a readable code from a record id, which is the group 21
decision made concrete.

34 new tests. The existing `BalanceBadge` tests passed unedited, which is the signal that its
contract did not change.

---

## 2. Files added or changed

**Primitives**

| File | Change |
| --- | --- |
| `src/components/ui/Amount.tsx` | **new.** `Amount`, `DirectionAmount` |
| `src/components/ui/StatusBadge.tsx` | **new** |
| `src/components/ui/Avatar.tsx` | **new** |
| `src/components/ui/Swatch.tsx` | **new.** The generic shell only — see 3.5 |
| `src/components/ui/ReferenceCode.tsx` | **new** |
| `src/components/ui/BalanceBadge.tsx` | rewritten on `DirectionAmount` |

**Feature components** (3.5)

| File | Purpose |
| --- | --- |
| `src/features/categories/components/CategorySwatch.tsx` | **new** |
| `src/features/accounts/components/AccountSwatch.tsx` | **new** |
| `src/features/transactions/components/TransactionTypeSwatch.tsx` | **new** |

**Library**

| File | Purpose |
| --- | --- |
| `src/lib/utils/reference-code.ts` | **new.** `toReferenceCode()` |

**Tests**

| File | Count |
| --- | --- |
| `src/components/ui/Amount.test.tsx` | 22 — amounts, direction, balance, badges, avatars, reference codes |
| `tests/ui/swatches.test.tsx` | 12 — the three swatch cases and how they differ |
| `src/lib/utils/reference-code.test.ts` | 6 — unit project, no DOM |

---

## 3. Key decisions

### 3.1 `DirectionAmount` cannot be rendered without the words

`label` is a required prop with no default. That is the entire design of the component.

Section 9.1: *direction is always spelled out in words — never a bare signed number or colour alone
to convey who owes whom.* The three signals are not equal:

```text
↗  the arrow    lost in a screen reader
   the colour   lost to a colour-blind user, lost in greyscale, lost in a printout
   the words    survive everything
```

A `label?: string` would have been used without a label on the fortieth screen, quietly. Making it
required means the rule is enforced by the compiler rather than by review.

For the same reason the arrow is `aria-hidden`: the words already say the direction, and "image,
arrow, owes you" is worse than "₹1,600.00 owes you".

### 3.2 There is no `direction="settled"`

A settled balance has no direction. A component accepting it would have to invent an arrow and a
colour for a state that has neither, so `DirectionAmount` takes `"in" | "out"` and `BalanceBadge`
owns the third case.

That is the only reason `BalanceBadge` still exists as a separate component: it translates the
domain's three-state `PersonBalanceDirection` into two presentational directions plus a badge.

### 3.3 A settled balance shows no figure at all

`BalanceBadge` renders "Settled up" with a check glyph and **drops the amount**. "₹0.00" invites
"zero of what, owed by whom?", and a zero rendered in a direction colour is actively misleading — it
looks like a live balance that happens to be small.

The group 29 checklist asks for both zero cases to be tested, and they differ:

- **settled** — no direction, no figure, a badge.
- **zero but directional** — a real state, for instance immediately after a settlement and before
  the balance is recomputed. The figure shows and the words still say which way it points, so the
  row is never ambiguous.

### 3.4 `StatusBadge`'s five kinds are a closed set

A badge that can say anything says nothing, and an activity list where every row carries a different
chip is noise rather than structure. Two families are in there, and the comment distinguishes them
because a reader scanning a row should know which is which:

- **derived** — `settled`, `partSettled`, recomputed on load like every other number (9.1);
- **factual** — `split`, `transfer`, `cardPayment`.

There is deliberately **no `unsettled`**. An unsettled split is the default state of a shared
expense, so badging it would put a chip on nearly every row.

`label` can override the text — "2 of 3 settled" is a legitimate refinement — but the icon and fill
stay tied to `kind`, so an override cannot make a settled badge look like a transfer.

The labels use the type-label half of the group 21 terminology decision: **"Split"** and **"Card
payment"**, not "Split a bill" or "Pay card", which are action labels.

### 3.5 The three swatches live in their features, not in `components/ui`

The obvious implementation puts `CategorySwatch`, `AccountSwatch` and `TransactionTypeSwatch` next to
the other primitives. It was written that way first and ESLint rejected it:

```text
'@/features/categories/icon-map' import is restricted …
components/ui must stay generic (no domain or feature logic)
```

The rule (`docs/05-FOLDER-STRUCTURE.md`) is right, and it caught a genuine design mistake: each of
the three needs a *feature's* resolver to decide its colour and glyph, and a UI primitive that knows
what a credit card is has stopped being reusable.

So the geometry is a generic `Swatch` in `components/ui`, and the three mappings are feature
components that wrap it. This is a deviation from where section 7.4 implies they live, and the
layering rule wins.

### 3.6 `Swatch`'s `fixedInk` is required, with no default

Section 6.4 has three swatch cases, and the third behaves oppositely to the other two:

| Swatch | Fill | Glyph colour |
| --- | --- | --- |
| category | a swatch colour | ink, fixed in both modes |
| account | a swatch colour by type | ink, fixed in both modes |
| transaction type | **`surface`** | **`currentColor`** |

A transaction-type marker carries no colour of its own — it marks a *kind*, not an identity — and
because its fill is `surface`, a glyph pinned to ink would be invisible in dark mode.

Both answers look correct in light mode. That is exactly why `fixedInk` has no default: a caller who
has not thought about it should not get a working component by accident. A test asserts both
branches.

### 3.7 `Avatar`'s prop is `relation`, not `color`

The fill encodes direction — teal for the signed-in user, mint when a person owes you, coral when you
owe them — which makes it a glance-level cue and a trap. Naming the prop `relation` puts the
obligation at the call site: a screen passing a directional avatar has to be a screen that also
states the direction in words, which in practice means next to a `DirectionAmount`.

The avatar is also `aria-hidden` unconditionally. The person's name is always rendered beside it — a
row with an avatar and no name would be unusable — so announcing "RS" as well means hearing the same
person twice, once as a meaningless pair of letters.

Initials are **derived** from `name` via the existing `initials()` helper rather than passed in, so
two call sites cannot disagree about how "Ravi Shankar" abbreviates.

### 3.8 The reference code is derived, and the trade-offs are written down

`toReferenceCode()` takes the last five characters of the id and uppercases them: `#92A3B`. The group
21 reasoning is reproduced at the definition, along with the two properties it gives up, because both
are the kind of thing someone will otherwise assume:

1. **No ordering.** `#A3F09` is not "after" `#7B210`. Nothing may sort by it, count it, or present it
   as a sequence. There is a test asserting this is not relied on.
2. **Not globally unique.** Five hex characters is about a million values. That is fine for a *human*
   handle used alongside a date, an amount and a description — and fatal if anyone queries by it.

It lives in `lib/utils/` rather than inside the component because group 32 needs it in the view
models: a code that only exists in a component cannot be logged, searched for, or exported.

### 3.9 `ReferenceCode`'s prop is `recordId`, not `id`

`id` collides with the HTML attribute on the underlying element. The first version declared
`id: string | null` on top of `TextProps`, which produced a type error rather than silently working —
and the fix is not to omit the attribute but to rename the prop, because a prop that shadows a DOM
attribute is one that eventually reaches the DOM by accident.

`tone="onTint"` is not optional decoration either: `content.meta` measures **4.2:1 on `tealTint`**,
just under AA, and `brand.muted` inverts lightness between colour modes (group 28 section 3.4). The
reference box in a form's side rail and `ErrorState`'s digest box both need it.

---

## 4. Business rules enforced

This is the group where section 9.1 becomes code:

- **Direction is always words.** `DirectionAmount.label` is required (3.1). The arrow and the colour
  are additions.
- **A settled balance is not a zero.** `BalanceBadge` drops the figure (3.3).
- **Every number is mono with tabular figures.** `Amount` carries `textStyle="amount"`; nothing
  renders a figure without it.
- **Every number is computed, never cached.** `StatusBadge`'s `settled` and `partSettled` are derived
  states, and the comment says so — no component here holds or implies a stored status.
- **Colour never carries meaning alone.** Asserted for `DirectionAmount` (words), `StatusBadge`
  (text), `Avatar` (`aria-hidden`, name adjacent), and the swatches (glyph decorative, name adjacent).
- **A category's colour survives a rename.** Derived from the id, with a test that changing the icon
  does not move the colour.
- **A reference is a handle, not a key** (3.8).

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run verify` (typecheck, lint, 599 unit) | passes |
| `npx vitest run --project ui` (233, +34 here) | passes |
| `npm run build` | compiles clean |
| existing `BalanceBadge.test.tsx` | **passes unedited** — the rewrite changed the rendering, not the contract |
| **visual render of every component in light and dark** | correct |

The visual sheet showed all five badges, three amount tones, both directions, the settled badge, four
avatar relations, all nine swatch variants, two realistic list rows, and a reference code inside a
tinted panel — twice, once inside a `.dark` wrapper. Everything read correctly in both modes,
including the two cases most at risk:

- the **transaction-type swatch** on `surface`, whose glyph inherits and so stays visible when the
  fill goes dark;
- the **reference code on a tint**, which is legible in both modes because it uses `content.onTint`
  rather than `content.meta`.

No bug was found this time, which is worth noting only because the previous three groups each found
one: the tint-versus-swatch distinction learned in group 28 was applied here from the start.

**Not verified.** None of these components is on a real screen yet. In particular:

- **The `neutral` avatar fill is `surface.sunken`**, which is *dark* in dark mode — it is the one
  combination in this group that does not follow the bright-fill rule. It is safe where it is
  intended to be used (no balance to signal, sitting on a card) and it needs measuring in group 40.
- **`Amount`'s responsive sizes are untested at real widths.** The handoff draws row amounts at
  14.5/13.5px and these round to `row`/`subtitle`; whether that reads correctly in a dense list is a
  group 35 question.
- **`ReferenceCode` is not wired to anything.** Group 32 surfaces the code in the view models.

---

## 6. Known gaps

- **`ReferenceCode` has no data behind it.** Group 32 adds it to the transaction, settlement and
  expense view models. Until then the component is exercised only by tests.
- **`StatusBadge` has no call site.** Groups 35 and 38 place the five badges; nothing here has been
  seen in a row alongside real content.
- **The `neutral` avatar in dark mode** (5). The one fill in this group that is not bright.
- **`Avatar` has no image support and never will need one** in the MVP — people are manually
  created records with no avatar upload. If that changes, the `aria-hidden` decision needs revisiting,
  because a photograph is not a duplicate of the name in the way initials are.
- **`DirectionAmount` sizes are `sm` and `md` only.** The handoff draws one size; `sm` is an
  interpolation for a dense list and has no call site.
- **The 12px arrow size is a literal**, not an `ICON_SIZES` name. The handoff draws the direction
  arrow at 12px, which is smaller than every named context in 6.3 — adding an eighth name for one use
  seemed worse than the literal, but it is the only place in the app that passes a raw size to `Icon`.
- **`StatusBadge` and `BalanceBadge`'s settled state duplicate a chip treatment.** Both draw an
  inline bordered chip with a glyph and `textStyle="badge"`. They are not shared because the settled
  badge is not one of the five kinds and folding it in would make `StatusBadge` accept a state it has
  no icon or fill rule for. If a third chip appears, extract the shell.

---

## 7. Notes for the next group

Group 30 (shell and navigation) needs `Avatar` for the header's user badge — `relation="self"`, which
is the teal fill, at `size="sm"` per the handoff's 24px.

For the screen groups:

- **Never render an interpersonal amount without words.** Use `DirectionAmount` or `BalanceBadge`,
  never `Amount` with a tone (3.1). `Amount` with a tone is for a figure whose meaning the *label*
  already carries — a summary tile, a card debt total.
- **Use the feature swatches**, not `Swatch` directly, unless a genuinely new case appears. If one
  does, decide `fixedInk` by asking whether the fill is bright in **both** modes (3.6).
- **`ReferenceCode` inside any tinted panel needs `tone="onTint"`** (3.9). This is now the third place
  that pairing matters and nothing enforces it.
- **Do not reach for `Stamp` for a status.** `StatusBadge` is the chip; `Stamp` is the rotated
  confirmation, and group 28 gave it no error tone for a reason.

One trap: `BalanceBadge` takes `label` as the direction in words, and the two call sites
(`PeopleBalances`, `PersonList`) pass it from the view model. When those screens are restyled in
group 38, check the view model still produces a phrase that reads as a sentence fragment next to the
amount — "owes you", not "OWES_YOU" or "Positive".
