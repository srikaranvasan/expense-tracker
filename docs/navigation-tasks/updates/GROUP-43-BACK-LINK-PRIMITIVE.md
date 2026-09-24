# Group 43 — The Back Link Primitive

The component every other group in this series consumes, plus the one glyph it needed.

---

## 1. What was built

`BackLink` — a single hop upward, rendered above a page title. Two props, one anchor, no history
call.

```tsx
<BackLink href="/accounts" label="Accounts" />
```

```text
visible          [‹] ACCOUNTS
accessible name  "Back to Accounts"
renders          <a href="/accounts" aria-label="Back to Accounts">
```

Before this the application had no back affordance of any kind — no back button, no breadcrumb,
and no page that named its own parent. The only thing pointing upward anywhere was `FormActions`'
Cancel, and that was a `router.back()`.

Also added: `chevron-left`, the glyph the app turned out not to have.

---

## 2. Files added or changed

| File | Change |
| --- | --- |
| `src/components/layout/BackLink.tsx` | **New.** The primitive |
| `src/components/layout/BackLink.test.tsx` | **New.** 5 tests, all passing |
| `src/components/icons/names.ts` | `chevron-left` added to `IN_HOUSE_GLYPHS`; the "Fourteen in total" note now says fifteen and says why |
| `src/components/icons/registry.tsx` | The `chevron-left` drawing; header count 28/14 → 29/15 |
| `src/components/icons/names.test.ts` | `IN_HOUSE_GLYPHS` 14 → 15, `ICON_NAMES` 43 → 44 |

Nothing else. The primitive is not wired into any page here — group 44 does that through
`PageHeader`.

---

## 3. Key decisions

### 3.1 No `router.back()` in it, at all

The whole design. `BackLink` navigates to a fixed `href`, so it behaves the same whether the user
clicked in from a list, followed a shared URL, refreshed, or arrived from the quick-add button on
an unrelated screen.

`router.back()` fails all but the first of those (audit 4.3). Worth restating because "just use
the browser's back" is the obvious objection to this whole series: the browser's back button
walks **history**, and a back link states **hierarchy**. On a cold URL they are not the same
thing, and a cold URL is how a shared link, a bookmark and a refresh all arrive.

### 3.2 Two names, not one

Visible `ACCOUNTS`; accessible name `Back to Accounts`.

A visible "← Accounts" is compact and conventional and does not spend a phone header's width on
the word "Back". But a screen-reader user hearing a flat list of links gets no spatial context
from the page, and "Accounts" alone does not say it goes anywhere.

The order matters for WCAG 2.5.3 *Label in Name*: the visible string has to be **contained in**
the accessible name, so speech input ("click Accounts") still works. Visible "Accounts" inside
"Back to Accounts" satisfies it. The reverse — visible "Back", accessible name "Accounts" —
would fail, which is the trap here and the reason it is asserted in a test.

### 3.3 Reuses `CardActionLink`'s register, not its code

Mono uppercase eyebrow, `brand.fg`, underline on hover and focus only. The argument in
`AppLink.tsx` carries over unchanged: a bordered button in this position would compete with the
page header's own primary action ("Edit", "Settle up", "Pay card"), while the eyebrow treatment
reads as a quiet way onward.

It does **not** wrap `CardActionLink`. It needs a leading glyph and its own accessible-name rule,
and threading both through that component would make its contract worse for the eight callers
that want neither. What is shared is `textStyle="eyebrow"` — a token, which is the right unit of
sharing for a visual register.

### 3.4 `chevron-left` is drawn, not rotated

`names.ts` had 43 glyphs with `chevron-down` and `chevron-right` and no left-facing chevron.

Added as `M10 3L5 8L10 13` — `chevron-right`'s `M6 3L11 8L6 13` mirrored — at the same
`stroke: 2` in the same 16-unit box, so the two weigh identically on screen.

Rejected: `transform: rotate(180deg)` on `chevron-right`. It rotates the stroke caps too, which
is visible at 14px, and the registry's stated rule is that geometry lives in path data so a
contact sheet of the set can be read by reading the file.

Note the compiler enforces the pair — `ICONS` is typed `Record<IconName, IconGlyph>` — so this
was two edits, and one alone would have failed the build. That is the mechanism working as
designed.

### 3.5 Truncation on the label, not the link

A record name can be long ("Weekend trip to Coorg with the office"), and at 402px it would wrap.
A two-line back link reads as a heading rather than a control, so the text ellipses and the
chevron keeps its full 14px. The accessible name carries the untruncated destination either way.

---

## 4. Business rules enforced

None. This is a presentation primitive with no knowledge of money, and that is deliberate — it
takes an `href` and a string and has no opinion about what it points at.

---

## 5. How it was verified

```text
npx vitest run --project ui  src/components/layout/BackLink.test.tsx    5 passed
npx vitest run --project unit src/components/icons/names.test.ts       47 passed
npx vitest run --project ui  src/components/icons/registry.test.tsx   102 passed
```

The five assertions, and why each is worth its line:

| Assertion | What it prevents |
| --- | --- |
| renders a `link` role, and **no** `button` | somebody "simplifying" it into a `router.back()` handler |
| `href` is the one passed in | a link that looks right and goes nowhere |
| accessible name is `Back to <label>` | a screen-reader link list of bare destination names |
| visible text is the bare label, and *not* "Back to" | WCAG 2.5.3, which the reverse arrangement fails |
| the chevron is `aria-hidden` | the glyph announcing what the name already says |

The icon count tests are the interesting ones: they were **already asserting 43**, so adding a
glyph without updating them failed the suite. That is the drift guard from group 25 doing its job
on a change made a year later.

Not verified here: how it looks in place. It is not rendered on any page until group 44, and its
appearance at both widths and in both themes is reviewed from the recaptured screenshots in group
48.

---

## 6. Known gaps

- **No designer sign-off.** `BackLink` introduces no new token and no new colour, but its
  placement above the page title is not drawn in any artboard — there is no back affordance
  anywhere in `design/ux/screens/`. It joins the review queue in
  `design/screenshots/README.md` section 6.
- **`chevron-left` is the fifteenth in-house glyph awaiting review**, alongside the fourteen from
  groups 25 and 24.
- **No visual regression test.** Consistent with the rest of the project, which measures geometry
  in a browser and records the numbers in an update document rather than storing image
  baselines.

---

## 7. Notes for the next group

Group 44 adds `parent?: { href, label }` to `PageHeader` and renders this component from it.

The one thing to be careful about: **do not put the back link inside the title row.** That row is
`align="baseline"` on desktop, and baseline alignment uses each flex item's first baseline — so a
back link above the heading *inside* the title's `Box` would become the baseline that `meta` and
`action` align to, dropping the dashboard's `AS OF` eyebrow by about 20px. It belongs in a wrapper
above the row.
