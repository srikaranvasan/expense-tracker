# Navigation Audit — On-screen Wayfinding

The findings. Every route in the app checked for the navigation that lives **on the page**
rather than in the app frame: a way back, a breadcrumb, a link to the record the page names,
a way out of a form, a way out of a guard.

The work itself — what to build, in what order — is in
[`02-NAVIGATION-TASK-GROUPS.md`](02-NAVIGATION-TASK-GROUPS.md). This document is what that one
points back at.

The app today has a complete, working app frame: five nav destinations in a desktop header, the
same five in a mobile tab bar, and a quick-add button. What it does not have is **a single back
button, a single breadcrumb, or a single page that names its own parent.**

Fifteen of the twenty-eight screens have no on-screen way back to where they came from, and
three of those cannot be left at all except by the browser's own back button.

---

## Contents

```text
 0  How to use these two documents
 1  How this audit was done
 2  What navigation exists today
 3  What does not exist
 4  The four defect classes
 5  Route-by-route audit
 6  The dead ends, in detail
 7  Proposed contracts
 8  Rules that must survive the fix
 9  How a fix gets verified
```

---

# 0. How to use these two documents

| Document | Holds | Read it |
| --- | --- | --- |
| `01-NAVIGATION-AUDIT.md` (this file) | the audit, the defect classes, the route table, the proposed contracts | once before starting, then whenever a group references a section |
| `02-NAVIGATION-TASK-GROUPS.md` | groups 42-48, the checkboxes, build order, definition of done | as you work |

Bracketed numbers in the task groups — `(5.3)`, `(7.1)` — are section numbers in **this** file.
Where a group needs a rule from the visual language instead, it says so and cites
`docs/design-tasks/01-DESIGN-SYSTEM.md` by name.

Nothing here proposes a new visual idea. Every affordance this document asks for is either a
component the app already has (`CardActionLink`, `RowLink`, `AppLink`, `FormActions`,
`EmptyState`, `Alert`) or a small new primitive built from existing tokens. The gaps that need
a **decision** rather than an implementation are in section 7.

---

# 1. How this audit was done

Two passes, because either one alone would have been wrong.

**Code, for completeness.** Every file under `src/app/` was enumerated — 29 route files, 28 of
which put something on screen — and each was read for what it renders. This is the
authoritative pass: a screenshot can only show the states somebody thought to capture, and a
guard state or a conditional action is easy to miss.

**Screenshots, for confirmation.** `design/screenshots/` holds the current build at four
profiles, captured after design groups 21-41. Spot-checks against
`mobile/36-expense-detail-personal.png` and `desktop/49-settlement-detail.png` confirmed the
code reading: on a phone, an expense detail page shows a title, an `Edit` button, three cards
and the tab bar, and **nothing that goes back to the list it was opened from**. On desktop, a
settlement detail page shows no path to `/settlements`, and `/settlements` is not in the header
nav either.

The set was **not** recaptured for this audit. Nothing has changed in the app since it was
taken, and re-running `npm run screenshots` costs a full production build plus an in-memory
MongoDB replica set. It should be re-run **after** the fixes land — that is a task in group 48,
and the script already has a `--skip-build` flag for iterating.

Sources:

| What | Where |
| --- | --- |
| Route inventory, and what each page renders | `src/app/**`, read file by file |
| Navigation chrome | `src/components/layout/` — `AppShell`, `AppHeader`, `HeaderNav`, `BottomNav`, `NavItems.ts`, `PageHeader`, `QuickAdd` |
| Existing link primitives | `src/components/ui/AppLink.tsx` — `AppLink`, `CardActionLink`, `RowLink` |
| The only "way out" on a form | `src/components/ui/FormActions.tsx` |
| Current rendered UI | `design/screenshots/` (52 desktop, 54 mobile, 18 + 19 dark) |
| Intended navigation | `docs/04-USER-FLOWS.md` section 2 |
| Screen → route index and the known-gaps list | `design/screenshots/README.md` sections 3-5 |
| Visual language and component contracts | `docs/design-tasks/01-DESIGN-SYSTEM.md` sections 7.5, 8, 9 |

Three of the findings below are **already written down** in `design/screenshots/README.md`
section 5 — no desktop sidebar, `/settlements` missing from the nav, and every create form
ending on a detail page with no return to the list. They are repeated here with the rest of the
picture rather than left as prose in a screenshot README.

---

# 2. What navigation exists today

## 2.1 The app frame

`AppShell` wraps every authenticated page (`src/app/(app)/layout.tsx`) and provides:

```text
desktop ≥768px   header: [mark] Expense Tracker   Home  Activity  Accounts  People  Categories
                         [avatar] Meera Iyer  [theme]  [sign out]

mobile  <768px   header: [mark] Expense Tracker   [avatar] [theme] [sign out]
                 tab bar: Home  Activity  Accounts  People  Categories
                 FAB: quick-add → Add expense / Split a bill / Transfer / Pay card
```

`HeaderNav` and `BottomNav` both read one list, `NAV_ITEMS` in
`src/components/layout/NavItems.ts`, so the two widths cannot disagree. `isActiveNavItem()`
does prefix matching, so `/accounts/abc/edit` still highlights **Accounts** — a user three
levels deep can at least see which section they are in.

This part works. It is not what this audit is about.

## 2.2 The per-page affordances that do exist

| Affordance | Component | Where it is used |
| --- | --- | --- |
| "See all" / "View all" / "Manage" card action | `CardActionLink` | 5 dashboard cards, 3 archived-toggles (`/accounts`, `/people`, `/categories`) |
| Whole-row link into a detail page | `RowLink` | every list: accounts, people, transactions, settlements, dashboard cards |
| Inline text link | `AppLink` | scattered; `login ↔ register`, settlement → person, settlement → transaction |
| Lateral switch between the four transaction forms | `FormSwitcher` | `/transactions/new` and its three siblings |
| Cancel on a form | `FormActions` (`onCancel` is a **required** prop) | 8 forms, all calling `router.back()` |
| Named escape from a system state | `EmptyState` / `ErrorState` action | both 404s, both error boundaries, `/offline` |

Two of those deserve credit, because they are the pattern the rest of the app should copy:

- **`/accounts/[id]` has a "View transactions for this account" row** that goes to
  `/transactions?accountId=…`. It is the only detail page in the app that offers a filtered
  view of related records.
- **`/settlements/[id]` links the person and each settled expense by name.** It is the only
  detail page where a named record is a link rather than plain text.

## 2.3 Everything is forward

Read the list in 2.2 again and one thing is true of all of it: **every affordance moves the
user further in, or sideways.** `RowLink` goes down a level. `CardActionLink` goes across.
`FormSwitcher` goes across. The only thing pointing back up is `FormActions`' Cancel, and that
is a history call, not a hierarchy one (4.3).

---

# 3. What does not exist

Verified absent from the codebase, not merely unused:

- **No `BackButton` component.** No file, no variant, no prop.
- **No `Breadcrumb` component.** Nothing renders a trail anywhere in the app.
- **No parent link on `PageHeader`.** Its entire prop list is `title`, `description`, `action`,
  `meta`. There is no slot a back link could go into without changing the component.
- **No desktop sidebar.** `docs/04-USER-FLOWS.md` section 2 asks for one; the restyle did not
  add it, and `design/screenshots/README.md` section 5 records why — there is nothing to put in
  it until Reports and Settings exist.
- **No `loading.tsx` anywhere**, so there is no route-level pending state to navigate out of.
  Out of scope here; noted because it came up while enumerating.

That last one is the good news. `PageHeader` is imported in **22 files** — 19 route files, plus
`ExpenseDetail`, `TransferDetail` and `CardPaymentDetail`, which are how `/transactions/[id]`
renders its three record types. Between them they cover **20 of the 22 screens** in the `(app)`
group. The two it does not reach are the boundary screens, `(app)/not-found.tsx` and
`(app)/error.tsx`, and both render their own `h1` and already carry a named escape.

So one prop on one component reaches every screen that needs a parent link, and it reaches them
through code that is already there.

---

# 4. The four defect classes

Every finding in section 5 is one of these four. The labels are used in the route table and in
the task groups.

## 4.1 `DEAD-END` — nothing on the page moves the user anywhere useful

The page offers no upward path, **and** the section it belongs to is not in the tab bar either.
The user's only options are to pick an unrelated destination from the nav or use the browser's
back button.

Three instances. All three are in section 6.

## 4.2 `NO-WAY-UP` — the page never names its parent

The parent list is one tap away in the nav, so the user is not stranded, but the page itself
says nothing about where it sits. Arriving by deep link, by a shared URL, by a refresh, or from
the quick-add FAB, there is no on-screen indication of what this record belongs to and no link
to it.

This is the largest class: **every detail and edit page in the app**, nine routes.

## 4.3 `HISTORY-ONLY` — the only way out is `router.back()`

Eight forms call `router.back()` from `FormActions`' `onCancel`. That is correct when the user
arrived by clicking a link, and wrong in three ordinary situations:

```text
deep link / shared URL    no history entry → back() goes nowhere, or leaves the app
page refresh              history is replaced → back() returns to the same form
quick-add FAB from        back() returns to a settlement, an account, a person —
  anywhere in the app       any screen at all, because the FAB is on all of them
```

`FormActions` was built in design group 27 to make an *unreachable* Cancel impossible, and it
succeeded — `onCancel` is a required prop precisely so a form cannot ship without a way out.
What it does not do, and was never asked to do, is guarantee that the way out **goes anywhere
sensible**. That is this audit's finding, not a defect in that component.

## 4.4 `NAMED-NOT-LINKED` — the page shows a record's name as plain text

A detail page names another record and does not link to it, so the user has to go to the nav,
find the section, and search the list. Every account, category and card name on every
transaction detail page is a `DetailRow` value — a string.

```text
ExpenseDetail       Account "HDFC Savings"        plain text
                    Category "Groceries"          plain text
TransferDetail      From / To account names       plain text
CardPaymentDetail   "Paid from" / "Card" names    plain text
SettlementDetail    Person name                   LINKED  ← the exception
                    Account name                  plain text
                    each settled expense          LINKED  ← the exception
```

The inconsistency is the finding. `/settlements/[id]` proves the pattern works and the view
model already carries the ids; the other three detail components simply never did it.

---

# 5. Route-by-route audit

28 screens. **Parent** is the hierarchical parent — where "up" should go — not necessarily
where the user came from.

## 5.1 Public and system screens

| Route | Parent | On screen now | Finding |
| --- | --- | --- | --- |
| `/` | — | redirect only, no UI | — |
| `/login` | — | link to `/register` | OK |
| `/register` | — | link to `/login` | OK |
| `/offline` | — | "Try again" + "Go to dashboard". **No header, no nav** (deliberate — the page must work with no session) | OK |
| `not-found.tsx` (global) | — | "Go to dashboard". No header, no nav | OK |
| `error.tsx` (root) | — | "Try again" + "Start again" → `/` | OK |
| `global-error.tsx` | — | "Try again" + plain `<a href="/dashboard">`. Inline styles, no components — correct, the provider may have failed | OK |

All seven are fine. Each offers exactly one named escape, which is the right amount for a
screen that exists because something went wrong.

## 5.2 Nav destinations

| Route | Parent | On screen now | Finding |
| --- | --- | --- | --- |
| `/dashboard` | — | 5 `CardActionLink`s (`/transactions` ×2, `/people`, `/accounts`, `/settlements`), `QuickActions` ×4, row links | OK |
| `/transactions` | — | filters, 3 create buttons, row links | OK |
| `/accounts` | — | "Add account", 4 summary tiles, row links, archived toggle | OK |
| `/people` | — | row links, archived toggle | OK |
| `/categories` | — | inline add/edit, archived toggle | OK |

These five are in the tab bar, so "up" is not a question for them. No action needed.

## 5.3 Level-1 route that is **not** a nav destination

| Route | Parent | On screen now | Finding |
| --- | --- | --- | --- |
| `/settlements` | — (should be a destination) | row links, "Load older", "Settle up with someone" → `/people`, `EmptyState` → `/people` | **`DEAD-END`** — not in `NAV_ITEMS`. Reachable only from the dashboard's "See all" and from the settle-up flow. Nothing on the page returns to either. |

## 5.4 Create forms

All six render `PageHeader` with no parent link, and all six hand `FormActions` a
`router.back()`.

| Route | Parent | On screen now | Finding |
| --- | --- | --- | --- |
| `/accounts/new` | `/accounts` | Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |
| `/people/new` | `/people` | Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |
| `/transactions/new` | `/transactions` | `FormSwitcher` (lateral), Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |
| `/transactions/new/shared` | `/transactions` | `FormSwitcher`, Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |
| `/transactions/new/transfer` | `/transactions` | `FormSwitcher`, Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |
| `/transactions/new/card-payment` | `/transactions` | `FormSwitcher`, Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |

The four transaction forms are the ones the quick-add FAB opens, which makes `HISTORY-ONLY`
worst here: the FAB is on **every** authenticated screen, so Cancel can return the user to a
settlement detail page they have no further business on.

## 5.5 Detail pages

| Route | Parent | On screen now | Finding |
| --- | --- | --- | --- |
| `/accounts/[id]` | `/accounts` | swatch + archived badge in `meta`, "Pay card" (cards only), "Edit", **"View transactions for this account"** row, archive control | `NO-WAY-UP` |
| `/people/[id]` | `/people` | avatar + badge in `meta`, "Settle up" (when unsettled), "Edit", obligation rows, settlement history rows, archive control | `NO-WAY-UP`; settlement history rows are **not** links |
| `/transactions/[id]` — expense | `/transactions` | "Edit" — **only when personal and unshared** | `NO-WAY-UP`, `NAMED-NOT-LINKED` |
| `/transactions/[id]` — **shared** expense | `/transactions` | no `action` at all. Participant rows are not links | **`DEAD-END`** — see 6.2 |
| `/transactions/[id]` — transfer | `/transactions` | "Edit" | `NO-WAY-UP`, `NAMED-NOT-LINKED` |
| `/transactions/[id]` — card payment | `/transactions` | "Edit" | `NO-WAY-UP`, `NAMED-NOT-LINKED` |
| `/settlements/[id]` | `/settlements` | person linked, settled expenses linked, delete control. **No `action` in the header** | **`DEAD-END`** — see 6.1 |

## 5.6 Edit and action forms

| Route | Parent | On screen now | Finding |
| --- | --- | --- | --- |
| `/accounts/[id]/edit` | `/accounts/[id]` | account name as `description` text, Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` — the record it is editing is named but not linked |
| `/people/[id]/edit` | `/people/[id]` | person name as `description`, Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |
| `/people/[id]/settle` | `/people/[id]` | person name in `description`, allocation box, Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |
| `/transactions/[id]/edit` | `/transactions/[id]` | description as `description`, Cancel → `back()` | `NO-WAY-UP`, `HISTORY-ONLY` |
| `/transactions/[id]/edit` — **settled expense** | `/transactions/[id]` | a warning `Alert` and **nothing else** | **`DEAD-END`** — see 6.3 |

Every one of these five is three levels deep and shows the parent record's name as inert text
in `PageHeader`'s `description`. The name is already on screen; it is just not a link.

## 5.7 Prerequisite guard states

Five guard blocks across four routes. Each is a plain `Alert tone="warning"` that tells the
user what to create and **does not link to where they create it**.

| Route | Guard | Tells the user to | Links there |
| --- | --- | --- | --- |
| `/transactions/new` | `ExpenseForm:147` "Add an account first" | create an account | **no** |
| `/transactions/new/shared` | `SharedExpenseForm:100` "Add someone first" | add a person | **no** |
| `/transactions/new/shared` | `SharedExpenseForm:109` "Add an account first" | create an account | **no** |
| `/transactions/new/transfer` | `TransferForm:89` "Add another account first" | add a second account | **no** |
| `/transactions/new/card-payment` | `CardPaymentForm:99` "Add the accounts first" | add a card and a funding account | **no** |

These are screens `14`–`17` in `design/screenshots/README.md`, which already says it plainly:
between them they are the most common first experience in the app, and each is a plain warning
block rather than anything guided. A new user who taps "Add expense" on an empty account is
told to go and create an account, and then has to work out where.

Worth noting: the guard replaces the whole form, so `FormActions` never renders — **there is no
Cancel on a guard screen either.** The tab bar is the only thing on the page that moves.

## 5.8 Boundary screens inside the shell

| Route | On screen now | Finding |
| --- | --- | --- |
| `(app)/not-found.tsx` | `EmptyState` → "Back to transactions". The only page in `(app)` with **no** `PageHeader` | OK. Nav stays mounted, which is why it is in the group |
| `(app)/error.tsx` | "Try again" + "Go to dashboard" + "You can also use the navigation below" | OK |

Both are fine, and `(app)/not-found.tsx` is the one place in the app where a back-link already
exists and is worded as one.

## 5.9 Tally

By screen. Every route that puts something on screen is in exactly one column.

```text
OK                     13     5 nav destinations
                              6 public/system    /login /register /offline
                                                 not-found error global-error
                              2 (app) boundaries not-found error

NEEDS WORK             15     1 orphan list      /settlements
                              6 create forms
                              4 detail pages
                              4 edit and action forms
                       ──
                       28     plus `/`, a redirect with no UI — 29 route files in total
```

By finding. A screen can carry more than one, so these do not add to 28.

```text
NO-WAY-UP              13     6 create forms, 3 detail pages, 4 edit and action forms
HISTORY-ONLY           10     6 create forms, 3 edit forms, 1 settle-up
GUARD WITH NO EXIT      5     across 4 routes
NAMED-NOT-LINKED        4     3 transaction detail components + settlement account row
DEAD-END                3     /settlements, shared-expense detail, settled-expense edit
```

So: **13 of 28 screens are fine, 15 need work**, and 3 of those 15 cannot be escaped at all
without the browser's own back button.

The classes overlap by design — a create form is both `NO-WAY-UP` and `HISTORY-ONLY`, and one
change to `PageHeader` plus one change to each `onCancel` closes both.

---

# 6. The dead ends, in detail

These three are the reason this audit exists. Everything else in section 5 is an inconvenience;
these are screens a user can reach and cannot leave by anything the app put on the page.

## 6.1 `/settlements/[id]` — two levels with no floor

```text
/dashboard  ──"See all"──▶  /settlements  ──row──▶  /settlements/[id]
                                 ▲                        │
                                 └────────── ✗ ───────────┘   no link back
     ▲
     └──────────────────── ✗ ────────────────  not in NAV_ITEMS
```

A user opens a settlement from the dashboard. The page shows the amount, the direction, the
person, the account, the date and the expenses it cleared. To get back to the list of
settlements there is no link — and the tab bar does not contain **Settlements** either, so the
list is not one tap away the way `/accounts` is from `/accounts/[id]`.

The page does link out, to `/people/[id]` and to each `/transactions/[id]`. Both go *sideways
into another section*. Following either one is how a user ends up somewhere they were not
trying to be, and the trail back to the settlement list is gone.

Confirmed in `desktop/49-settlement-detail.png`: header nav reads Home · Activity · Accounts ·
People · Categories. No Settlements. Nothing above the `₹2,950.00` title.

## 6.2 Shared expense detail — no action, no participants to follow

`ExpenseDetail` renders its `Edit` button only when `isExpense && !expense.isShared`:

```tsx
const canEditInline = isExpense && !expense.isShared;
```

That is correct — a shared expense with settlement allocations against it cannot be edited
inline, which is the same rule 6.3 enforces. The consequence is that on a **shared** expense the
page header has no `action` at all, the participant rows in "Split between" are plain `Flex`
rows rather than links, and the three cards below are inert.

So the most complex record in the app — the one a user is most likely to open twice while
working out who owes what — is the one with the fewest ways off it. Screen
`41-expense-detail-shared`.

## 6.3 "Cannot edit" — a warning with no way out at all

`src/app/(app)/transactions/[id]/edit/page.tsx`, the settled-expense branch:

```tsx
if (await isExpenseSettled(user.id, expense.id)) {
  return (
    <Box as="section">
      <PageHeader title="Cannot edit" description={expense.description} />
      <Alert tone="warning" title="This expense has been settled">
        Changing it would leave the settlement pointing at a share that no longer exists. Remove
        the settlement first, then edit the expense.
      </Alert>
    </Box>
  );
}
```

Two things are on this page: a title and a paragraph. The form never renders, so `FormActions`
never renders, so there is no Cancel. The text names two records — *this expense* and *the
settlement* — and links to neither. The user is told to go and remove a settlement, on a screen
that cannot reach the settlement, cannot reach the expense, and is not itself in the nav.

This is the worst screen in the app for navigation, it has no screenshot in the current set,
and it is reached by the ordinary action of tapping `Edit`. It is also the cheapest to fix:
`Alert` already accepts children, and both ids are in scope.

---

# 7. Proposed contracts

What to build. Two decisions need making first (7.1); the rest is implementation.

## 7.1 Decisions needed before coding

### Back link, breadcrumb, or both — **blocking**

At three levels deep (`/accounts/[id]/edit`) a single back link states one hop. A breadcrumb
states the whole trail and gives the user a choice of where to land. The app is at most three
levels deep, and `docs/design-tasks/01-DESIGN-SYSTEM.md` does not draw either one — there is no
artboard for a breadcrumb anywhere in `design/ux/screens/`.

| Option | Cost | Consequence |
| --- | --- | --- |
| **A.** Back link only — one row above the page title, "← Accounts" | Smallest. One new primitive, one `PageHeader` prop. | Every screen gains exactly one upward hop. At three levels the user taps twice. No new visual idea needed. |
| **B.** Breadcrumb only | A new component with truncation rules for a long record name at 402px. | States the full position. Risks the mobile header problem again — a three-segment trail plus a record name does not fit 402px without truncating, and a truncated breadcrumb is decoration. |
| **C.** Back link at every level, breadcrumb only at level 3 | Both components, plus a rule about which appears where. | Most informative, most to keep consistent, and the inconsistency is the kind reviewers will argue about. |

**Recommendation: A**, with the primitive written so a breadcrumb can wrap it later. The app is
shallow, the design has no breadcrumb in it, and one unambiguous hop upward on every screen
closes every `NO-WAY-UP` and `DEAD-END` finding in this document. Adding a trail later is a
change to one component's internals; adding a back link later is a change to twenty pages.

This needs a product/design decision. Do not guess.

### Does `/settlements` go in the tab bar — **blocking**

`NAV_ITEMS` has five entries. `BottomNav` renders them in a 64px row at 402px as
icon-over-label stacks. A sixth entry means either six stacks in that row, or a different
answer for `/settlements`.

| Option | Cost | Consequence |
| --- | --- | --- |
| **A.** Six tabs | Re-measure the tab bar at 402px. Five stacks currently use `justify="space-around"` with `flex: 1`; "Settlements" is the longest label in the set. | Settlements becomes a first-class destination. Risks crushing the labels — the same class of bug the restyle just fixed twice. |
| **B.** Leave the nav at five; fix reachability with a back link from `/settlements/[id]` and a permanent entry point on `/people` | Smallest. | `/settlements` stays a leaf reached from the dashboard and from `/people`, but it is no longer a dead end, and neither is its detail page. |
| **C.** Fold settlements into Activity as a filter | Largest — settlements are not transactions and the list view models differ. | One fewer destination, but it conflates two record types the data model keeps apart. |

**Recommendation: B.** The reachability problem is solved by the back link this audit already
wants everywhere, and a sixth tab reopens a layout bug that took measurement to close. Record
whichever is chosen; do not leave it to whoever writes group 47.

## 7.2 `BackLink` — the new primitive

One row, above `PageHeader`, on every page that has a parent.

```text
← Accounts                        mono uppercase eyebrow treatment, `chevron-left` glyph
Account name                      the existing PageHeader title, unchanged
```

Contract:

- Props: `href` (required), `label` (required). No `router.back()` inside it — it is a
  hierarchy link, and the whole point is that it does not depend on history (4.3).
- Renders a real `next/link` anchor, so it middle-clicks and opens in a new tab like any link.
- Reuses `CardActionLink`'s register — mono, uppercase, tracked, `brand.fg`, underline on hover
  and focus — because it is the same kind of thing: a quiet way onward, not a page action. It
  must not read as a button competing with the header's primary action.
- `minH="touch"` and `_focusVisible={{ boxShadow: "hardFocus" }}`, matching every other link
  primitive in the app.
- `chevron-left` — **does not exist yet.** `src/components/icons/names.ts` has `chevron-down`
  (line 43) and `chevron-right` (line 84), plus `arrow-in` and `arrow-out`, and no left-facing
  chevron. Adding one is a two-line change — a name and a path — but it touches the registry and
  its tests, so it is a task rather than an assumption. Alternatively reuse `arrow-out` rotated,
  which is worse: the icon rule in the design system is one glyph per meaning.

## 7.3 `PageHeader` gains a `parent` prop

```tsx
export type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
  /** Where "up" goes. Renders a BackLink above the title. */
  parent?: { href: string; label: string };
};
```

Rendered **above** the title row, inside the same `as="header"` element, so it is inside the
page's header landmark and ahead of the `h1` in reading order — which is what a screen-reader
user needs from it.

It must not disturb the crushed-title fix. `PageHeader`'s `direction={{ base: "column", md:
"row" }}` and the slim mobile header are load-bearing
(`docs/design-tasks/01-DESIGN-SYSTEM.md` section 9.2). The parent row goes in a wrapping
`Stack` above the existing `Flex`, not into it, and the 22px/28px bottom margin stays on the
outermost element so the page rhythm does not change.

`parent` stays **optional**, because the five nav destinations and the two `(app)` boundary
screens genuinely have no parent. It is not made required the way `FormActions.onCancel` was —
a page with no parent is a real case here, unlike a form with no Cancel.

## 7.4 Forms: a Cancel that knows where it is going

`FormActions` keeps `onCancel` required. What changes is what the eight consumers pass.

```text
now                               proposed
router.back()                     router.push(parentHref)
```

Every one of the eight forms already knows its parent — an edit form has the record's id in
scope, a create form's parent is its section list. Replacing `back()` with a push to the same
`href` the `parent` prop uses makes Cancel and the back link agree, and makes both independent
of how the user arrived.

One judgement call to record: `back()` is *nicer* when there is real history, because it
restores scroll position and any filter state in the URL. A hybrid — use `back()` when
`window.history.length > 1`, otherwise push — is possible and is **not recommended**: it makes
Cancel's destination unpredictable, which is the defect being fixed, and history length is not
a reliable signal of where `back()` will actually land.

## 7.5 Guards: an action, not just a sentence

Each of the five guard blocks in 5.7 gets a named action to the place it is telling the user to
go.

`Alert`'s props are `tone`, `title` and `children` — **there is no `action` slot.** So this is
either an action nested inside `children` below the prose, or a new `action?: ReactNode` prop on
`Alert` rendered below the description. The second is tidier and matches how `CardHeader`,
`EmptyState` and `PageHeader` already separate prose from action; it also means the five guards
cannot each lay their action out differently. Decide in group 42.

| Guard | Action |
| --- | --- |
| `ExpenseForm` "Add an account first" | "Add an account" → `/accounts/new` |
| `SharedExpenseForm` "Add someone first" | "Add a person" → `/people/new` |
| `SharedExpenseForm` "Add an account first" | "Add an account" → `/accounts/new` |
| `TransferForm` "Add another account first" | "Add an account" → `/accounts/new` |
| `CardPaymentForm` "Add the accounts first" | "Add an account" → `/accounts/new` |

Two things to decide while implementing, both small and both worth writing down: whether the
action is a `Button` or an `AppLink` inside the alert, and whether the guard also gets the
`parent` back link from 7.3 — it should, since the guard replaces the form and therefore
replaces the only Cancel on the page.

## 7.6 Link the records a page names

Close `NAMED-NOT-LINKED` (4.4) by making four `DetailRow` values links, exactly as
`SettlementDetail` already does for its person:

| Component | Row | Link to |
| --- | --- | --- |
| `ExpenseDetail` | Account | `/accounts/[accountId]` |
| `ExpenseDetail` | Category | `/transactions?categoryId=[id]` — there is no category detail page |
| `TransferDetail` | From, To | `/accounts/[id]` each |
| `CardPaymentDetail` | Paid from, Card | `/accounts/[id]` each |
| `SettlementDetail` | Account | `/accounts/[id]` |

**Check the view models first.** These components receive view models, not documents, and a
row can only become a link if the id is on the object. `ExpenseDetailView` and the transfer and
card-payment views need auditing for `accountId` / `categoryId` fields before this is costed —
if an id is missing, the fix reaches into
`src/features/transactions/view-models/` and that is a bigger change than a link.

Also in scope: participant rows on a shared expense → `/people/[id]` (6.2), and settlement
history rows on `/people/[id]` → `/settlements/[id]` (5.5).

---

# 8. Rules that must survive the fix

Navigation work is exactly when these get broken, so they are repeated from
`docs/design-tasks/01-DESIGN-SYSTEM.md` and `docs/06-CODING-PRACTICES.md`:

- **No modals or dialogs anywhere.** Not one, in the whole app. A back affordance is a link on
  the page, never a dismiss button on an overlay.
- **One breakpoint, 768px.** A back link appears at both widths or neither. No third layout.
- **Do not reintroduce the crushed mobile title.** At 402px the title gets the full width; the
  parent row is above it, not beside it (7.3). Measure, do not eyeball.
- **Do not reintroduce the clipped Cancel.** `FormActions` owns that row. Group 45 changes what
  `onCancel` *does*, never the geometry of the row it sits in.
- **Every new link is a real anchor.** `next/link` via `asChild`, so it middle-clicks, opens in
  a new tab, and shows a status-bar URL. No `onClick`-only navigation.
- **`minH="touch"` and a visible focus state** on every new interactive element, matching the
  existing link primitives.
- **One source of truth for a destination list.** `NAV_ITEMS` and `QUICK_ADD_ACTIONS` exist so
  two surfaces cannot disagree. If a parent route is needed in more than one place, it goes in
  a module, not in two files.
- **No raw token references.** Same bar as the design series.

## 8.1 Accessibility, specifically

- The parent link is inside `PageHeader`'s `<header>` and **before** the `h1`, so it is
  announced as part of the page's header landmark rather than as stray content.
- If option B or C in 7.1 is chosen, a breadcrumb is `<nav aria-label="Breadcrumb">` with an
  ordered list and `aria-current="page"` on the last segment.
- A back link's accessible name must name the destination — "Back to accounts", not "Back". A
  screen-reader user tabbing a list of links needs each one to stand on its own.
- `BottomNav` and `HeaderNav` already set `aria-current="page"`. Anything added to the frame
  must too.

---

# 9. How a fix gets verified

A navigation defect is invisible to a type checker and to most unit tests — every one of the
fourteen screens in section 5 renders, compiles and passes today. So the bar is specific:

```text
1  Every screen in the 5.9 tally that is not marked OK has a named, on-screen upward path
2  That path is a real anchor with an href — asserted in a test, not observed in a browser
3  Cancel on all eight forms lands on the form's parent when there is NO history
     (open the URL directly, then cancel)
4  All five guard screens offer an action to the record they ask the user to create
5  The three dead ends in section 6 are reachable-and-leavable, each proven by an e2e path
6  Mobile title still renders on one line at 393px — measured, per section 9.2 of the
     design system, not looked at
7  npm run screenshots recaptured, and the new set reviewed for the back link at both widths
8  design/screenshots/README.md section 5's navigation gaps updated to match reality
```

Point 3 is the one that needs saying twice, because it is the failure `router.back()` hides: a
test that navigates to a form by clicking a link will pass whether the fix is in or not. The
test has to open the form's URL cold.

**One screen in section 6 has no screenshot in the current set**: the "Cannot edit" state (6.3).
The other two are captured — `desktop/49-settlement-detail.png` and
`desktop/41-expense-detail-shared.png`. Group 48 should add the missing one to `EXPECTED_SHOTS`
in `scripts/capture-screenshots.ts`, or record why not. A screen with no screenshot is a screen
nobody reviews.

---

Next: [`02-NAVIGATION-TASK-GROUPS.md`](02-NAVIGATION-TASK-GROUPS.md).
