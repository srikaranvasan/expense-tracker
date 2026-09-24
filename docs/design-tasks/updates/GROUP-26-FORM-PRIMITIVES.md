# Group 26 — Form Primitives

The controls every form in the app is built from. Section 7.2 of
[`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md), with the focus treatment from 5.3.

---

## 1. What was built

`src/components/ui/Field.tsx` was restyled end to end. The accessibility contract is untouched —
the existing `Field.test.tsx` cases passed without a single edit, which is the intended proof that
only the appearance moved.

What changed:

- **Labels became eyebrows.** Mono, uppercase, 11px, tracked, `content.muted` — the same device
  used above every block in this design, carried by `textStyle="eyebrow"` rather than
  re-specified.
- **Every control shares one set of states.** Resting, focused, invalid and disabled are defined
  once in `CONTROL_STYLES` and spread into all four controls, so the text input, textarea, amount
  input and select cannot drift apart.
- **Focus is the teal offset shadow**, replacing Chakra's ring — with the border width held
  constant so focusing cannot shift the layout.
- **The amount input gained a currency prefix**, drawn as a positioned sibling rather than stored
  in the value.
- **The select kept its native element** and gained the registry's `chevron-down`.
- **Error text is mono `negative`**; hints are Manrope `content.subtle`.

Eleven new tests, and two real bugs found by rendering the controls rather than asserting on them.

---

## 2. Files added or changed

| File | Change |
| --- | --- |
| `src/components/ui/Field.tsx` | rewritten. Adds `CONTROL_STYLES`, the currency prefix, the registry chevron; `AmountInput` gains a `currency` prop |
| `src/components/ui/Field.test.tsx` | +11 tests in a new `Field styling contract` block. The six original tests are unchanged |

Nothing else. No screen was touched, and no form had to be edited to pick this up — which is the
point of having primitives.

---

## 3. Key decisions

### 3.1 The border is a constant 2px — the padding does not compensate

The handoff draws a 1.5px resting border promoted to 2px on focus, and compensates the padding
(13px resting, 11.5px focused) so the text does not shift by half a pixel. Section 5.3 explicitly
advises against reproducing that, and suggests either an `outline`/`box-shadow` or a 2px
transparent border at rest.

Both alternatives were considered:

| Option | Rejected because |
| --- | --- |
| Padding compensation, as drawn | The half-pixel pair has to be maintained in lockstep across four controls. A value that drifts by 0.5px is a text jump on focus that nobody attributes to the right cause. |
| A 0.5px `outline` on focus | Sub-pixel outlines round to 0 or 1 device pixel depending on the display, so the focus indicator would be inconsistent on exactly the hardware where it matters most. |

**What was built:** the width never changes, and the *colour* carries the promotion —
`line.field` (ink at 28%) at rest, full `line` when focused. At 28% alpha the difference between
1.5px and 2px is imperceptible; the focused state is exactly as drawn, 2px of full ink plus
`shadows.hardFocus`.

The cost is that inputs no longer use `borderWidths.thin`, so section 5.2's table is one row
looser than reality. Recorded rather than quietly diverged from, and asserted in a test so a
future "restore the 1.5px" change has to confront the reasoning.

### 3.2 Inputs are 16px on mobile, 15px on desktop

The handoff draws 15px. **iOS Safari zooms the viewport when a focused input's font size is below
16px**, and 15px would trigger it on every field in the app — a reflow the user then has to pinch
back out of. The pre-restyle code used Chakra's `size="lg"` specifically to avoid this, and that
deliberate choice was nearly lost in the rewrite.

`fontSize={{ base: "md", md: "control" }}` keeps both: 16px below the single 768px breakpoint
where the behaviour exists, and the drawn 15px above it. One pixel larger on touch is invisible;
the zoom is not.

### 3.3 The currency symbol is drawn, never stored

The prefix is an `aria-hidden` positioned sibling with `pointer-events: none`, and the input is
padded to clear it. Putting `₹` in the value or the placeholder instead would mean it is submitted
with the form, has to be stripped before parsing, and is read out as though the user had typed it.

Three details that are not arbitrary:

- **`pointer-events: none`** so tapping the symbol focuses the field. Without it there is a
  10px-wide dead zone at the start of the most important input on the form.
- **The padding is derived**: `calc(14px + Nch + 6px)` from the same 14px base the other controls
  use, times the symbol's length, plus a gap. A two-character symbol still fits, and the base
  cannot drift.
- **The symbol comes from `currencySymbol()`**, not a literal `₹`. Multi-currency conversion is out
  of MVP scope but every amount carries a currency (`config/constants.ts`), so `AmountInput` takes
  a `currency` prop defaulting to `INR`.

### 3.4 `outline: none` is paid for immediately

Removing Chakra's focus ring is the single most dangerous thing in this group: done by halves it
leaves controls with no visible focus state at all, and nothing fails. `CONTROL_STYLES` is
therefore the only place `outline: none` appears, and it sits three lines above the
`_focusVisible` that replaces it — so the two cannot be separated by an edit.

`shadows.hardFocus` is a token rather than a literal, which matters here: it flips to `darkTeal`
in dark mode, and a hard-coded `4px 4px 0 #7FD1C3` would be a teal shadow against a dark page.

The invalid state keeps the shadow and changes only the border colour, so a field that is both
invalid and focused still shows where the keyboard is.

### 3.5 The required asterisk stays out of the accessible name

Chakra's `Field.RequiredIndicator` renders the asterisk in `negative`, as drawn, while
`Field.Root required` is what actually announces the requirement. Written the obvious way — a
literal `*` in the label — the field would read as "Amount asterisk" to a screen reader. There is
a test for it.

Similarly, the eyebrow label uppercases through `text-transform`, so the accessible name stays
sentence case. `PAID FROM` in the markup renders identically and makes some screen readers spell
it out.

### 3.6 The native `<select>` is not replaced, and the chevron is ours

`DESIGN.md` is explicit: every dropdown-looking control is a real native `<select>` skinned to
look like a bordered box, and only the chrome is custom. The OS picker on iOS is faster
one-handed and needs no keyboard or screen-reader work of its own. The module comment says "do not
replace this with a custom listbox" in those words, because it is the sort of thing a later group
does for consistency without realising it is a regression.

The one substantive change is swapping Chakra's default chevron for the registry's
`chevron-down`, so the arrow users see most often belongs to the same set as everything else. A
test asserts it by its viewBox, which is what distinguishes our glyph from Chakra's.

### 3.7 One shared style object rather than four styled components

`CONTROL_STYLES` is spread into all four controls. The alternative — a Chakra recipe, or a
`styled` base each control extends — would be more idiomatic, but this is 25 lines of plain object
and it keeps the four states readable in one screen. A recipe would put the resting, focus,
invalid and disabled states in four separate variant blocks, which is harder to check for the
thing that matters: that they agree.

---

## 4. Business rules enforced

- **An error is always text, never a colour.** `Field.ErrorText` still carries the message and
  Chakra still sets `aria-invalid`; the restyle changed the face and the colour and touched
  neither. `docs/06-CODING-PRACTICES.md` section 40.
- **Label, hint and error stay associated with the control.** Untouched, and proven by the six
  original tests passing unedited.
- **Every dropdown is a native select** (9.1), stated as a prohibition in the code.
- **Amounts render in mono with tabular figures** (9.1) — now while being *typed*, not only when
  displayed, because `AmountInput` carries `textStyle="amount"` at the 19px the handoff draws.
- **A currency symbol is presentation, not data.** The value the form submits is the number the
  user typed.

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run verify` (typecheck, lint, 593 unit) | passes |
| `npx vitest run --project ui` (153, +11 here) | passes |
| `npm run build` | compiles clean |
| **visual render of all six field states in light, focused and dark** | see below |

The six original `Field.test.tsx` cases were **not modified**. That was the acceptance criterion
for this group: if a restyle needs an accessibility test rewritten, the restyle changed more than
the appearance.

The visual check earned its place again. A throwaway test rendered every field state — amount with
prefix, text, select, textarea with hint, invalid, disabled — into an HTML file, three times over:
light, light with the focus rule forced on, and inside a `.dark` wrapper. A Playwright screenshot
made it viewable. Both files were deleted afterwards.

It found two bugs that no assertion in this group would have caught, because each control was
individually correct:

- **The select clipped its own text.** Chakra's native-select recipe sets a fixed height per
  `size`, which wins over the padding: "HDFC Savings" lost the bottom of its `g`. Fixed with
  `height: auto`, with a comment saying why.
- **The currency symbol touched the first digit.** `calc(14px + 1ch)` put the `₹` flush against
  the `0`, so "₹0.00" read as one mono token rather than a prefix and a value. Fixed by adding a
  6px gap.

It also raised a false alarm worth recording: the prefix looked absent in the dark pane. Probing
the computed style in the browser showed it resolving to `rgb(155, 150, 179)` — `darkInkTertiary`,
5.9:1 on `darkSurface`, correct. The screenshot was simply hard to read at that scale. Measuring
beat squinting.

**Not verified.** Focus was asserted as a *declaration*, not simulated: jsdom does not apply
`_focusVisible`, so the tests confirm `outline: none` reaches every control and that the
replacement is declared, not that the teal shadow paints on tab. Group 40 keyboard-walks every
control in a real browser, and that is where this is actually proven. No form screen has been
looked at yet either — these are primitives, and groups 33 to 39 put them on pages.

---

## 6. Known gaps

- **Divergence from 5.2**: inputs use a constant 2px border rather than 1.5px promoted to 2px
  (3.1). Visual intent preserved, one table row in the design document now inaccurate.
- **Divergence from 4.2**: inputs are 16px below 768px rather than the drawn 15px (3.2).
- **Focus is not proven to paint** (5). Deferred to group 40.
- **No `calendar` glyph on the date field.** Section 6.2 draws one and 7.2 does not ask for it, so
  the date input is currently a plain `TextInput` with `type="date"`, using the browser's own
  picker affordance. Whether the design wants a custom one is a question for groups 36 and 41.
- **`AmountInput` does not validate or mask.** It is `inputMode="decimal"` and nothing more:
  parsing and rounding stay in the Zod schemas and `lib/money`, which is correct, but it means a
  user can type letters and only find out on submit. Unchanged from before the restyle, and out of
  scope for a visual group.
- **The disabled treatment is untested against a real disabled form.** `surface.disabled` and
  `content.quiet` are declared and were rendered in the sheet; `content.quiet` on
  `surface.disabled` measures 4.17:1, which WCAG exempts for inactive controls but is below the
  floor the rest of the palette holds (group 21 section 3.8). Group 40 decides whether to accept
  it.
- **No field is inside a restyled card yet**, so the vertical rhythm between fields (the `gap="8px"`
  on `Field.Root` and the 22px between fields in the handoff) has only been seen in isolation.
  Group 36 owns the form layout.

---

## 7. Notes for the next group

Group 27 (buttons) is the other half of what every form is made of, and two things here bear on it:

- **`outline: none` needs a visible replacement on buttons too**, and the ghost/Cancel button is
  the hard case — it has no border to promote, which is exactly the element 9.3 flags. Whatever it
  gets should use `shadows.hardFocus` so both halves of a form focus alike.
- **The disabled treatment is already defined** in `CONTROL_STYLES` (`surface.disabled`,
  `content.quiet`, `content.quiet` border). 7.1 specifies the same three values for a disabled
  button, so reuse the values rather than re-deriving them.

For every group that builds a form:

- **Use `Field` for every labelled control.** It is the only thing guaranteeing the label, hint
  and error wiring, and the eyebrow label comes with it.
- **Pass validation messages as `errors`**, not as ad-hoc text below the control. That is what
  sets `aria-invalid` and switches the hint off so only one message shows.
- **Use `AmountInput` for money**, never `TextInput` with a `₹` typed into the placeholder.
- **Do not set `fontSize` on a control.** The responsive pair in 3.2 exists for a reason, and
  overriding it to the drawn 15px reintroduces the iOS zoom.

One trap: `CONTROL_STYLES` is spread **before** `{...props}` in every control, so a call site can
override any of it — including `outline` and `_focusVisible`. That is deliberate (it keeps the
components usable) but it means a stray `borderWidth` or `outline` prop at a call site will
silently win. If a form looks wrong, check what it is passing before changing the primitive.
