# Group 27 — Buttons And Actions

The five tones, the icon-only variant, the link treatments — and the fix for the bug that left the
application with no reachable Cancel anywhere. Section 7.1 of
[`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md), and the defect in 9.2.

---

## 1. What was built

- **Five button tones**, transcribed from `Style-Guide.html`: primary, secondary, ghost, danger,
  and one disabled treatment that applies to all four.
- **`IconButton`**, a square with a centred glyph and a **required** `aria-label`.
- **`FormActions`** — a new component that owns the submit-and-cancel row. This is the fix for the
  clipped-Cancel bug, and it is a component precisely so the bug cannot come back.
- **Three link treatments**: inline `AppLink`, the mono uppercase `CardActionLink` from 7.3, and
  the restyled `RowLink`.
- **The header's sign-out is now icon-only**, which is half the fix for the crushed mobile title.

Eight forms were converted. Twenty new tests. The Cancel fix was measured in a real browser at the
402px width the bug was reported at.

---

## 2. Files added or changed

**Primitives**

| File | Change |
| --- | --- |
| `src/components/ui/Button.tsx` | rewritten. `TONE_STYLES`, `SIZE_STYLES`, `DISABLED_STYLES`, plus `IconButton` |
| `src/components/ui/FormActions.tsx` | **new.** The submit-and-cancel row |
| `src/components/ui/AppLink.tsx` | rewritten. `AppLink`, `CardActionLink` (new), `RowLink` |
| `src/components/ui/Button.test.tsx` | **new.** 20 tests over Button, IconButton and FormActions |

**Forms converted to `FormActions`** — all eight, each losing its hand-rolled `HStack`:

`AccountForm`, `PersonForm`, `CategoryForm`, `SettleUpForm`, `CardPaymentForm`, `ExpenseForm`,
`SharedExpenseForm`, `TransferForm`.

**Other**

| File | Change |
| --- | --- |
| `src/features/auth/components/SignOutButton.tsx` | now an `IconButton` with the `sign-out` glyph |
| `src/components/theme/ColorModeToggle.tsx` | uses `IconButton` instead of hand-setting `px`/`minW` |
| `src/features/categories/components/CategoryForm.tsx` | `onDone` is now **required** (3.4) |

---

## 3. Key decisions

### 3.1 `FormActions` is a component, not a documented pattern — this is the whole group

The clipped-Cancel bug was not a styling slip. Eight forms had independently written:

```tsx
<HStack gap="3">
  <Button type="submit" fullWidth>Save</Button>
  <Button tone="secondary">Cancel</Button>
</HStack>
```

`fullWidth` is `width: 100%` of the row, so Cancel was pushed past the right edge and clipped — at
both widths, on every create and edit form. **There was no reachable way to cancel anything in the
application.**

Editing eight copies would have fixed it once. A ninth form would reintroduce it, because the
broken version is the one that looks obvious: a prominent full-width primary with a Cancel beside
it is what everyone writes. So:

- the row is a component;
- the submit button is **built by it**, not passed in, so no call site can make it full-width;
- `onCancel` is **required**, so the row cannot be rendered without a way out;
- `Button`'s `fullWidth` doc comment now points at `FormActions` and says why.

The geometry is section 7.1's: submit `flex: 1`, Cancel `flex-shrink: 0` with `white-space: nowrap`,
Cancel after the primary. `flex: 1` rather than `width: 100%` is the entire fix — the primary
absorbs what is left instead of claiming everything.

`wrap="wrap"` is on the row deliberately. If a translated label ever does make the row too long,
the honest failure is a second line, not a hidden button.

### 3.2 Chakra's `variant` and `colorPalette` recipes are bypassed

The old component mapped tones onto `solid`/`outline`/`ghost` plus a colour palette, which was
right for the previous language. These tones differ in fill, border colour, shadow **and** whether
the label is underlined — no combination of Chakra's two axes expresses that, and layering
overrides on top of a recipe means two sources of truth for the same pixel.

`TONE_STYLES` is longer and says exactly what the style guide draws. The four tones sit side by
side in twenty lines, which is what makes it possible to check them against the handoff by reading.

### 3.3 The ghost button keeps a transparent 2px border

Not decoration. It keeps Cancel the same height as the bordered Save it shares a row with;
without it the ghost button sits 4px shorter and the row looks misaligned. The handoff draws it
exactly this way (`border: 2px solid transparent`), and there is a test, because "a transparent
border" is the first thing someone deletes as redundant.

### 3.4 Focus: the teal offset shadow, on every tone

The theme's reset removes Chakra's ring, so every tone has to put a visible state back. One rule —
`_focusVisible: { boxShadow: "hardFocus" }` — covers all four, and it reads differently but
clearly in each case:

- **primary** and **danger** already carry `hard`, so focusing **changes the offset shadow from ink
  to teal**. A 4px shadow changing colour is unmistakable.
- **secondary** and **ghost** have no shadow, so focusing makes one appear.

`ghost` is the case section 9.3 flags as a risk: no border to promote, no fill to change. The offset
shadow works there because it does not need a border to hang off. Verified by rendering the row
with focus forced on — the ghost Cancel shows a clear teal offset.

Using the token rather than a literal matters: `hardFocus` flips to `darkTeal` in dark mode, and a
hard-coded `4px 4px 0 #7FD1C3` would be a light-mode teal shadow on a dark page.

### 3.5 One disabled treatment, shared with the form controls

`DISABLED_STYLES` applies to all four tones, because disabled is a state of the control and not a
variation on its meaning — a disabled danger button is not a *slightly* dangerous button.

The three values (`surface.disabled`, `content.quiet`, `content.quiet` border) are the same ones
`CONTROL_STYLES` in `Field.tsx` uses, so a disabled Save and a disabled input match. That was group
26's note to this group, and reusing the values rather than re-deriving them is the point.

It is also applied to `_loading`, which is easy to miss: Chakra renders `loading` as a disabled
button with a spinner, and without this a submitting form flashes a full-strength button under the
spinner.

### 3.6 `aria-label` is a required prop on `IconButton`

Not optional with a lint rule, not documented in a comment — required in the type. An icon-only
control without an accessible name is announced as "button", and a required prop is the only
mechanism that reliably stops that reaching a screen.

`IconButton` also overrides the size map's inline padding to zero and sets `minW="touch"`, so the
glyph sits centred in a square that is already the minimum touch target. That is both the design
(7.1: "a plain square with the glyph centred") and the accessibility floor, in one place rather
than re-specified at each of the two call sites.

### 3.7 `CategoryForm`'s `onDone` became required

It was optional, which made Cancel conditional — a form whose way out depends on a prop is the same
defect as the clipped Cancel arriving by another route. Both existing call sites in
`CategoryManager` already passed it, so this is a type change with no behavioural one, and
`onDone?.()` became `onDone()`.

### 3.8 Three link treatments, because the design uses links three ways

| Component | Treatment | Why |
| --- | --- | --- |
| `AppLink` | `brand.fg`, underlined, 600 | Inline in a sentence. The underline is **not optional**: `brand.fg` against body copy is a hue difference, and a link identified by colour alone fails WCAG 1.4.1. |
| `CardActionLink` | `textStyle="eyebrow"`, `brand.fg`, no underline at rest | 7.3 is specific that a card's header action is a mono uppercase link, **not a button** — a button there competes with the page's primary action. Safe without an underline because mono + uppercase + tracking already distinguishes it from body copy, so colour is not the only signal. |
| `RowLink` | no underline, `content` colour, whole-row target | The row's *content* is the label; underlining an account name and its balance would be unreadable. The affordance is the row, which is why the hover fill and focus shadow cover all of it. |

All three get `_focusVisible: { boxShadow: "hardFocus" }`. A link has no border to promote, so
without it they would have no focus indicator once the reset removes Chakra's. `RowLink` adds
`position: relative; z-index: 1` on focus so its shadow is not clipped by the rows above and below
it inside a card.

### 3.9 `fullWidth` was kept, not removed

Five call sites legitimately want a full-width button with no sibling: the two auth submits, the
dashboard quick actions, the activity list's "Load more", and one page-level action. Removing the
prop would have forced `width="full"` at each of them, which is the same thing spelled worse.

The prop is not the bug. `fullWidth` *beside a Cancel* is the bug, and `FormActions` is what makes
that arrangement unrepresentable.

---

## 4. Business rules enforced

- **Every form has a reachable way out.** The audit found eight forms with a clipped Cancel and one
  with a conditional one; all nine now use `FormActions` with a required `onCancel`. The two auth
  forms have no Cancel by design — sign-in is an entry point with nothing to return to — and both
  carry a link to the other (`Create one` / `Sign in`), so neither is a dead end.
- **A destructive action never sits where Save does.** `FormActions` puts extra children *after*
  Cancel and outside the flex-grow, so a "Delete expense" cannot squeeze Cancel or take the primary
  position.
- **Submission can be blocked without trapping the user.** `submitDisabled` disables only the
  submit; the settle-up form's unbalanced state leaves Cancel live. There is a test, because
  disabling both is the obvious shortcut and it traps the user on a form they can neither submit nor
  leave.
- **No interactive element loses its focus indicator** (9.3). Every tone and all three link shapes
  declare a replacement in the same file that removes the default.

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run verify` (typecheck, lint, 593 unit) | passes |
| `npx vitest run --project ui` (173, +20 here) | passes |
| `npm run build` | compiles clean |
| grep audit of `fullWidth` and `Cancel` across `src/**` | eight action rows found and converted; five legitimate standalone `fullWidth` uses left alone |
| **visual render of all five tones plus both action rows, in light, dark and focused** | correct |
| **layout measurement at a 402px viewport** | the evidence below |

### The Cancel fix, measured

jsdom does no layout, so "Cancel is visible" is not assertable there — an overflowing element is
still visible to jsdom. So the row was rendered into a 366px column inside a 402px viewport, the
exact width the bug was reported at, and the geometry read out of the browser:

```text
column                    left  18   right 384
"Record shared expense"   left  18   right 271   width 253
"Cancel"                  left 283   right 384   width 101
```

Cancel's right edge lands exactly on the column's right edge — fully inside, at its full 101px,
unwrapped. The submit took 253px, absorbing the remainder rather than claiming all 366. That is the
bug fixed, with numbers.

The unit tests assert the *property* that caused the overflow rather than the appearance: submit
`flex: 1 1 0%` and not `width: 100%`, Cancel `flex-shrink: 0` and `white-space: nowrap`, and Cancel
second in DOM order.

### What the visual check confirmed

Primary teal with ink border, label and 4px ink shadow; secondary white with no shadow; ghost
underlined with no border; danger coral with ink label (ink measures 11.4:1 on coral, against 3.4:1
for coral text on coral); disabled grey with no shadow. In dark mode the fills become their dark
counterparts, the shadows flip to `darkInk`, and the labels stay ink. With focus forced on, all
five show the teal offset — including the ghost Cancel.

**Not verified.** Focus was not exercised by actually tabbing: jsdom does not apply
`_focusVisible`, and the visual check forced the rule with CSS rather than moving the keyboard
focus. Group 40 tab-walks every control in a browser. The eight converted forms have also not been
opened as pages — the row was measured in isolation, and group 36 is where the forms themselves are
laid out and looked at.

---

## 6. Known gaps

- **The quick-add pill label** (7.1's third padding case, `6px 12px`) is not built. It belongs to
  the FAB menu, which is group 31.
- **`Button` has no icon-plus-label arrangement.** Several screens will want a leading glyph in a
  button — the dashboard quick actions draw one. It works today by passing an `<Icon>` as a child
  next to the text, and Chakra's flex gap handles the spacing, but there is no `leadingIcon` prop
  and no test that the gap matches the handoff. Group 34 is the first real consumer.
- **`SIZE_STYLES` has three sizes and the handoff draws two.** `sm` (8px/12px) is an interpolation
  for dense contexts such as a card header action that is genuinely a button. It has one call site
  and has not been reviewed against anything.
- **Hover states are minimal.** `primary` darkens to `brand.emphasized`, `secondary` and `ghost`
  pick up `surface.muted`, `danger` does not change at all — the handoff draws no hover state, so
  these are inventions kept deliberately quiet. `danger`'s lack of one is inconsistent and should
  be settled with the designer.
- **The disabled contrast is below the palette's floor.** `content.quiet` on `surface.disabled`
  measures 4.17:1. WCAG exempts inactive controls, so this is compliant, but it is the same
  residual limit group 26 recorded. Group 40 decides whether to accept it.
- **No form page has been opened.** Section 5.

---

## 7. Notes for the next group

Group 28 (surfaces) needs `CardActionLink` for card headers — it is built and unused, so it will be
exercised for the first time there. Two things about it: it is a link and not a button by design
(3.8), and it already carries `minH="touch"`, so do not add padding to make it hittable.

For every screen group from here:

- **Use `FormActions` for a submit-and-cancel row.** Never `<Button fullWidth>` beside a Cancel;
  that is the bug (3.1). If a form needs a third action, pass it as a child — it lands after Cancel
  and cannot squeeze it.
- **Use `IconButton` for any icon-only control**, and the compiler will make you name it.
- **Use `tone` to say what the action means**, never `bg`/`borderColor` on a `Button`. If a screen
  needs a tone that does not exist, that is a conversation with the designer, not a prop override.
- **Do not set `boxShadow` on a button.** The tone already decides it, and overriding it breaks the
  focus state, which is expressed through the same property.

One trap: `TONE_STYLES` is spread **after** `SIZE_STYLES` and **before** `{...rest}`, so a call
site can still override any of it — including `outline` and `boxShadow`. That keeps the component
usable, but it means a stray prop at a call site silently wins over the tone. If a button looks
wrong, read the call site before editing `Button.tsx`.
