# Group 41 — Verification And Handoff Refresh

The last group. Everything passes except two tests, and the two that fail are not this restyle's.

---

## 1. What was built

A full verification pass, a refreshed screenshot set for the designer, and a rewritten handoff
README describing the restyled app rather than the one it replaced.

```text
npm run verify                typecheck + eslint + 677 unit          pass
npm run test:all              66 files, 1,690 tests                  pass
npm run build                 35 routes                              pass
npx eslint src tests scripts                                         clean
npm run test:e2e              27 specs                               25 pass, 2 fail
npm run screenshots           143 PNGs across 4 profiles             pass, no problems
```

The two e2e failures are a single pre-existing defect in the auth layer: **sign-out leaves the
session token alive**. It is diagnosed in section 3.1, it is a security defect, and it needs its
own task — nothing in the sign-out path was touched by this restyle.

Three things were added to the screenshot script:

- **dark-mode captures** — two new profiles, eighteen screens each, chosen by token coverage
- **`54-quick-add-expanded`** — `Mobile-QuickAdd-Expanded.html` is one of the eleven artboards and
  nothing in the set showed the state it draws
- **the quick-add button is re-anchored before the shutter**, like the tab bar already was

Both bugs in section 9.2 of the design system are fixed, and both were measured rather than
eyeballed. The evidence is in section 5.

---

## 2. Files added or changed

### Changed

| File | Change |
| --- | --- |
| `scripts/capture-screenshots.ts` | Two dark profiles with a `DARK_SHOTS` subset; the quick-add shot; `unpinBottomNav` → `unpinFixedChrome`; `shot()` takes a `viewportOnly` option; `expectedFor` allows a shot to be claimed by more than one profile; seeded sub-categories now carry icons. |
| `design/screenshots/README.md` | Rewritten for the restyled app: four folders, the dark subset, the two defects recorded as fixed with measurements, and a new "what needs your sign-off" section. |
| `tests/e2e/journeys.spec.ts` | One heading assertion pinned to the `h1` — see section 3.3. |

No product code changed in this group. That is the point of it.

---

## 3. Key decisions

### 3.1 Sign-out does not end the session, and that is not a restyle regression

Two journey specs fail. Both call `signOut()` and then assert the session is gone; it is not.
Measured:

```text
cookies before sign-out   authjs.csrf-token, authjs.callback-url, authjs.session-token
cookies after sign-out    authjs.csrf-token, authjs.callback-url, authjs.session-token
GET /dashboard            200, still the dashboard
```

The sign-out response itself is correct. It carries three `Set-Cookie` headers and the last of them
is `authjs.session-token=; Max-Age=0`, so at the moment the redirect to `/login` is applied the
session is genuinely cleared. What resurrects it is what arrives afterwards:

```text
GET /transactions/new/shared?_rsc=…   next-router-prefetch: 1   Set-Cookie: authjs.session-token=eyJ…
GET /transactions/new/transfer?_rsc=… next-router-prefetch: 1   Set-Cookie: authjs.session-token=eyJ…
GET /accounts/new?_rsc=…              next-router-prefetch: 1   Set-Cookie: authjs.session-token=eyJ…
GET /api/sync/pull?limit=100                                    Set-Cookie: authjs.session-token=eyJ…
GET /register?_rsc=…                  next-router-prefetch: 1   Set-Cookie: authjs.session-token=eyJ…
```

NextAuth refreshes the JWT cookie on every authenticated request. Those requests were issued
**before** the sign-out response landed and still carried the old cookie, so each one re-issues it.
The last to arrive wins, and it is a link prefetch for `/register` that the sign-in page itself
triggered.

Three reasons this was diagnosed and recorded rather than fixed here:

1. **It is not a restyle regression.** `SignOutButton`, `logoutAction`, `auth-config.ts` and
   `middleware.ts` are byte-identical to what the restyle started from; only the button's
   *rendering* changed, from a text button to an icon button. The one honest qualification: the
   restyle added links, and more links means more prefetches racing the response, so it may have
   made an existing race more likely. It was not bisected.
2. **Fixing it is an auth-architecture decision, not a styling one.** The narrow fix is to stop
   refreshing the session cookie on requests that are not user navigations — prefetches and
   background polls. That is a deliberate change to session-extension semantics, and it belongs to
   somebody making it on purpose. The middleware-only version would not even be complete: the sync
   poll's refresh comes from the route handler's own `auth()` call, which middleware cannot strip.
3. **Silently relaxing the tests would have been the worst option available.** The assertion is
   right. Sign-out should end the session.

**Recommended next task**: make the session refresh conditional on a document navigation, at both
the middleware and the API-wrapper level, and keep these two specs exactly as they are.

### 3.2 `EmptyState`'s title was a `<p>`, which one of these tests caught

The in-app not-found spec failed for a reason worth separating out: it looks for
`getByRole("heading", { name: /not found/i })`, and there was no heading on the page. Group 28 had
replaced a `Heading` with a styled `Text`; the pixels were identical and the two not-found pages
lost their only heading.

That is a group 40 finding and is fixed and documented there. It is mentioned here because it is
the one restyle regression the e2e suite found, and it is the argument for running these specs per
group rather than once at the end: it was introduced thirteen groups before anything noticed.

### 3.3 One test assertion was loosened — deliberately, and in the other direction

After the fix, the same spec failed again: `getByRole("heading", { name: /dashboard/i })` now
resolves to **two** elements on a brand-new account, because the page header's `h1` says
"Dashboard" and the empty state's new `h2` says "Your dashboard is waiting on some data".

Both headings are correct and the test had to say which one it meant, so it is now pinned to
`{ level: 1, name: "Dashboard" }`. That is a stricter assertion than before, not a weaker one — the
previous version would have passed against either heading alone.

### 3.4 Dark mode is eighteen screens, not fifty-four

All four profiles walk the same capture passes; the dark ones photograph a subset, filtered at the
shutter rather than by branching inside the capture functions. One filter in `shot()` means the
dark list is defined in one place.

The subset is chosen by **token coverage**, not by importance: between the eighteen screens every
semantic colour the theme defines is rendered at least once. Photographing all fifty-four twice
more would have produced 212 images and asked the designer to review a hundred of them for a
palette flip, which is how a review gets skipped.

### 3.5 The quick-add shot is viewport-only, and the button is re-anchored everywhere else

Two different problems with one cause — `position: fixed` and a full-page screenshot do not agree.

The first run of this group photographed the floating quick-add button **across the middle of every
mobile page**, once directly over the date field of the expense form. The script already made the
tab bar static for exactly this reason; the button needed a different answer, because it is not part
of any flow — it floats. It is moved to `body` and absolutely positioned just above the now-static
bar, which is where it sits on a real phone.

The open quick-add layer could not be fixed the same way, because its scrim is also fixed: a
full-page capture would show the top screen dimmed and the remaining 1,500px not, which is not a
state the app can be in. That one shot is captured viewport-only.

Found by looking at the output. Neither problem is visible in the code.

### 3.6 The seeded sub-categories were given icons

Six sub-categories were seeded with `icon: null`, which is a valid state — a category with no icon
falls back to `ellipsis`. It meant five of the nine swatches in the dashboard breakdown, and most
rows in the activity list, were photographed as "…".

Valid, but the wrong picture. The icon picker shipped in group 39, so a user creating these today
would choose a glyph, and a handoff set should show the ordinary case rather than the fallback. The
fallback is still exercised — nothing forces an icon, and group 39's tests cover the null case.

---

## 4. Business rules enforced

None. This group asserts, it does not decide.

What the suites collectively prove, as a summary of the whole series: 1,690 unit, ui, integration
and offline tests pass, every financial rule from `Money` arithmetic to settlement allocation is
unchanged by 21 groups of restyling, and the offline queue still works. The restyle touched
presentation only — with two exceptions, both recorded: `DEFAULT_CATEGORIES` now holds registry
icon names (group 39), and three palette values were darkened for contrast (group 40).

---

## 5. How it was verified

### The two bugs in 9.2, measured

**Clipped Cancel.** `/transactions/new`, submit and Cancel in one row:

| | Row | Card | Cancel | Verdict |
| --- | --- | --- | --- | --- |
| 1440px | 122 → 771 | 122 → 771 | ends inside the row | full width, not clipped |
| 393px | 40 → 353 | 40 → 353 | 248 → 353, 105px | full width, same row |

`flex: 1 1 0%` on the submit and `flex-shrink: 0` on Cancel, which is the fix — `width: 100%` was
the bug. `FormActions` owns the row and `onCancel` is required, so a form cannot be shipped without
a way out.

**Crushed mobile title.** `/transactions/new` at 393px:

```text
h1 text        "Add expense"
font-size      26px           the full size, not a reduced one
lines          1              was one word per line
header layout  column         the actions sit below the title, not beside it
```

The right measurement is the **line count**, not the width of the text — a one-line title in a
`flex-start` column shrinks to fit, which is why an earlier attempt to assert "width > 300px" came
back 224px and looked like a failure.

### A third claim, checked because the screenshot looked wrong

The open quick-add is supposed to dim the tab bar (group 31). In the capture the bar looked
undimmed, so it was measured instead of trusted:

```text
elementFromPoint over the tab bar, menu closed   SVG            (the nav's own icon)
elementFromPoint over the tab bar, menu open     DIV z=1300     rgba(20, 18, 32, 0.45)
nav z-index                                      1100
```

The scrim is on top. The bar is dimmed; the PNG was misread.

### The screenshot set

```text
desktop        52/52   1440 x 900, light
mobile         54/54   402 x 874 @3x, light
desktop-dark   18/18
mobile-dark    19/19
               143 PNGs, 0 problems reported
```

The script fails if a screen is missing from any profile or comes back under 3 kB, so "143" is an
assertion rather than a count.

### Diffed against the handoff

Every screen with an artboard was opened beside its capture:

| Artboard | Capture | Verdict |
| --- | --- | --- |
| `Login.html` | `desktop/01-login` | matches |
| `Dashboard-Light.html` | `desktop/19-dashboard` | matches |
| `Dashboard-Dark.html` | `desktop-dark/19-dashboard` | matches |
| `Mobile-Dashboard-Light.html` | `mobile/19-dashboard` | matches; the drawn quick-action row is deliberately absent (group 31) |
| `Mobile-Dashboard-Dark.html` | `mobile-dark/19-dashboard` | matches |
| `Activity-Light.html` | `desktop/32-activity` | matches; badges stack below the text under `md`, which the artboard does not show |
| `AddExpense-Light.html` | `desktop/34-expense-new` | matches; the reference appears once, in the rail, not also as a header eyebrow |
| `Mobile-AddExpense-Light.html` | `mobile/34-expense-new` | matches |
| `SettleUp-Light.html` | `desktop/46-settle-up` | matches; no side rail, as drawn |
| `Mobile-QuickAdd-Expanded.html` | `mobile/54-quick-add-expanded` | matches |
| `Style-Guide.html` | every component | transcribed in groups 22–29 |

### Suites, in full

```text
npm run verify            typecheck, eslint, 677 unit tests      pass
npx vitest run --project ui                355                   pass
npm run test:integration                   508                   pass
npx vitest run --project offline           150                   pass
npm run test:all          66 files, 1,690                        pass
npm run build             35 routes, middleware 86.8 kB          pass
npx eslint src tests scripts                                     clean
npm run test:e2e          27 specs                               25 pass, 2 fail (3.1)
```

---

## 6. Known gaps

### Blocking

- **Sign-out does not end the session.** Section 3.1. Two failing specs, a security defect, and a
  fix that needs a decision about session-extension semantics. **This should be the next task.**

### Needs the designer

- **Three palette values are not the ones drawn** — `tealText`, `coralText`, `mintText`. All three
  failed AA at the size and weight the handoff draws them; the replacements are a judgement.
  Four more were darkened in group 21 for the same reason.
- **Sixteen dark screens were never drawn.** Only the two dashboards have a dark artboard. The
  dark focus ring is derived too.
- **Forty screens were never drawn**, listed in section 6 of the refreshed
  `design/screenshots/README.md`. The undrawn work most unlike anything in the handoff: the four
  account screens, the people list and both person forms, the settlements list and detail, the
  categories tree with its **icon picker**, sign-up, and both not-found pages.
- **Fourteen in-house glyphs.** The handoff names 28 icons; the app needs 43.
- **`calendar` appears only in the icon picker.** The artboard draws a calendar glyph on the date
  field. A native `<input type="date">` indicator cannot be replaced across browsers without
  giving up the platform picker, and the picker won.
- **`bolt` and `cart`** now have call sites — they are offered by the icon picker and the
  screenshot seed uses them — so the two glyphs drawn with no home in group 25 have one.
- **`TILE_EDGES.info`** is defined and unused: no summary tile is currently an informational one.
  Either a tile wants it or it should go.
- **Accumulated review items from groups 33–40** are listed in each group's document, under
  "Unreviewed by the designer".

### Not addressed by this series

- **Loading and skeleton states.** `docs/04-USER-FLOWS.md` section 24 asks for them; nothing in
  the restyle touched them, and they are in no screenshot.
- **Archived views.** Built — a quiet `ARCHIVED` badge on a sunken row — but the seed has nothing
  archived, so they are in no screenshot either.
- **Forced-colors / Windows High Contrast.** The biggest open risk in the new design, because it
  removes `box-shadow`, which is both the elevation system and the focus indicator. Group 40,
  section 6.
- **A screen-reader pass.** Group 40 verified that accessible names exist; whether the money
  components and the two editors *announce* usefully needs a person with a screen reader.
- **No settings screen, no reports, no income.** Out of scope for a restyle, and unchanged.

---

## 7. Notes for the next group

There is no next group in this series. What a future one needs to know:

- **Run `npm run test:e2e` per group, not once at the end.** It found one regression that had been
  in the app for thirteen groups (a heading that stopped being a heading), and it found it in the
  only place that could — a real browser asserting a role.
- **`npm run screenshots -- --skip-build`** reuses the build and turns a ten-minute run into three.
  Look at the output; the two problems in section 3.5 were both invisible in the code and obvious
  in the images.
- **Adding a dark screen is one line** in `DARK_SHOTS`. Adding any screen means adding it to
  `EXPECTED_SHOTS`, which is what makes a silent capture failure an error.
- **The two artefacts from group 40 are the ones to keep alive**: `src/theme/contrast.test.ts`
  fails the build if a palette change breaks a contrast pair, and
  `tests/e2e/focus-visible.spec.ts` fails if the focus ring stops painting. Neither needs anybody
  to remember to re-run an audit.
