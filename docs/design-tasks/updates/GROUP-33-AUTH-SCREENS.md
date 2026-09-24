# Group 33 — Auth Screens

Sign-in rebuilt to `Login.html`, sign-up designed from the same parts, and a prefix bug that had been
hiding the currency symbol on every amount field.

---

## 1. What was built

The unauthenticated screens are now three bands on graph paper: the diamond wordmark, a 440px card
with corner ticks and an 8px offset shadow, and a line of mono text at the foot stating the product's
central rule. Inside the card: a teal tracked eyebrow, a 26px heading, mono field labels, and — on
sign-in only — an envelope and a padlock drawn inside the two inputs.

Sign-up is not drawn anywhere in the handoff. It uses the same card, eyebrow, heading, fields, button
and foot-of-card link at the same measurements, so the two read as a pair.

**The bug worth reading about is section 3.5.** Chakra's Input recipe sets `position: relative`, which
meant the new prefix icons painted *behind* the input — and so had `AmountInput`'s `₹`, invisible since
group 26 and passing every test.

---

## 2. Files added or changed

### Added

| File | Purpose |
| --- | --- |
| `src/features/auth/components/AuthHeading.tsx` | The eyebrow + `h1` pair, shared by both auth screens. |
| `tests/ui/auth-screens.test.tsx` | 13 tests: the prefix construction, the heading, and the two decisions easiest to undo by accident. |

### Changed

| File | Change |
| --- | --- |
| `src/components/ui/Field.tsx` | New internal `InputPrefix`, used by both prefixed controls — **carries the `z-index` fix**. `TextInput` gains an optional `icon`. `AmountInput` now uses `InputPrefix` instead of its own copy. |
| `src/components/layout/DiamondMark.tsx` | New `xl` size (22px), the size `Login.html` draws above the card. |
| `src/app/(auth)/layout.tsx` | Three-band flex column; wordmark instead of an `h1`; card 440px with 44px/40px padding; the ledger footer line. |
| `src/app/(auth)/login/page.tsx` | `AuthHeading eyebrow="Ledger access" title="Sign in"`. |
| `src/app/(auth)/register/page.tsx` | `AuthHeading eyebrow="New ledger" title="Create your account"`. |
| `src/features/auth/components/LoginForm.tsx` | `mail` and `lock` prefixes, 22px field rhythm, ink foot-of-card link, and a docblock recording why the failure message stays ambiguous. |
| `src/features/auth/components/RegisterForm.tsx` | Matching rhythm and link; a docblock recording why it carries **no** prefix icons. |

`loginAction` was **not** touched. Its generic failure message was already correct; this group pins it
with a test instead of changing it.

---

## 3. Key decisions

### 3.1 The page title is the `h1`; the product name is a wordmark

The layout used to render "Expense Tracker" as the `h1` with "Sign in" below it as an `h2`. That is
backwards twice over: `Login.html` draws the product name as a lockup and `Sign in` as the 26px
heading, and a page's `h1` should name the page rather than the product it belongs to. Both auth
screens previously announced the same heading, so a screen-reader user could not tell them apart from
the heading alone.

Now the lockup is a `DiamondMark` plus a `span`, and each page owns an `h1`.

### 3.2 Three flex bands, not the artboard's absolute insets

`Login.html` pins the lockup 48px from the top and the footer 48px from the bottom, with the card
absolutely centred. Reproduced literally, a 402px phone — where the sign-up card is 900px tall — would
have all three bands overlap.

A flex column with the card in a `flex: 1` middle band puts everything in the same place on a 1440×900
desktop (measured: lockup top 48px, footer bottom gap 48px) and degrades to ordinary stacked flow on a
phone, where the insets drop to 32px.

### 3.3 Prefix icons on sign-in only

Sign-in has two fields and two glyphs everyone recognises on sight. Sign-up has six, and three of them
— name, currency, timezone — have no glyph in the registry that means what they mean. `people` is the
section icon for *other* people, not for the visitor's own name, and the two selects cannot carry a
prefix at all.

Icons on the two familiar fields and nothing on the other four reads as unfinished, so sign-up carries
none. Its mono labels are doing the same work. This is pinned by a test, because it looks like an
omission.

### 3.4 The icon is a prop on `TextInput`, not a new component

`AmountInput` is a separate component because a currency symbol is *intrinsic* to an amount field —
the field cannot be understood without it. An icon is decoration on an otherwise ordinary text input,
so it is an optional prop, and a field without one renders the same unwrapped `<Input>` it always did.

### 3.5 The bug: a positioned input painted over its own prefix

The icons were in the DOM, 15×15, at exactly 14px from the field's edge, with `stroke` resolving to
`rgb(106,102,130)`, `visibility: visible`, `opacity: 1`. And invisible on screen.

**Chakra v3's Input recipe sets `position: relative`.** Two positioned siblings with `z-index: auto`
paint in DOM order, and the prefix is the first child — so the input, which has an opaque `surface`
background, painted over it.

`AmountInput` has used the same construction since group 26, which means **the `₹` on every amount
field in the app had been invisible too**. Group 26's update document records verifying it by
rendering, and the rendered harness did not reproduce it.

The fix is `z-index: 1` on the prefix, which works whatever the DOM order. `pointer-events: none` is
what makes raising it safe — the field stays clickable through the glyph. Both prefixes now come from
one `InputPrefix`, so a third cannot reintroduce the bug.

**The lesson is about the tests, not the CSS.** Every DOM assertion passed, in jsdom and in the
browser, because *neither getComputedStyle nor a bounding box tells you what is on top*. A screenshot
found it. Anything whose correctness is "this is visible" needs a rendered image, not a measurement.

### 3.6 The foot-of-card link is ink, not teal

`AppLink` is `brand.fg`, and the handoff draws this one link in full ink with a 600 weight and a 3px
underline offset. The reason is visible once both are on screen: the link sits directly below a
full-width teal button, and a teal link there competes with it. The weight and the underline carry the
affordance instead. Overridden at the two call sites rather than adding a variant, since there are
exactly two and they are the same sentence.

### 3.7 No placeholder on the password field

The artboard draws a row of bullets. An empty field whose placeholder is bullets looks filled in, and
the browser's own masking already shows them the moment anything is typed.

### 3.8 The eyebrow wording for sign-up

Sign-in's is `LEDGER ACCESS`, from the handoff. Sign-up is not drawn, so `NEW LEDGER` was written to
sit in the same register: the noun is the ledger, and this is the screen that opens one.

### 3.9 The footer line is a product rule, not a slogan

"Every entry timestamped · Nothing stored that can't be recomputed" is `docs/01-MVP-SCOPE.md` section
4 stated on the way in — the same claim the dashboard's `AS OF` eyebrow makes on the inside. Worth
building rather than dropping as decoration, because it is true and load-bearing.

---

## 4. Business rules enforced

- **A failed sign-in never says which half was wrong.** `loginAction` returns one string — "Email or
  password is incorrect." — for a wrong password and for an address that has never registered.
  Distinguishing them turns the form into an account-enumeration oracle
  (`docs/12-SECURITY-AND-ERROR-HANDLING.md`). Verified in a browser: the message is a form-level
  `role="alert"` and **zero fields are marked `aria-invalid`**. Attaching it to the password field
  would leak the same thing visually.
- **Currency and timezone are captured at sign-up.** Every later amount and every daily or monthly
  grouping depends on them, so they cannot be deferred to a settings screen that does not exist.
- **Validation failure is never colour alone.** Each invalid field gets a coral border *and* a mono
  message beneath it, and the form gets a summary alert. The border is the addition; the text is the
  message.
- **The required marker is decorative.** `Field.Root required` is what announces the requirement;
  Chakra's indicator keeps the asterisk out of the accessible name, so a label does not read as "Email
  asterisk".

---

## 5. How it was verified

### Suites

```text
npm run verify          typecheck + eslint + unit    611 pass
npm run test:integration                             508 pass
npx vitest run --project ui                          286 pass  (273 + 13)
npx vitest run --project offline                      150 pass
npm run build                                        clean
npx eslint src tests                                 clean
```

`src/components/ui/Field.test.tsx` passes **unedited**, which is the intended proof that adding the
icon changed nothing for the fields that do not use one.

### Measured in Chromium, against `Login.html`

| | Drawn | Measured (1440×900) |
| --- | --- | --- |
| Card | 440px, 2px ink, `8px 8px 0` | 436px content + 2×2px border = **440**, `rgb(30,27,41) 8px 8px 0` |
| Eyebrow | 11px mono, `#1D7A6C`, 0.1em | `11px`, `rgb(29,122,108)`, `1.1px` = 0.1em |
| Heading | 26px Space Grotesk 700 | `26px`, one line |
| Prefix glyph | 15px at left 14px | `15×15` at **left 14** |
| Glyph colour | `#8B87A0` | `rgb(106,102,130)` = `#6A6682` — group 21's AA replacement |
| Input padding | `padding-left: 40px` | `40px` |
| Wordmark | 48px from the top | top **48** |
| Footer | mono, 48px from the bottom | `"IBM Plex Mono"`, bottom gap **48** |
| Ticks | four corner brackets | 4 |

At 402px: card 366px, `h1` one line, no horizontal overflow, the currency/timezone pair stacked at
318px each, wordmark and footer insets 32px.

### The two error states

- **Sign-up, empty submit.** Three fields `aria-invalid`, border `rgb(209,82,63)` = `#D1523F` =
  `negative`, a mono message under each, and a coral summary alert. Checked at 1440px and 402px.
- **Sign-in, wrong credentials.** `role="alert"` reading "Email or password is incorrect.",
  `negative.surface` = `rgb(255,199,184)`, and **0 fields marked invalid**.

### Both modes

Sign-in captured at 1440px and 402px in light and dark. Dark: graph grid on `darkPaper`, teal eyebrow,
light `h1`, both glyphs visible, teal button with the light offset shadow.

### Zoomed

The prefix fix was confirmed by cropping the two fields at `deviceScaleFactor: 3` — the envelope and
the padlock are drawn — and separately by cropping an amount field, where `₹ 0.00` now appears. That
crop is the only evidence that mattered; every measurement had already said the glyph was fine.

---

## 6. Known gaps

- **Sign-up has no artboard.** Section 10 lists it as undrawn and it still is. What was built is a
  faithful recomposition of sign-in's parts, but the field order, the two-up currency/timezone row,
  and the `NEW LEDGER` eyebrow are all inventions. **Needs designer review.**
- **The `xl` diamond and the footer line are undrawn combinations.** The 22px mark is drawn in
  `Login.html`; adding it to the `DiamondMark` size scale is ours. The footer text is drawn; its
  wrapping to two lines at 402px is not.
- **No password-reset screen exists.** Out of MVP scope. `AuthHeading` is where a third auth screen
  plugs in.
- **No "show password" toggle.** Not drawn, and not added: it needs a button inside the field, which
  is a different construction from the read-only prefix and would want its own review.
- **The prefix fix is a `z-index`, not a guarantee.** If a future control wraps the input in something
  that creates a stacking context between the two, the prefix can be re-buried. The test pins the
  declaration; only a screenshot can pin the outcome.
- **Unreviewed by the designer:** the ink foot-of-card link (3.6), the absence of icons on sign-up
  (3.3), the missing password placeholder (3.7), and the `NEW LEDGER` eyebrow (3.8).

---

## 7. Notes for the next group

- **`<TextInput icon="…" />` is available everywhere, and should stay rare.** It is drawn on sign-in
  only. An icon on a field whose label is its sole explanation adds nothing; an icon on half a form's
  fields looks broken.
- **Any new input prefix must go through `InputPrefix`.** It is not a convenience — it carries the
  `z-index` that makes a prefix visible at all (3.5).
- **Screenshot anything whose correctness is "it is visible".** `getComputedStyle` and bounding boxes
  cannot see paint order. This group lost a pre-existing bug to exactly that gap for seven groups.
- **`AuthHeading` is the pair of the eyebrow and the page `h1`.** A third auth screen should use it
  rather than re-deriving the sizes.
- **`DiamondMark` now has four sizes**: 8px filter marker, 14px mobile header, 16px desktop header,
  22px auth lockup.
- **Group 36 (transaction forms)** now has a working currency prefix to design around — the `₹` it
  will place in the side rail's reference box is visible for the first time, so the amount field's
  spacing is worth re-checking against `AddExpense-Light.html` rather than trusting group 26's
  measurements.
- **Group 40** should include the two prefix glyphs in the contrast pass (`content.subtle` on
  `surface`) and keyboard-walk both auth forms, including that the prefix is not a tab stop.
- **Group 41** should capture `01-login`, `02-login-invalid-credentials`, `03-register` and
  `04-register-validation-errors` afresh — all four of the existing screenshots predate this group.
