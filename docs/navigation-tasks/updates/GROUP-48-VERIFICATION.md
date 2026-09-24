# Group 48 — Verification And Recapture

The group that proves the work. Every screen groups 42-47 touched already rendered, compiled and
passed its tests **before** the series started, so "it works" needed a specific definition.

It also records one mistake made during this group, in section 3.2. Read that one.

---

## 1. What was built

Three things, none of them a feature:

- **A navigation e2e suite** — 13 tests, all of which open a **cold URL** because that is the case
  `router.back()` got wrong.
- **Two permanent geometry guards** for the design series' measured bug fixes, which this series
  put at risk.
- **A recapture** of all 145 screenshots, including one new screen.

Plus the corrections to `design/screenshots/README.md`, whose section 5 stated three navigation
gaps that this series closed.

---

## 2. Files added or changed

| File | Change |
| --- | --- |
| `tests/e2e/navigation.spec.ts` | **New.** 13 tests across 5 describes |
| `tests/ui/navigation.test.tsx` | **New.** 9 tests: parent labels, Cancel semantics, `Alert.action` |
| `scripts/capture-screenshots.ts` | `55-expense-edit-settled` added to `EXPECTED_SHOTS`, with a guarded capture |
| `design/screenshots/**` | 145 PNGs recaptured |
| `design/screenshots/README.md` | Counts 52/54 → 53/55; new "On-screen navigation" subsection in 5; three stale gap claims corrected; index row for `55` |
| `docs/navigation-tasks/01-NAVIGATION-AUDIT.md` | Section 9 corrected: **one** uncaptured screen, not two |
| `docs/navigation-tasks/02-NAVIGATION-TASK-GROUPS.md` | All 99 boxes ticked; six annotated where the outcome differed from the wording |
| `docs/navigation-tasks/updates/*` | Seven group documents plus the index |

---

## 3. Key decisions

### 3.1 A cold URL is the whole point

The most important thing in this document. `page.goto("about:blank")` then `page.goto(target)`, so
the only history entry behind the form is a blank page.

```ts
async function openCold(page: Page, url: string): Promise<void> {
  await page.goto("about:blank");
  await page.goto(url);
}
```

**A test that reached these forms by clicking a link would pass with or without the fix**, because
`router.back()` works fine when there is history. The cold URL reproduces a shared link, a
bookmark, a refresh, and arrival from the quick-add button — and those are the four ways the old
behaviour was wrong.

If someone later "simplifies" these tests to navigate by clicking, the suite stops testing anything.

### 3.2 A mistake: one e2e run wrote to the real database

**What happened.** Verifying a single failing test, I ran `npx playwright test` directly instead of
`npm run test:e2e`. The wrapper exists precisely to prevent this — it boots a disposable in-memory
replica set and passes `MONGODB_URI` down — and running Playwright directly makes Next read
`.env.local`, which points at the developer's real Atlas cluster and the `expense_tracker_dev`
database. `playwright.config.ts` says so in a comment, which had been read.

**What it wrote.** Two test users and 25 documents:

```text
users                  2   user-20424-1@example.test, user-20424-2@example.test
categories            18   the 9 seeded defaults, twice
accounts               1
people                 1
transactions           1
expenseSplits          2
settlements            1
settlementAllocations  1
```

**What it did not touch.** Every write is scoped to a `userId`, and both users were created by the
run. The one real user's 9 categories and 3 people were unaffected; no existing document was read,
modified or deleted.

**Why it was not cleaned up here.** Deleting from a live cluster is not reversible and is not a
call to make unprompted. The data is cleanly identifiable — `email` matching `/@example\.test$/`
plus the documents whose `userId` is one of those two `_id`s — so removal is a contained operation
whenever it is wanted.

**Two notes for whoever does clean it up.** First, `userId` is stored as an **ObjectId**, not a
string (`toObjectId(userId)` in every repository) — a delete filtered on string ids matches nothing
and looks like success. Second, a temporary audit script used to gather the numbers above lived in
`scripts/`, which is inside the `tsconfig` include, so it **broke `next build`** until deleted;
anything similar belongs outside `scripts/` or should be removed immediately.

The lesson is narrow and worth stating plainly: for this project, e2e is `npm run test:e2e`, always,
including for a single test. Use `--grep=<pattern>` to narrow it. Note also that
`npm run test:e2e -- <path>` reports "No tests found" — `--grep` is the working form.

### 3.3 The geometry measurements became permanent tests, not one-off numbers

The project's convention is to measure in a browser and record the numbers in an update document.
Here they were made into assertions instead, because this series put **two previously-fixed bugs**
at risk and neither has any other guard:

| Measured | Guards |
| --- | --- |
| the mobile `h1` renders on **one line** at 393px, and its row is still `column` | the crushed-title bug — group 44 restructured the component that fixes it |
| Cancel's box sits inside the form's box at 393px **and** 1440px, and is wider than 60px | the clipped-Cancel bug — group 46 changed every `onCancel` |

Line count is derived rather than eyeballed: `boundingClientRect().height / lineHeight`, rounded.
The `/transactions/new` header is the worst case — "Add expense" plus a three-button `FormSwitcher`.

`FormActions` was not modified by this series, but "we did not touch it" is a weaker claim than a
measurement, so it is measured anyway.

### 3.4 One new screenshot, and it asserts before it shoots

`55-expense-edit-settled`. The capture navigates to the settled shared expense's edit URL and
checks the `Cannot edit` heading is visible **before** taking the picture; otherwise it records a
note. Without that check, a change to the seed that left the expense unsettled would silently
produce a photograph of a working edit form filed under a name saying the opposite.

### 3.5 What is asserted, and what is only reviewed

Stated plainly so nobody assumes more coverage than exists.

**Asserted by a test:** back links on 3 of 7 detail routes; Cancel on 4 of 10 form routes; 2 of 5
guards; the guard-has-no-Cancel-but-has-a-back-link property; both `/settlements` reachability
paths; both geometry fixes; the `PARENTS`/`NAV_ITEMS` label agreement; `Alert.action`; `BackLink`'s
role, href, accessible name and hidden glyph; `PageHeader.parent`'s presence, order, landmark and
non-interference with `meta`.

**Reviewed from screenshots only:** the remaining back links, the six linked `DetailRow`s, the
settlement-history rows, the shared-expense participant rows, and the "Cannot edit" screen's links.

The `PARENTS` label test is the one that covers more than it looks: every page using `PARENTS` gets
its label from `NAV_ITEMS` by construction, so a wrong label is impossible rather than untested.

---

## 4. Business rules enforced

None added. What was checked is that none were broken — the series changed destinations, not
calculations:

- No view model, query, repository interface or schema changed in groups 43-47. The one new query,
  `getSettlementsBlockingExpense`, is read-only and composes two existing repository calls.
- The 1,711-test suite includes every integration test asserting the financial rules, and all pass.
- A settled expense is still not editable; a record's type is still fixed; the three amounts on a
  shared expense are still distinct; direction is still stated in words.

---

## 5. How it was verified

```text
npx tsc --noEmit          clean
npx eslint .              clean
npx prettier --check      clean
npx vitest run            1711 passed, 68 files
npm run build             succeeds
npm run test:e2e          navigation: 13/13 passed
npm run screenshots       145 captured, 0 notes
```

### The navigation suite

```text
back links on detail pages
  ok  an account detail page returns to the accounts list
  ok  an expense detail page returns to Activity, not to Transactions
  ok  a person detail page returns to the people list
Cancel on a cold URL
  ok  a create form cancels to its section list
  ok  the expense form cancels to Activity even when opened directly
  ok  an edit form cancels to the record, not to the list
prerequisite guards
  ok  the expense form offers a way to create the account it needs
  ok  the split form offers a way to add the person it needs
  ok  a guard screen still has a back link, since it has no Cancel
the settlement dead end
  ok  a settlement detail page can reach its own list
  ok  the people list can reach the settlements list
the two layout fixes this series risked
  ok  the mobile page title still renders on one line at 393px
  ok  Cancel stays inside its card at 393px and at 1440px
```

### The capture

```text
desktop: 53/53   mobile: 55/55   desktop-dark: 18/18   mobile-dark: 19/19
```

Reviewed directly: `desktop/55-expense-edit-settled.png` shows the back link
`‹ TEAM DINNER AT TOIT` above the title, with "Open the settlement" and "Back to the expense" in the
alert — the dead end is visibly closed. `mobile/36-expense-detail-personal.png` shows `‹ ACTIVITY`
above a one-line title, with **Account** and **Category** now rendered as links.

### Pre-existing e2e flakiness — not caused by this series

The full `npm run test:e2e` run is not reliably green, and it was not before this work either.
Across three runs a **different** colour-mode test failed each time, always in 1-3ms — too fast to
be an assertion on a loaded page — plus once a `journeys` auth test. Each failing test **passes in
isolation**.

Three reasons this is not attributable to the navigation work:

1. `color-mode.spec.ts` sorts **before** `navigation.spec.ts`, and the suite runs with
   `workers: 1, fullyParallel: false`. It executes first.
2. Nothing in groups 42-48 touches `ColorModeProvider`, `ColorModeScript`, the theme, or
   `localStorage`.
3. `docs/design-tasks/updates/README.md` already records the design series ending with "2 e2e
   failures" outstanding.

It could not be isolated with git: `HEAD` predates the design series, so the groups 21-41 work is
also uncommitted and stashing removes far more than this series. Recorded as a known gap rather than
investigated, because it is a different task.

---

## 6. Known gaps

- **The e2e suite is intermittently red** for reasons unrelated to navigation — section 5. Worth its
  own task; the 1-3ms failure duration suggests context or worker setup rather than application
  behaviour.
- **Two test users and 25 documents are in the real `expense_tracker_dev` database** — section 3.2.
  Awaiting a decision on cleanup.
- **The unasserted half of the work is screenshot-reviewed only** — section 3.5.
- **Screen-reader verification is still manual.** The suite asserts accessible *names* and DOM
  order; it cannot assert how a screen reader announces the header landmark. Same position as the
  design series' group 40.
- **No `loading.tsx` anywhere.** Surfaced while enumerating routes in the audit, declared out of
  scope, still true.
- **No designer sign-off** on the back link's placement or on `chevron-left`.

---

## 7. Notes for the next group

There is no next group — the series is complete, and all 99 boxes in
`02-NAVIGATION-TASK-GROUPS.md` are ticked. Six carry an inline annotation where the outcome differed
from the wording: two conditional measurements that did not apply, the "two unphotographed screens"
that turned out to be one, the one `PageHeader` test whose selector changed, and the e2e caveat.

Three things are queued behind this work, in the order they are worth doing:

1. **Sign-out does not end the session.** A pre-existing auth defect, diagnosed with evidence in
   `docs/design-tasks/updates/GROUP-41-VERIFICATION.md` section 3.1, untouched by two whole series
   now. It is a security-adjacent bug and it should be next.
2. **The flaky e2e specs** — section 5.
3. **Designer review** of the back link, `chevron-left`, and everything still listed in
   `design/screenshots/README.md` section 6.
