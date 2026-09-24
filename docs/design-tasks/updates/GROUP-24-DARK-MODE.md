# Group 24 — Dark Mode Infrastructure

Switches on the dark half of the palette group 23 wrote. Section 2.2 of
[`../01-DESIGN-SYSTEM.md`](../01-DESIGN-SYSTEM.md), and the scope decision in
[`GROUP-21-DESIGN-DECISIONS.md`](GROUP-21-DESIGN-DECISIONS.md) section 3.2.

---

## 1. What was built

Dark mode works. Every `_dark` token group 23 wrote now activates, and the app opens in the
right mode on the first frame with no flash.

Four pieces:

- **`src/theme/color-mode.ts`** — the resolution rules, the storage access, the document
  mutation, and the source of the pre-paint script. No React, no Chakra.
- **`ColorModeScript`** — one synchronous inline `<script>` in `<head>`. This is what removes
  the flash of the wrong theme; an effect cannot.
- **`ColorModeProvider`** — owns the mode for the tree, persists explicit choices, and
  follows the operating system while no choice has been made.
- **`ColorModeToggle`** — an icon-only toggle in the app header, before sign-out.

Two colours of browser chrome, a `color-scheme` declaration so native controls follow, and 32
new tests — 26 in jsdom, 6 in a real browser.

Verified by rendering: the sign-in page was captured in both modes and both are correct.

---

## 2. Files added or changed

**Colour-mode infrastructure**

| File | Purpose |
| --- | --- |
| `src/theme/color-mode.ts` | **new.** Storage key, class names, per-mode `theme-color`, `resolveColorMode()`, `applyColorMode()`, `colorModeScriptSource()` |
| `src/components/theme/ColorModeScript.tsx` | **new.** Emits the blocking inline script |
| `src/components/theme/ColorModeProvider.tsx` | **new.** The provider and `useColorMode()` |
| `src/components/theme/ColorModeToggle.tsx` | **new.** Icon-only toggle, with the sun and moon glyphs drawn inline |

**Wiring**

| File | Change |
| --- | --- |
| `src/app/providers.tsx` | `ColorModeProvider` wraps `ChakraProvider` |
| `src/app/layout.tsx` | `<head>` renders `ColorModeScript`; `<html>` gains `suppressHydrationWarning`; `themeColor` becomes a media-qualified pair |
| `src/components/layout/AppShell.tsx` | the toggle, immediately before sign-out |

**Tests**

| File | Change |
| --- | --- |
| `src/components/theme/ColorModeProvider.test.tsx` | **new.** 26 tests: resolution, document effects, provider behaviour, the toggle, and the script executed for real |
| `tests/e2e/color-mode.spec.ts` | **new.** 6 tests: both modes render, no flash, chrome colour, dark tokens resolve, first-visit system preference |
| `src/theme/theme.test.ts` | +15 assertions transcribing the handoff's dark colour table |
| `tests/helpers/render.tsx` | provider stack now mirrors `src/app/providers.tsx` |

---

## 3. Key decisions

### 3.1 Hand-rolled rather than `next-themes`

Chakra v3's own documentation reaches for `next-themes`, and it is a good library. It was not
added because the requirement is about 70 lines — a class on `<html>`, a `localStorage` key, a
`matchMedia` listener and a blocking script — and this project has an established preference
for owning small infrastructure rather than taking a dependency for it. The hand-written
service worker and the PNG encoder in `scripts/generate-icons.ts` both say so explicitly, and
both give the same reason: the thing being avoided is smaller than the thing being added.

Two details here are also specific enough that a general library would need configuring
around them: the `theme-color` handling in 3.4, and the deliberate absence of a "system"
position on the toggle (3.6).

The line where this stops being the right call is worth naming, so it is in the module's own
comment: per-route themes, a third mode, or server-resolved modes. Reach for the library then
rather than growing the file.

### 3.2 The class goes on `<html>`, and that was verified rather than assumed

Chakra v3's resolved condition is:

```text
conditions.dark === ".dark &, .dark .chakra-theme:not(.light) &"
```

Read out of the built system, not out of the documentation. Both selectors need `.dark` on an
**ancestor**, which rules out `<body>` (fine in practice, but it is not what the second
selector is written for) and rules out a wrapper `<div>` (which would leave anything portalled
outside it in light mode).

The `LIGHT_CLASS` is also set, and it does nothing on its own — it exists for the
`:not(.light)` half of the condition, which is how Chakra supports a light island inside a
dark tree. Nothing uses that yet; setting the class costs nothing and means the escape hatch
is there if a screen ever needs it.

### 3.3 A blocking inline script, not `next/script` and not an effect

The flash of the wrong theme is an ordering problem, and only one mechanism solves it. An
effect runs after the first paint: the user sees a light page for a frame and then watches it
go dark. On a phone at night that is genuinely unpleasant rather than merely untidy.

`<Script strategy="beforeInteractive">` was rejected because in the App Router it still loads
as a separate resource — a round trip during which the page is already visible.

So: `dangerouslySetInnerHTML` with a constant string. Safe in the way that matters — the
content is built from module constants, with no request data, no user data and no props
reaching it — and that is stated at the call site rather than left for a reader to verify.

The script duplicates a little of the resolution logic, which is the correct trade: importing
from the module would mean loading a bundle first, which is the wait the script exists to
avoid. The duplication is bounded and every value is **interpolated from the same exported
constants** the provider uses, so there is one source for the key, the class names and the two
colours. A test asserts that stayed true, and two more execute the script for real against a
document.

It is wrapped in `try/catch` because it runs before React, before any error boundary and
before the service worker. A throw there is an unstyled blank page.

### 3.4 Every `theme-color` meta is rewritten, not just one

`src/app/layout.tsx` declares a media-qualified pair:

```ts
themeColor: [
  { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
  { media: "(prefers-color-scheme: dark)",  color: "#141220" },
]
```

That is correct for a no-JavaScript render and for the instant before the script runs, and it
is **wrong for a user who overrode the mode** — light OS, dark app — because it keys off
`prefers-color-scheme`, which the override does not change.

The options were: strip the `media` attributes at runtime, append a media-less tag and rely on
document order, or set the same content on all of them. The third is the only one that does
not depend on the browser's tag-selection rules being what you think they are, so
`applyColorMode()` writes the resolved colour to **every** `theme-color` tag. Whichever the
browser picks, it carries the right value.

Both the script and the provider do this, so it is right before first paint and right after
every toggle.

### 3.5 `color-scheme` is set, and it matters more here than usual

`document.documentElement.style.colorScheme` is what makes the browser's own furniture follow
the theme: scrollbars, the text caret, form-control defaults, and the dropdown panel a native
`<select>` opens.

That last one is why it is not optional in this app. The design deliberately keeps native
`<select>` elements for keyboard and screen-reader support (7.2), so without `color-scheme` a
dark page would open a white option list — which is precisely where a hand-rolled dark mode
gives itself away.

### 3.6 The preference is two-state; "system" is the absence of a preference

An unset preference means "follow the operating system", so that is where every user starts,
and a `matchMedia` listener keeps them in step if the OS switches at sunset. Choosing
explicitly is one-way: the listener detaches and the choice sticks.

There is no third "system" position on the toggle. A three-position control needs a visible
label to be comprehensible, and group 21 put this control in the app header — where a wide
labelled control is the direct cause of the crushed-title bug this restyle has to fix (9.2).
Recorded as a known gap: a user who wants to return to following the system has to clear
storage.

### 3.7 The toggle renders **both** glyphs and lets CSS choose

This is the decision that looks like a stylistic quirk and is actually about correctness.

The server cannot know the user's mode — no `localStorage`, no `matchMedia` — so picking the
glyph in JavaScript would produce a hydration mismatch on every dark-mode visit. Rendering
both and selecting with `display` under the `_dark` condition means:

- the markup is identical on the server and the client, so there is nothing to mismatch
- the correct glyph is already showing **before React loads**, consistent with 3.3

`aria-pressed` is the one attribute that cannot be handled this way, since it has no CSS
equivalent. It is attached after mount via a `mounted` flag, so the first client render stays
byte-identical to the server's and the attribute appears a tick later. Before then the control
is still a working button with an accessible name — it is simply not yet announced as a
toggle.

The accessible name is `"Dark theme"` — the control, not the action — so it does not have to
change when the state does. `aria-pressed` carries the state, which is the canonical pattern
for a binary toggle and avoids the "Switch to dark / Switch to light" label that is ambiguous
about whether it describes the current state or the outcome.

### 3.8 The sun and moon are drawn in the toggle, not in the registry

The icon registry arrives in group 25, and the handoff's 28 glyphs contain nothing for a theme
control — it designs no such control, because the toggle is this implementation's invention
(group 21 section 3.3).

Rather than reorder the two groups, the two glyphs are drawn inside `ColorModeToggle.tsx` to
the same rules (6.1): 16px viewBox, `fill="none"`, `stroke="currentColor"`, 1.5px, geometric.
Group 25 relocates them into `registry.ts` as `sun` and `moon`; the shapes should not change
when it does.

### 3.9 `suppressHydrationWarning` on `<html>`

The script mutates `class` and `style` on `<html>` before React hydrates, so React reports a
mismatch on every dark-mode load — the server sent only the font-variable classes, the DOM now
also has `dark` and a `color-scheme`. The attribute is scoped to this one element's own
attributes and suppresses nothing inside the tree.

### 3.10 Initial state is read during render, not in an effect

`useState(() => resolveColorMode(readStoredPreference()))` runs synchronously. By the time the
provider mounts, the script has already put the class on `<html>`; if the provider started
from a hard-coded `"light"` and corrected itself in an effect, the toggle would show the wrong
state for a frame and any component reading `colorMode` would briefly disagree with the
document.

On the server both APIs are absent, so the initialiser is guarded and resolves to `"light"`.
That is a real limitation rather than a hidden bug — see section 6.

---

## 4. Business rules enforced

Dark mode touches no financial rule, but it is capable of breaking two of the design's:

- **Ink stays on the teal fill in dark mode.** Asserted in jsdom and again in the browser
  (`brand.contrast` resolves to `#1E1B29` with `.dark` active). Flipping it to `darkInk` — the
  instinctive thing to do when writing a `_dark` value — measures about 2.1:1 and makes every
  primary button label vanish. That is a legibility failure on the app's most important
  control.
- **The hard offset shadow flips to `darkInk`.** Group 23 made the shadows semantic for this
  reason; group 24 is where it becomes observable. An ink shadow on `#141220` is invisible, so
  getting it wrong silently deletes the elevation system that carries this design's hierarchy.

And one accessibility rule: **no information by colour alone** is unaffected. The toggle
communicates through `aria-pressed` and an accessible name, not through which glyph is lit.

---

## 5. How it was verified

| Command / check | Result |
| --- | --- |
| `npm run verify` (typecheck, lint, 521 unit tests) | passes |
| `npx vitest run --project ui` (42) | passes — 26 of them new here |
| `npx vitest run --project offline` (150) | passes |
| `npx playwright test tests/e2e/color-mode.spec.ts` | **6 passed** |
| `npm run build` | compiles clean |
| visual capture of `/login` in both modes at 1440px | correct in both — see below |

The browser tests are the ones that carry weight, because three of this group's claims cannot
be checked anywhere else:

- **`_dark` tokens actually activate.** The spec reads the CSS custom properties off
  `documentElement` with `.dark` on, and the browser has flattened them to literals:
  `surface` → `#1E1B2C`, `content` → `#F3F0FA`, `brand.solid` → `#4FB9A8`,
  `brand.contrast` → `#1E1B29`. Those are the handoff's dark values, arrived at through the
  condition. Nothing renders them if the condition did not fire.
- **There is no flash.** A `MutationObserver` installed by `addInitScript` — before the
  document's own scripts — records that the *first* mutation of `<html>`'s class already
  carries `dark`. The same test then asserts structurally that the script doing it is inline,
  in the head, and has no `defer`, `async` or `src`, since any of those would push execution
  past first paint while every other assertion still passed.
- **`prefers-color-scheme` is honoured on a first visit**, via a second `describe` with
  `colorScheme: "dark"` and no stored preference.

Two harness traps were hit and are worth recording, because both fail in a way that blames the
application:

- **`document.documentElement` is null inside `addInitScript`.** The parser has not created
  `<html>` yet, so `observer.observe(document.documentElement, …)` throws and the observer is
  never installed. The test then records zero mutations and looks like a missing feature. Fixed
  by observing `document` with `subtree: true` and filtering on the target.
- **`document.head.innerHTML = …` in a jsdom `beforeEach` breaks Chakra.** The style engine
  injects `<style>` elements into the head and keeps references to them; wiping the head makes
  a later unmount throw `NotFoundError: The child can not be found in the parent` — several
  tests *after* the one that caused it. The test file now replaces only the `theme-color` tags,
  with a comment saying why.

The visual capture confirmed what the assertions cannot: `darkPaper` page, `darkSurface` card,
`darkInk` border and text, `darkTeal` button with an ink label, `darkTealText` link,
`darkCoralText` required asterisk, square corners throughout, and the three faces from group
22 in place. The light capture is the same layout on `paper` with ink borders.

**On "verify both dark screens in the handoff match".** What was verified is the palette and
the mechanism: all fourteen values in `DESIGN.md`'s dark table are asserted literally in
`theme.test.ts`, the four most important resolve correctly in a real browser, and the hard
shadow flips to `darkInk` exactly as `Dashboard-Dark.html` draws it. What was **not** verified
is the layout, because there is no restyled dashboard to compare — the summary tiles, the
net-position banner and the nav underline arrive in groups 30 and 34. Those groups compare
against `Dashboard-Dark.html` and `Mobile-Dashboard-Dark.html` directly, and this is listed as
their inherited work in section 7.

---

## 6. Known gaps

- **Server-side rendering always resolves to light.** `localStorage` and `matchMedia` do not
  exist on the server, so the HTML arrives light-classed and the script corrects it before
  paint. The consequence is bounded — the colours come from CSS, which the class selects, and
  nothing in the tree renders *different markup* per mode — but it means a component that ever
  does branch on `colorMode` during render will be wrong on the server. Two ways out if that
  day comes: a cookie the server can read, or keeping such branching out of render.
- **No way back to "following the system"** once a choice is made (3.6), short of clearing
  storage. If this is wanted, it needs a three-state control and therefore a place with room
  for a label — which is an argument for the settings screen group 21 declined to build.
- **Four derived dark values remain unreviewed by a designer**, inherited from group 23:
  `darkDisabledSurface` `#2A2739`, `darkInkGrid`, the dark value of `content.onTint`, and the
  dark value of `shadows.hardFocus`. Two of them — disabled fills and focus rings — are now
  *visible* in dark mode for the first time, so they are worth looking at deliberately rather
  than in passing.
- **Dark mode has had no contrast pass.** Group 23 measured the text tokens; the tinted
  surfaces, the disabled state and the focus shadow have not been measured against their dark
  backgrounds. Group 40 owns this and it is not implied by the light pass.
- **The toggle is not on the unauthenticated layout** (group 21 section 3.3), so sign-in and
  sign-up follow the system preference with no override. Intentional, but it means a user
  cannot set their preference until after they sign in.
- **The sun and moon glyphs are in the wrong file** (3.8) until group 25 moves them.
- **The toggle still uses the unrestyled `Button`.** It is functional and meets the 44px touch
  target, but the square icon-only treatment from 7.1 arrives with group 27, and its position
  in the header is provisional until group 30 rebuilds the header properly.
- **Not tested on iOS Safari**, where `color-scheme` and the `theme-color` tag behave
  differently. Group 41.

---

## 7. Notes for the next group

**Group 25** should move the two glyphs out of `ColorModeToggle.tsx` and into
`src/components/icons/registry.ts` as `sun` and `moon`, then have the toggle use `<Icon>` like
everything else. The shapes are already drawn to the registry's rules; this is a relocation,
not a redesign. That makes 14 glyphs for group 25 rather than the 12 in group 21 section 3.9.

**Every group from here on can and should look at both modes.** That is the point of this
group. Two habits worth forming:

- After restyling a screen, toggle it. The dark half of forty tokens has been rendered on
  exactly one screen so far.
- Never branch on `colorMode` during render (6). If something must differ between modes, do it
  with the `_dark` condition in CSS — which is also what keeps it correct before hydration.

**Groups 30 and 34** inherit the unfinished half of this group's verification: comparing the
restyled shell and dashboard against `Dashboard-Dark.html` and `Mobile-Dashboard-Dark.html`.
The palette is confirmed correct, so any difference found there is a layout or hierarchy
difference, not a colour one.

**Group 40** should start from the fact that dark mode has had no contrast pass at all (6), and
that the two states only now visible in dark — disabled and focused — rest on derived values
nobody designed.

One trap for anyone editing `src/theme/color-mode.ts`: the pre-paint script is a **string**,
and it is the only code in the app that runs before the bundle. It cannot import anything, it
must not throw, and the constants it interpolates are shared with the provider precisely so
the two cannot drift. There is a test asserting the interpolation is still there; if it fails,
the fix is to restore the interpolation, not to update the test.
