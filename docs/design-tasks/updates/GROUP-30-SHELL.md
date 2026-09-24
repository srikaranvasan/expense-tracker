# Group 30 — Application Shell And Navigation

The chrome every screen sits in, and the second half of the crushed-mobile-title fix. Section 7.5 of
[`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md), with the layout rules from section 8.

> This group also found and fixed a **latent bug from group 23** that had made every
> `bg="surface"` in the application transparent for four groups. Section 3.1.

---

## 1. What was built

- **A restyled desktop header**: 58px, diamond mark, icon-and-label navigation with a teal active
  underline flush to the bottom rule, user badge, icon-only colour-mode toggle and sign-out.
- **A slim mobile header**: 50px, no navigation, no user name, no wide text button — which is what
  the crushed title was caused by.
- **`BottomNav` as icon-over-label** with the same active underline idiom as the desktop nav.
- **`PageHeader` stacks** its title and action below 768px, and gained a `meta` slot.
- **The `AS OF` render-timestamp eyebrow** on the dashboard.
- **The content column widened to 1360px** and the page gutters set to the drawn 18/40px.
- **The install prompt** restyled as a bordered band with the `install` glyph.

Plus `DiamondMark` and a shared `NAV_ITEMS` module, and 20 new tests.

Everything was measured in a real browser at 1440px and 402px, and captured in both colour modes.

---

## 2. Files added or changed

**New**

| File | Purpose |
| --- | --- |
| `src/components/layout/DiamondMark.tsx` | the rotated-square logo mark, at three sizes |
| `src/components/layout/NavItems.ts` | `NAV_ITEMS` and `isActiveNavItem`, shared by both navigations |
| `src/components/layout/HeaderNav.tsx` | the desktop nav; the only client-side part of the header |
| `src/components/layout/AppHeader.tsx` | the header itself, one tree at both widths |
| `tests/ui/shell.test.tsx` | 20 tests |

**Rewritten or restyled**

| File | Change |
| --- | --- |
| `src/components/layout/AppShell.tsx` | delegates the header to `AppHeader`; gutters and vertical rhythm from section 8 |
| `src/components/layout/BottomNav.tsx` | icon over label, shared items, active underline, 64px |
| `src/components/layout/PageHeader.tsx` | stacks below `md`; new `meta` slot; drawn type sizes |
| `src/features/pwa/components/InstallPrompt.tsx` | bordered band, `install` glyph, mono step list |
| `src/app/(app)/dashboard/page.tsx` | the `AS OF` eyebrow |

**The group 23 fix** (3.1)

| File | Change |
| --- | --- |
| `src/theme/tokens.ts` | raw `colors.surface` → `colors.sheet`, `colors.darkSurface` → `colors.darkSheet` |
| `src/theme/semantic.ts` | `surface.DEFAULT` now references `{colors.sheet}` / `{colors.darkSheet}` |
| `src/theme/theme.test.ts` | +9 assertions: no semantic group with a `DEFAULT` may share a raw colour's name |

---

## 3. Key decisions

### 3.1 The `surface` token was silently broken, and it is the most important thing in this group

While measuring the finished header in a browser, its background came back
`rgba(0, 0, 0, 0)` — transparent — despite `bg="surface"`. Probing further:

```text
--chakra-colors-surface        ""          ← undefined
--chakra-colors-surface-muted  "#FAF7F2"
--chakra-colors-paper          "#FAF7F2"
--chakra-colors-line           "#1E1B29"
```

**The cause.** A raw token and a semantic token that share a name share a CSS variable name. Group 23
created raw `colors.surface` (`#FFFFFF`) *and* semantic `colors.surface.DEFAULT`, so Chakra emitted:

```css
--chakra-colors-surface: var(--chakra-colors-surface);
```

CSS treats a self-referencing custom property as cyclic and drops it **entirely**. The variable never
existed, so every `bg="surface"` resolved to an invalid value and the element fell back to
transparent — the header, the tab bar, every `Card`, every form control, the secondary button tone,
and the transaction-type swatch.

**Why it survived four groups.** Nothing errors and nothing warns. On a light page a transparent card
on a near-white background looks very nearly right, and the visual sheets in groups 26 to 29 all had
light or dark panes *behind* the components, so "the card is the same colour as the pane" read as
correct. The unit tests passed too, and would still pass: `background` genuinely is
`var(--chakra-colors-surface)` — the variable simply did not exist. Only
`getPropertyValue("--chakra-colors-surface")` in a real browser could tell the difference.

**The fix.** Rename the raw tokens to `sheet` and `darkSheet`. The semantic name `surface` is the one
components use, so it keeps it; the raw value gets a name that cannot collide. `darkSheet` is renamed
too even though it collides with nothing today, because naming one of a pair defensively and the
other not is how the problem comes back.

**The guard.** `theme.test.ts` now derives the list of semantic groups that have a `DEFAULT` and
asserts none of them shares a name with a raw colour, plus a "guard the guard" assertion that the
list is non-empty so it cannot pass vacuously. This is the class of bug worth a structural test:
invisible, silent, and easy to reintroduce by naming a token the obvious thing.

### 3.2 One header component, two headers

Section 7.5 describes them separately and they are one tree here, with responsive values for the
height, the gutters and which pieces are visible. Two components behind `hideBelow`/`hideFrom` would
duplicate the user badge, the toggle and the sign-out button — and duplicated chrome is exactly how
two widths drift apart.

### 3.3 The crushed mobile title, and what actually fixes it

Three things, all load-bearing, and the measurement that proves each:

| Fix | Measured at 402px |
| --- | --- |
| No wide text button in the header | every header button is **44 × 44** |
| No user name below `md` | the name is `hideBelow="md"` |
| `PageHeader` stacks | `flex-direction: column`, title column **366px** |

Result: "Split an expense" renders at its full 26px on **one line**. Before the restyle a title
sharing a row with an action button was left around 150px and wrapped to one word per line.

The first attempt to verify this measured `h1.getBoundingClientRect().width` and asserted it exceeded
300px. It came back 224px and looked like a failure — but 224px is simply the shrink-to-fit width of
a one-line title inside a `flex-start` column. The right measurement is the **line count** and the
width of the *container*, not of the text.

### 3.4 The active underline is a bottom border on a full-height link

The handoff achieves the flush underline with `padding-bottom: 24px; margin-bottom: -24px`, which
works because its link has a known height inside a known 58px row. Stretching the link to the
header's full height and putting the border on it is the same result with neither number, and it
survives a change to the header's height.

That needed two stretches, not one, and the difference was visible only when measured:

```text
align="stretch" on the nav group alone     underline bottom 41px, header bottom 60px  ✗
+ alignSelf="stretch" on the group         underline bottom 58px, header bottom 60px  ✓
```

The outer `Flex` centres its children, so without `alignSelf` the group was only as tall as its text
and the "full height" links stretched to *that* — leaving the underline floating 19px above the rule.
The 2px remainder is the header's own border, so the underline is flush against it.

The same idiom is used in `BottomNav`, so there is one active-state mechanism at both widths rather
than two.

### 3.5 Inactive items reserve the underline space

`borderBottomColor: "transparent"` rather than no border. If only the active item carried 3px, every
label would shift by 3px as navigation moved the active item — a jolt on every page change. Asserted
for all five items in both navigations.

### 3.6 `NAV_ITEMS` is shared, in a React-free module

The header and the tab bar previously held separate copies of the destination list, so the order, the
labels and (once icons existed) the glyphs could drift apart. `docs/04-USER-FLOWS.md` section 2 treats
them as one navigation shown two ways, and now the code does.

It is a plain `.ts` file with no JSX so a Server Component header and a Client Component tab bar can
both import it — the same constraint that shaped `icons/names.ts` in group 25.

`isActiveNavItem` does prefix matching with a trailing slash, so `/accounts/abc/edit` highlights
Accounts but `/peoplesomething` does not highlight People. Both cases are tested.

### 3.7 `aria-current="page"`, not just a colour

The teal underline and the weight change are visual. Without `aria-current` a screen-reader user has
no way to know which section they are in — the underline is precisely the kind of signal that does
not survive. Asserted in both navigations.

### 3.8 `PageHeader` gained a `meta` slot separate from `action`

The dashboard's `AS OF` eyebrow is a render timestamp, not a control. Putting it in the `action` slot
would place it where buttons go and make it look like one. Two slots, and the eyebrow sits on the
title's baseline on desktop.

### 3.9 The `AS OF` timestamp is generated in the render, not in the view model

Section 9.1 forbids anything implying a stored or cached total — no "live" badge, no freshness
indicator. `As of <now>` says only "these numbers were computed at this moment", which is literally
true: every figure on the page is recalculated on each load.

It is `new Date()` **in the page component**, during the render that produced the figures, rather
than a field on the view model. A timestamp passed through the view model could be produced at a
different moment from the numbers it describes; this one cannot.

It appears on the populated dashboard only. The empty dashboard says "Nothing recorded yet", and a
timestamp on a page with no figures would be noise.

### 3.10 The diamond mark is a rotated square, not an SVG

No path data to get wrong, it inherits `swatch.teal` and `line` so it flips with the colour mode for
free, and its border uses the design's own weights rather than a stroke that would need re-tuning per
size. The border thins at 8px because 2px on an 8px square is a quarter of it and the shape stops
reading as a diamond.

One size (16px) is used at both widths. The handoff draws 14px with a 1.5px border on mobile; a 2px
difference on a 16px shape is imperceptible, and one size avoids either a responsive variant or two
marks behind media queries.

### 3.11 The header and the tab bar both take the full-ink 2px rule

In this design those two edges are the frame around the application, and the handoff draws both at
2px full ink — unlike a card, which is 1.5px at 18%. The install prompt and the offline banner take
the same rule, because they are bands in the chrome rather than cards on the page.

---

## 4. Business rules enforced

- **Nothing implies a cached total** (9.1). The `AS OF` eyebrow is a render timestamp and is generated
  where the figures are (3.9).
- **`SkipToContent` still reaches `main#main`.** Verified in the browser: `main#main` is present at
  both widths. The shell rewrite moved a lot around it, and this is the target that a keyboard user's
  first Tab depends on.
- **Navigation state is not colour-only** (3.7).
- **Touch targets** — every tab is `minH="touch"`, and every header button measured 44 × 44.
- **The iPhone home-indicator inset is respected**, so the last 20px of the tab bar is reachable.
  Asserted against the emitted stylesheet, because jsdom cannot parse `env()`.

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run verify` (typecheck, lint, 608 unit) | passes |
| `npx vitest run --project ui` (253, +20 here) | passes |
| `npx vitest run --project offline` (150) | passes |
| `npm run build` | compiles clean |
| `npm run test:e2e -- <temp spec>` | passes — a real session, at 1440px and 402px, in both colour modes |

The browser pass is what this group rests on, and it produced numbers rather than impressions:

```text
desktop 1440px
  --chakra-colors-surface   #FFFFFF          (was "" — see 3.1)
  header background          rgb(255,255,255)
  header bottom              60px            (58 + the 2px rule)
  active underline bottom    58px            flush
  main width                 1360px          (85rem, was 64rem)
  h1                         30px, 1 line
  AS OF                      "As of 22 Sept 2026, 9:21 pm"
  card background            rgb(255,255,255)

mobile 402px
  header height              52px            (50 + the 2px rule)
  header button widths       [44, 44]        no wide text button
  page header direction      column          stacked
  page header width          366px           full column
  h1                         1 line
  main#main                  present
```

Screenshots in both modes confirmed what the numbers cannot: the diamond mark, the icon-and-label
nav, the teal underline under the current section, the mono uppercase `AS OF` on the right of the
page header, and the tab bar's icon-over-label stacks with the same underline.

Three harness mistakes are worth recording, because each one first looked like an application bug:

1. **Measuring the wrong width** for the mobile title (3.3).
2. **`document.querySelector("header")`** returns the app header on a page where `PageHeader` also
   renders a `<header>` — true here, but only because the app header comes first. A page without an
   `AppShell` would silently measure the wrong element.
3. **Not waiting for the expense write.** `recordPersonalExpense` only clicks; without a
   `waitForURL` the dashboard was fetched before the write landed and rendered its *empty* branch,
   which has no `AS OF` eyebrow — so the eyebrow looked missing when it was simply not on that
   branch.

**Not verified.** The desktop nav has not been compared against `Dashboard-Light.html` side by side
at the pixel level; the geometry matches the transcribed values, but group 41's screenshot diff is
where that comparison belongs. The install prompt has not been seen at all — it renders only when a
browser offers `beforeinstallprompt` or on iOS Safari, and neither happens in a headless Chromium
run.

---

## 6. Known gaps

- **The install prompt is unrendered** (5). Its restyle is unreviewed in practice.
- **The `AS OF` eyebrow is on the populated dashboard only** (3.9). Arguably the empty one should
  carry it too; it reads as noise there, and that is a judgement a designer may disagree with.
- **The mobile diamond mark is 16px, not the drawn 14px** (3.10).
- **The mobile user avatar is 24px, not the drawn 20px.** Same reasoning: `Avatar`'s size is a named
  union rather than a responsive value, and one size avoids two elements behind media queries.
- **The header gutters are 16/32px while the page gutters are 18/40px.** Both are transcribed from
  the handoff, which draws them differently — the header runs to the window edge and the content does
  not. It looks deliberate in the drawings and slightly odd in code; worth confirming.
- **`pb={{ base: "28", md: "60px" }}` on `main`** mixes a spacing-scale token with a pixel value. The
  mobile value needs to clear both the tab bar and the quick-add button, which group 31 has not built
  yet, so it will be revisited there.
- **`HeaderNav` is still in the DOM below `md`.** `hideBelow` uses `display: none`, which removes it
  from the accessibility tree, so this costs markup rather than correctness — but a screen reader
  user at a narrow width has two navigations in the document and reaches one.
- **No dark-mode contrast pass** on the new chrome. The header on `surface`, the `content.muted` nav
  labels and the `content.subtle` inactive tabs all need measuring in group 40.

---

## 7. Notes for the next group

Group 31 (mobile quick-add) mounts the FAB in the shell. Three things it needs from here:

- **Mount it next to `BottomNav` in `AppShell`**, not inside page content — the design system is
  explicit (7.7) and the reason is stacking context plus screenshot capture.
- **The tab bar is 64px plus `env(safe-area-inset-bottom)`**, and it sets `zIndex="sticky"`. The FAB
  has to sit above the page and clear the bar; 7.7 puts it ~84px from the bottom.
- **`main`'s bottom padding is provisional** (6). Set it to whatever actually clears the FAB.

For every screen group after that:

- **Use `PageHeader`** for the page title. It carries the stacking fix; a hand-rolled title row
  reintroduces the bug.
- **Put a timestamp or a count in `meta`, never in `action`** (3.8).
- **Never hard-code a nav destination.** Add to `NAV_ITEMS` and both navigations follow.

One trap, and it is the lesson of 3.1: **a token that resolves in a unit test may not exist in the
browser.** If a colour looks absent, read the custom property itself with
`getComputedStyle(document.documentElement).getPropertyValue("--chakra-colors-…")` before assuming
the component is wrong.
