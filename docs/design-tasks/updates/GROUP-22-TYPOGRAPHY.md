# Group 22 — Typography And Font Loading

Puts the three faces of "Ledger Geometry" into the application and makes them survive an
offline launch. Section 4 of [`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md).

---

## 1. What was built

The app moved from a system font stack to three self-hosted faces, each with one job:

```text
Space Grotesk   headings, nav and button labels, tab-bar labels, avatar initials
Manrope         body copy, descriptions, helper text, list item names
IBM Plex Mono   every amount, date, reference code, eyebrow label, badge, stamp
```

Three things make that a system rather than three imports:

- **The theme owns the family names.** Components say `fontFamily="mono"` or use a text
  style; no component names a typeface. `tokens.fonts` points at CSS variables that
  `src/app/fonts.ts` defines.
- **A role-named type scale.** `fontSizes.eyebrow`, `fontSizes.cardTitle`,
  `fontSizes.figure` and nine more, so the pixel values in the handoff live in the theme
  once instead of on every screen.
- **Three text styles carry the rules.** `amount` now carries the mono family alongside
  tabular figures, so "every number is mono" is one decision at one site. `eyebrow` and
  `badge` are new and are what the next six groups build labels from.

The offline story was the real work. The font files are precached, verified in a real
browser with the network cut.

---

## 2. Files added or changed

**Font loading**

| File | Purpose |
| --- | --- |
| `src/app/fonts.ts` | **new.** The three `next/font/google` declarations and a combined `fontVariableClassName` for the root element |
| `src/app/layout.tsx` | applies `fontVariableClassName` to `<html>` |

**Theme**

| File | Purpose |
| --- | --- |
| `src/theme/tokens.ts` | `fonts` now point at the CSS variables; adds `fontSizes` (12 role steps) and `letterSpacings` (4) |
| `src/theme/index.ts` | `body` gets `fontFamily: "body"`; `amount` text style gains the mono family; `eyebrow` and `badge` text styles added |

**Offline**

| File | Purpose |
| --- | --- |
| `public/sw.js` | `VERSION` bumped to `v2`; new `precacheNestedStylesheetAssets()`, called from `precacheOfflineAssets()` |
| `tests/offline/service-worker.test.ts` | three tests: fonts reached through the stylesheet, fonts are cache-first, a stylesheet that fails to read does not break install |
| `tests/e2e/pwa-offline.spec.ts` | one test: all three faces load with the network cut |

The colour palette is untouched. That is group 23.

---

## 3. Key decisions

### 3.1 `next/font/google` over the handoff's stylesheet link

`design/ux/DESIGN.md` loads all three from `fonts.googleapis.com` at runtime. Rejected on
three counts: a render-blocking round trip to a third party on every cold load, the
visitor's IP and user agent handed to Google, and a flash of fallback text while the CSS
resolves.

`next/font/google` downloads at build time and serves from `/_next/static/media/`. The
decisive advantage for this app is the last one: those paths are already what
`isImmutableAsset()` in `public/sw.js` treats as cache-first, so self-hosting is what makes
offline typography possible at all. A runtime Google stylesheet could not be cached without
adding a cross-origin rule to a worker whose central guarantee is that it does not cache
other origins' responses.

Confirmed the build actually fetches them: `npm run build` produced 19 `.woff2` files in
`.next/static/media/`, roughly 200 KB in total.

### 3.2 A role-named type scale, not a redefined numeric one

Chakra's default `2xs`-`7xl` steps are left exactly as they are. The additions are named for
what they are for:

```text
badge 10   eyebrow 11   meta 12   subtitle 13   row 14   control 15
cardTitle 17   figure 19   figureLg 24   hero 28   pageTitleSm 26   pageTitle 30
```

Two alternatives were rejected.

**Redefining the numeric scale** (making `md` 14px, `lg` 15px and so on) would have matched
the handoff most literally, and it is what "map these onto Chakra's `fontSizes` scale"
suggests. Rejected because every built-in Chakra recipe is sized against those steps, and
this restyle does not touch all of them — redefining `md` resizes components nobody
reviewed. The failure mode is diffuse and hard to attribute.

**Rounding to the nearest existing step** was the other reading of the same sentence.
Rejected at the small end specifically: the design's 11px eyebrow rounded to `xs` (12px) is
a 9% error, and 13px card subtitles rounded to `sm` (14px) is 8%. At 11 to 15px those are
plainly visible, and they compound — a 12px eyebrow above a 14px subtitle loses the size
contrast the hierarchy depends on. At the large end rounding is harmless, which is why
`pageTitle` is just 30px and the drawn 30-32px range needs no second step.

Half-pixel values in the handoff (14.5px, 12.5px) are hand-drawing artefacts. They are
rounded once, here, rather than on each screen.

### 3.3 `textTransform: uppercase` rather than uppercase strings

The `eyebrow` and `badge` text styles uppercase in CSS. Writing `PAID FROM` in the markup
would render identically and make a screen reader spell it out letter by letter on some
combinations. The visual result is the same; the accessible result is not.

### 3.4 `fontFamily: "body"` on `body`, in `globalCss`

Set explicitly rather than left to Chakra's default, so the body face is a property of the
document. A component that forgets to declare a family inherits Manrope instead of whatever
the default resolves to.

### 3.5 The font files are precached from the **stylesheet**, not the document

This is the one place the obvious implementation is wrong, and it was wrong in this branch
before it was checked.

The assumption was that `next/font` emits
`<link rel="preload" as="font" href="/_next/static/media/….woff2">` into the head, which the
worker's existing `/_next/static/` extraction would pick up for free. It does not. Inspected
against a real build:

```text
.next/server/app/offline.html
  /_next/static/media/  references:  none
  /_next/static/css/    references:  1  (c5fad964bbfbeaab.css)

.next/static/css/c5fad964bbfbeaab.css
  @font-face rules for Space Grotesk, Manrope, IBM Plex Mono (+ their Fallback metrics)
  /_next/static/media/  references:  19 woff2 files
```

Next only emits a font preload link when it can attribute the font to a specific route; a
CSS-variable font declared in the root layout is not one of those. So extraction from the
document stops at the stylesheet, and the browser requests each face when it applies the
CSS — which offline fails.

`precacheNestedStylesheetAssets()` is the fix: after the document's assets are stored, it
reads back any `.css` among them and precaches what *they* reference. Two details worth
keeping:

- It reads the stylesheet **from the cache**, not the network. It was stored a moment
  earlier, and a second round trip on the install path is latency the user waits on.
- It is **not font-specific**. It caches whatever a precached stylesheet references, so
  adding a weight or dropping a face needs no change here. There is deliberately no font
  list to keep in step with `src/app/fonts.ts`.

The same regular expression works on CSS because the character class already excludes `(`
and `)`, so `url(/_next/static/media/x.woff2)` yields just the path.

### 3.6 All 19 font files are cached, not a subset

Google splits each weight by unicode-range, so nine logical faces become 19 files. Every one
is referenced by an `@font-face` rule; caching a subset would leave some glyphs rendering in
the fallback. ~200 KB is a real cost on a device that also holds unsynced expenses
(`docs/08-OFFLINE-SYNC.md` section 47) and is the reason there is no fourth face — but it is
the minimum correct set, not a choice.

### 3.7 `VERSION` bumped to `v2`

Existing clients hold a shell cached from before the font files existed. Without a bump
their first offline load after this deploys would still fall back to system sans, which is
precisely the failure the precache exists to prevent. The bump makes `activate` drop the old
caches.

---

## 4. Business rules enforced

Typography is where two of the product rules in section 9.1 actually live:

- **Mono, tabular figures for all amounts, dates and reference codes.** `textStyle="amount"`
  now carries the family as well as `font-variant-numeric: tabular-nums` and
  `font-feature-settings: "tnum"`. A column of amounts aligns on the decimal point, which is
  what makes a transaction list scannable (`docs/06-CODING-PRACTICES.md` section 41). Before
  this group, `amount` carried the figures but not the family, so it depended on the
  surrounding font being monospaced — which it never was.
- **The offline app must not look degraded.** `docs/08-OFFLINE-SYNC.md` section 49 asks the
  offline experience to read as a fact rather than a failure. An app that loses its tabular
  figures offline reports a problem in the one place the user cannot diagnose it.

No financial calculation is touched by this group.

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run typecheck` | passes |
| `npm run lint` | passes |
| `npm run test` (unit, 436) | passes |
| `npm run test:offline` (150) | passes — includes the three new service-worker tests |
| `npm run build` | succeeds; the Google fetch happens at build time and produced 19 woff2 files in `.next/static/media/` |
| `npx playwright test tests/e2e/pwa-offline.spec.ts -g "designed faces"` | **passes** |
| grep for `fontFamily` / `font-family` across `src/**` | no matches outside `src/theme/`, so no screen sets a family inline |
| manual inspection of `.next/server/app/offline.html` and its stylesheet | the evidence in 3.5 — this is what caught the wrong assumption |

The e2e test is the one that matters, and it is worth saying what makes it meaningful. It
loads `/login`, waits for the worker to take control, reloads once so the navigation is
cached, cuts the network with `context.setOffline(true)`, reloads again, and then calls
`document.fonts.load()` for each of the three families. `load()` forces an actual fetch of
the font file, so with the network down it can only resolve from the worker's cache. All
three report `true`, and `getComputedStyle(document.body).fontFamily` contains `Manrope`.

Checking `getComputedStyle` alone would have passed on a fallback font, because the CSS
variable resolves whether or not the file arrived. That is the trap this test is built to
avoid.

Not verified: rendering on iOS Safari, where `display: swap` and the fallback metrics behave
differently. Group 41 owns the device pass.

---

## 6. Known gaps

- **The type scale is defined but barely used.** Twelve `fontSizes` steps exist; the screens
  still use Chakra defaults until groups 26 to 39 apply them. A step with no call site is a
  step nobody has checked, so expect small corrections as screens land.
- **Only `amount`, `eyebrow` and `badge` text styles exist.** The stamp treatment (5.4) needs
  `letterSpacings.stamp` plus a rotation and a dashed border, so it is a component rather
  than a text style — group 28 builds it.
- **Weights are locked to what the design uses.** Space Grotesk 500/600/700, Manrope
  400/500/600/700, IBM Plex Mono 500/600. A screen that wants Manrope 300 or mono 700 will
  get a synthesised face, which on these fonts looks wrong rather than merely different. Add
  the weight to `src/app/fonts.ts` and accept the extra file, or pick a weight that exists.
- **`fontSizes` are single values, not responsive pairs.** The handoff gives a desktop and a
  mobile size for most roles (30/26 page title, 17/15 card title). The tokens carry both as
  separate steps only where the gap is large enough to need one (`pageTitle` /
  `pageTitleSm`); elsewhere the screen groups apply Chakra's `base`/`md` object syntax. This
  is a deliberate split, but it means the responsive half of section 4.2 is enforced by
  convention rather than by the theme.
- **iOS Safari not checked** (5).

---

## 7. Notes for the next group

Group 23 replaces the colour palette in the same two files this group just edited. Nothing
here conflicts: `fonts`, `fontSizes` and `letterSpacings` are separate keys from `colors`,
and the `radii`/`sizes` rewrite does not touch them. Keep the four contrast replacements
from `GROUP-21-DESIGN-DECISIONS.md` section 3.8 in mind — they differ from the values printed
in section 3.1 of the design system document.

Two things group 23 must not undo:

- `fontFamily: "body"` in `globalCss` (3.4). The group 23 snippet in the design system
  document includes it; make sure the rewrite keeps it.
- The `amount`, `eyebrow` and `badge` text styles. Group 23's snippet shows `textStyles` as
  if writing them fresh; they already exist and already carry the mono family.

For every group after that, the two rules to apply by reflex:

- **If it is a number, it is mono.** Use `textStyle="amount"` for amounts, dates and codes.
  Never set the family directly.
- **Eyebrow labels and field labels use `textStyle="eyebrow"`**, which already carries the
  size, weight, tracking, uppercasing and `content.muted`. Group 26 builds `Field` labels on
  it — do not re-specify those five properties there.

One trap, for anyone touching `public/sw.js`: the font files are reached through the
stylesheet, not the document (3.5). A "simplification" that drops
`precacheNestedStylesheetAssets()` will pass every test except the e2e font check and will
look fine online.
