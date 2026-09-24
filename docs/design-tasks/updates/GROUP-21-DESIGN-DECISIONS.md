# Group 21 — Design Decisions And Sign-off

Closes the ten open questions in section 2 of [`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md)
so groups 22 onward have a fixed target.

> **Status of these answers.** No designer was available to arbitrate, so each decision below
> takes the recommendation the design system document already argued for, or — where it made no
> recommendation — the option that ships the visual language without a data-model change.
> Everything marked **needs designer confirmation** is a working assumption, not an approval.
> Section 6 lists them in one place.

---

## 1. What was built

No application code. This group produces the decisions themselves: ten answers that determine
the shape of groups 22 to 41, plus measured replacements for the three palette values that fail
WCAG AA as drawn.

The four blocking questions (2.1 reference codes, 2.2 dark mode, 2.3 category icons, 2.4 the FAB
gesture) are all answered, so nothing downstream is waiting on this group.

---

## 2. Files added or changed

**Documentation**

| File | Purpose |
| --- | --- |
| `docs/design-tasks/updates/GROUP-21-DESIGN-DECISIONS.md` | this document — the record of what was decided and why |
| `docs/design-tasks/updates/README.md` | index row for group 21 |
| `docs/design-tasks/02-DESIGN-TASK-GROUPS.md` | group 21 checkboxes ticked |

No source files. A temporary Node script was used to measure contrast ratios and then deleted;
group 40 replaces it with a committed `scripts/check-contrast.ts` so the numbers below can be
re-derived rather than trusted.

---

## 3. Key decisions

### 3.1 Ledger reference codes — **Option B, derived from an existing id** (2.1)

Codes render as `#` plus the last five hex characters of an existing id, uppercased: `#A3F09`, not
`#08231`.

> **Corrected by group 32.** This section originally said "derived from the `ObjectId`" while also
> claiming the code is "available offline immediately". Both cannot be true — an offline record has no
> server id until it syncs. The source is the record's **`clientId`**, which every record carries from
> the moment it exists and which the server stores unchanged, so the code is identical before and
> after sync. The decision below is otherwise unchanged. See `GROUP-32-REFERENCE-CODES.md` section 3.1.

Rejected **A** (a per-user monotonic sequence). It is the only option that produces the exact
codes in the handoff, but a gap-free sequence allocated inside `withTransaction()` is a
distributed-systems problem — counter contention, retries on write conflict, and a guarantee to
prove under concurrency — and it would block a restyle on it. Rejected **C** (drop the reference)
because the reference is one of the load-bearing parts of the ledger framing; the eyebrow labels
and the AS OF stamp cannot carry it alone.

Two consequences accepted deliberately:

- The codes carry **no ordering**. Nothing in the UI may imply they sort or count.
- They are **available offline immediately**, because the `clientId` exists before the record syncs.
  This is the reason B is better than A for this app specifically: option A cannot produce a
  code until the server sees the write, which forces a draft state onto every offline create.

Group 32 isolates the format in one `ReferenceCode` component and one formatting function, so
switching to A later is a change to two files rather than every screen.

### 3.2 Dark mode — **in scope, shipping in this pass** (2.2)

The handoff draws two dark screens and a complete dark palette. Deferring it would mean the
restyle ships knowingly incomplete against its own handoff, and the retrofit cost the design
document warns about (forty semantic tokens gaining `_dark` values later) is paid either way.

So: group 23 writes both modes into every semantic token, and **group 24 is not skipped** — it
wires the provider, the persisted preference and the no-flash script.

### 3.3 Dark-mode toggle location — **the app header** (2.2, last checkbox)

There is no settings screen (`src/app/(app)/settings/` is empty), and creating one purely to hold
one control is scope the restyle does not need. The toggle is an icon-only button in the app
header, immediately before sign-out, at both widths — the one piece of chrome that is present on
every authenticated screen.

It is not shown on the unauthenticated layout. Sign-in and sign-up follow the system preference
only, which keeps the graph-paper background (5.5) a single-mode problem for group 33.

### 3.4 Category icons and colours — **resolver only, plus an icon picker; no `color` field** (2.3)

Three parts:

- **No `color` field is added to `Category`.** The handoff states no rule for which category
  gets which colour, so any field would be storing a value nobody has defined the meaning of.
  Colour is derived (3.5).
- **An icon picker *is* added to `CategoryForm`** in group 39. The `Category.icon` field already
  exists and already holds lucide-style names on the nine seeded defaults; the only reason every
  user-created category has `icon: null` is that the form never offered the field. Adding a
  picker needs no migration and no schema change — it writes a registry name into a field that
  is already there.
- **The picker's options are the registry names** from 6.2, not the full lucide set, so a stored
  value can always be rendered.

### 3.5 The deterministic fallback for `icon: null` (2.3)

```text
colour:  FNV-1a hash of the category id  →  index into [teal, mint, coral, butter, sky]
glyph:   `ellipsis`  (the neutral "other" glyph, drawn in group 25)
```

Hashed on the **id**, never the name — renaming "Food" to "Eating out" must not change the
colour. FNV-1a was chosen over summing char codes because short similar strings (`...a1`, `...a2`)
collide into neighbouring buckets under a naive sum, which would make sibling categories created
seconds apart all the same colour.

The same resolver decides the colour for categories that *do* have an icon, since there is no
colour field for either case. One module, `src/features/categories/icon-map.ts`, so adding a real
`color` field later replaces one function.

### 3.6 Press-and-hold on the FAB — **dropped** (2.4)

Not built. A gesture with no visible affordance and no keyboard equivalent cannot be the route
to anything, and tapping the FAB already opens a menu whose first item is Add expense — so the
shortcut saves one tap in exchange for an undiscoverable interaction. Group 31 builds the tap
menu only.

If it is wanted later it needs a visible hint and a keyboard path designed alongside it.

### 3.7 The six undocumented colours — **adopted as named tokens, flagged** (2.5)

All six are kept, with the names the design system gave them, so they stop being inline magic
numbers. Two of them change value for contrast reasons (3.8). The four derived dark counterparts
are:

| Light token | Light value | Derived dark value | Basis for the derivation |
| --- | --- | --- | --- |
| `inkQuiet` | see 3.8 | `{colors.darkInkMeta}` | the quietest designed dark text value |
| `disabledSurface` | `#EDEAE3` | `#2A2739` | `darkSurface` lifted toward `darkInkMeta`, matching the light pair's relationship to `paper` |
| `inkOnTint` | `#4A465B` | `{colors.darkInkSecondary}` | the tint panel in dark mode is `darkTealTint`, on which `darkInkSecondary` measures 8.2:1 |
| graph-paper grid | `rgba(30,27,41,0.05)` | `rgba(243,240,250,0.05)` | the same 5% alpha, inverted to `darkInk` |

`#1E1B2C` (dark surface) versus `#1E1B29` (light ink) is confirmed as intentional and not a
typo — they are transcribed separately in `DESIGN.md`'s two colour tables. The one-digit
difference is a trap, so `tokens.ts` carries a comment at both.

### 3.8 Contrast replacements for the failing text tokens (9.3) — **measured, not guessed**

Three values fail WCAG AA 1.4.3 (4.5:1 for text below 18.66px/bold-14px) at the sizes they are
drawn. The design system flagged two; measurement found a third, `inkMeta`, at 2.1:1.

Replacements stay in the same violet-grey family and preserve the hierarchy
`muted > subtle > quiet > meta`:

| Token | As drawn | Ratio on `#FFFFFF` | Replacement | Ratio on `#FFFFFF` | Ratio on `paper` |
| --- | --- | --- | --- | --- | --- |
| `inkTertiary` → `content.subtle` | `#8B87A0` | 3.46 | `#6A6682` | **5.47** | 5.12 |
| `inkQuiet` → `content.quiet` | `#A6A2BC` | 2.47 | `#706C88` | **5.01** | 4.69 |
| `inkMeta` → `content.meta` | `#B4B0C4` | 2.11 | `#726E8A` | **4.87** | 4.56 |
| `darkInkMeta` | `#6C6884` | 3.16 *(on `darkSurface`)* | `#8F8AA8` | **5.10** | 5.60 |

Unchanged because they already pass: `content` 16.9, `content.muted` 6.9, `brand.fg` 5.2,
`content.onTint` on `tealTint` 7.8, ink on all five swatch fills 9.5 to 13.4, and every dark text
token except meta.

Two residual limits, recorded rather than papered over:

- `content.quiet` on `disabledSurface` measures **4.17**. WCAG 1.4.3 exempts inactive controls,
  so this is compliant, but it is below the floor the rest of the palette holds to.
- `content.meta` on `tealTint` measures **4.20**. Reference codes appear inside the tinted
  reference box on the form screens, so `ReferenceCode` takes a `tone="onTint"` that switches to
  `content.onTint` (7.8) there. On plain surfaces it stays `content.meta`.

Ratios were computed with the WCAG 2.x relative-luminance formula against the flat background
each value actually sits on. They differ slightly from the figures in 9.3 of the design system
document (16.9 versus 15.9 for `content`, for example); the verdicts are the same and the
disagreement is not worth chasing.

### 3.9 The nine missing icons — **drawn in-house in group 25** (2.6)

`search`, `filter`, `archive`, `restore`, `edit`, `delete`, `offline`, `install`,
`chevron-right`, plus three the category map needs and the handoff also omits: `receipt`,
`plane`, `ellipsis`. Twelve new glyphs, drawn to the geometric rules in 6.1 — 16px viewBox,
1.2–1.8px stroke, straight lines and simple polylines only.

Commissioning them from the designer was the alternative. Rejected because nine of the twelve
gate screens in groups 35 to 39, and an in-house glyph drawn to a written rule is reviewable
after the fact.

### 3.10 Split / transfer / card-payment terminology (2.7)

One label per context, fixed:

| Context | Label | Why |
| --- | --- | --- |
| Quick-add menu and dashboard quick action | **Split a bill** | a verb phrase, because the user is choosing an action from a list of actions |
| Add-expense header switch | **Split instead** | reads as a modifier on the form already open, which is what it is |
| Activity row badge, filter option, page titles | **Split** | a type label, not an action |

`docs/04-USER-FLOWS.md` section 28 asks for consistent terminology, and this satisfies it: the
*noun* is "split" everywhere, and the two longer forms are the same noun inside a verb phrase.
What it rules out is calling the same thing a "share" or a "shared expense" in one place and a
"split" in another. The existing app already uses "Split" and "Split instead", so only the
quick-add and dashboard labels are new.

Transfer is "Transfer" everywhere. Card payment is **"Pay card"** as an action label and
**"Card payment"** as a type label, on the same rule.

---

## 4. Business rules enforced

This group writes no code, so it enforces nothing directly. It does commit to three rules that
later groups have to hold:

- **Reference codes imply no order.** Derived from a hash of the id (3.1), they are identifiers
  only. No screen may sort by them, count them, or present them as a sequence.
- **Category colour is derived from the id, never stored and never from the name** (3.5), so a
  rename cannot silently re-colour a category in every historical chart.
- **No information may be carried by colour alone**, which the contrast decisions in 3.8 do not
  relax. Darkening `content.subtle` improves legibility; it does not make a colour-coded
  direction acceptable. Direction stays in words (9.1).

---

## 5. How it was verified

| What | How | What it proves |
| --- | --- | --- |
| Contrast ratios in 3.8 | WCAG 2.x relative luminance computed in Node for every candidate against `#FFFFFF`, `#FAF7F2`, `#DCF3EE`, `#EDEAE3`, the five swatch fills, `#1E1B2C` and `#141220` | the replacements pass AA at the sizes drawn, and the three failures are real rather than transcription errors |
| `#1E1B2C` vs `#1E1B29` | read both colour tables in `design/ux/DESIGN.md` | the one-digit difference is intentional |
| Icon inventory | the 28 glyphs in 6.2 against the icons the current screens use | twelve glyphs missing, not nine — `receipt`, `plane` and `ellipsis` are needed by the seeded category defaults |
| Category `icon` state | `src/server/services/categories/default-categories.ts` and `CategoryForm` | the field exists and is populated for the nine defaults; the form is the only reason user categories are null |
| No settings screen | `src/app/(app)/settings/` | empty, confirming the toggle needs another home (3.3) |

Nothing is compiled or tested by this group. `npm run verify` was not run because no source file
changed.

---

## 6. Known gaps

**Needs designer confirmation** — each is a working assumption this implementation now depends on:

1. Reference codes are hex and unordered (3.1). If sequential codes are a requirement, group 32
   changes shape and the data model gains a counter.
2. The four derived dark values in 3.7, especially `disabledSurface`'s dark counterpart `#2A2739`,
   which has no designed basis at all.
3. The four replacement text colours in 3.8. These are measured, not designed; a designer may
   prefer different hues at the same ratios.
4. Dropping the press-and-hold gesture (3.6).
5. The dark-mode toggle living in the header rather than a settings screen (3.3).
6. The terminology split in 3.10.
7. The twelve in-house glyphs, once drawn in group 25, need a review pass.

**Deferred by design:**

- A `Category.color` field, and any rule for what colour a category should be (3.4). Deferred
  indefinitely; the resolver is the seam if it ever arrives.
- Option A reference codes (3.1). Deferred to a future group, with group 32 keeping the seam.
- A settings screen (3.3). Out of scope for the restyle.
- Dark-mode contrast for the *tinted* surfaces beyond the text pairs measured here — group 40
  owns the full pass, including ink on the five dark swatch fills, which measured 7.1 to 11.1
  and look safe but have not been checked at every size.

**Not yet answered by anyone:** what the 40 screens with no design (section 10) should look like
in dark mode. Groups 33 to 39 build them from tokens, and group 41 lists every one for review.

---

## 7. Notes for the next group

Group 22 (typography) can start immediately; it is independent of everything here.

Group 23 must use the **replacement** values from 3.8, not the values in section 3.1 of the design
system document. The four that differ:

```ts
inkTertiary:  "#6A6682"   // not #8B87A0
inkQuiet:     "#706C88"   // not #A6A2BC
inkMeta:      "#726E8A"   // not #B4B0C4
darkInkMeta:  "#8F8AA8"   // not #6C6884
```

Group 23 also needs the two extra token values decided in 3.7: `disabledSurfaceDark: "#2A2739"`,
and the dark graph-paper grid at `rgba(243,240,250,0.05)`.

Group 24 is **on**, not skipped (3.2), and its toggle goes in the app header (3.3) — which means
group 30 has to leave room for it next to sign-out on both the desktop and the slim mobile
header. Worth reading 3.3 before laying out that header, not after.

Group 25 draws **twelve** glyphs, not nine (3.9), and its fallback resolver is specified in 3.5 —
FNV-1a over the id, `ellipsis` as the glyph.

Group 32's format is `#` + last five hex of the record's `clientId`, uppercased (see the correction
note in 3.1), and `ReferenceCode` needs the `tone="onTint"` variant from 3.8 or it fails contrast
inside the form side rail.
