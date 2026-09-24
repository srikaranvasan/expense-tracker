# Group 44 — `PageHeader` Learns About Parents

One optional prop on one component, which is how twenty screens got a back link.

This was the riskiest group in the series: `PageHeader` carries half of the crushed-mobile-title
fix from the design series, and that fix is load-bearing.

---

## 1. What was built

`PageHeader` gained `parent?: { href: string; label: string }`. When present it renders a
`BackLink` above the title, inside the same `<header>` element and ahead of the `h1`.

```tsx
<PageHeader
  title="HDFC Savings"
  description="Bank · HDFC"
  parent={{ href: "/accounts", label: "Accounts" }}
/>
```

`PageHeader` is imported in 22 files — 19 route files plus `ExpenseDetail`, `TransferDetail` and
`CardPaymentDetail` — covering **20 of the 22 screens** in the `(app)` group. So this one prop is
the delivery mechanism for groups 45, 46 and 47.

Also built: `Parents.ts`, the module that supplies the values.

---

## 2. Files added or changed

| File | Change |
| --- | --- |
| `src/components/layout/PageHeader.tsx` | `parent` prop; restructured into an outer `Stack` + the existing title row |
| `src/components/layout/Parents.ts` | **New.** `PARENTS`, `accountParent`, `personParent`, `transactionParent` |
| `tests/ui/shell.test.tsx` | 5 tests added; **1 existing test's selector changed** — see 3.3 |

---

## 3. Key decisions

### 3.1 The parent goes in a wrapper, never in the title row

The only real decision in the group, and it was settled by measuring rather than by preference.

The title row is `align={{ base: "flex-start", md: "baseline" }}`. Baseline alignment uses each
flex item's **first** baseline. Putting the back link above the heading inside the title's `Box`
would therefore make the *back link's* baseline the one `meta` and `action` align to — so the
dashboard's `AS OF 21 SEP 2026, 06:00` eyebrow would sit level with "‹ ACCOUNTS" instead of with
"Dashboard", roughly 20px too high.

So the structure is now:

```text
Stack  as="header"   gap 8/10px   mb 22/28px
├── BackLink                          when `parent` is given
└── Flex  direction column→row        the title row, untouched
    ├── Box   h1 + description
    ├── Box   meta
    └── Box   action
```

The title row keeps its responsive direction, its baseline alignment and its `space-between`
exactly as they were. That is what keeps the crushed-title fix intact — the fix lives on that row,
and the row was not modified.

The `mb` moved to the outer `Stack`, so the 22px/28px gap to the first block below is measured
from the whole header whether or not there is a parent.

### 3.2 `parent` is optional, unlike `FormActions.onCancel`

Worth stating because the two look like parallel cases and are not.

`onCancel` is required because a form with no way out is *always* a bug — there is no such thing
as a form that legitimately cannot be abandoned. But a page with no parent is a real case: the
five nav destinations are top-level, and the two `(app)` boundary screens (`not-found`, `error`)
have no hierarchy and already carry their own named escapes. Making `parent` required would have
forced seven callers to invent an answer.

### 3.3 One existing test's selector changed — and why that is an improvement, not a concession

The group's checklist asked to "verify the existing `PageHeader` tests pass unchanged". Three of
the four did. **One was changed, deliberately, and this is the record of it.**

The test `stacks the title and its action below 768px` asserted:

```ts
expect(window.getComputedStyle(container.firstElementChild!).flexDirection).toBe("column");
```

After the restructure, `container.firstElementChild` is the new outer `Stack` — which is a column
at **every** width, because that is what a Chakra `Stack` is. So the assertion would have kept
passing while no longer testing anything: it would have been green whether the title row stacked
or not.

A test guarding a bug fix that silently stops guarding it is worse than a failing test. It now
locates the row through the heading:

```ts
const titleRow = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!;
expect(window.getComputedStyle(titleRow).flexDirection).toBe("column");
```

Same intent, and now actually asserting it. `firstElementChild` was always a brittle way to find
that row; the restructure just exposed it.

### 3.4 `Parents.ts` derives labels from `NAV_ITEMS`

`{ href: "/transactions", label: "Activity" }` is needed in eight places. Written out eight times
it would drift, and the specific drift is the one thing a back link must not do: **give a screen a
different name from the one the tab bar gives it.** A user who taps "Activity" and lands on a page
offering "‹ TRANSACTIONS" has been shown two names for one destination.

So `navParent()` looks the href up in `NAV_ITEMS` and **throws** if it is not there. A renamed
route becomes a build-time error instead of a back link pointing at a 404.

`/settlements` is the one parent written out by hand, because it is deliberately not a nav
destination (group 42 section 3.2). That exception is commented where it lives.

Record-level parents are functions rather than constants, because their label is the record's
name — `accountParent(id, name)`. An edit form's parent is the **record**, not the section list:
the change would have been visible on the record, so that is where abandoning it should land.

---

## 4. Business rules enforced

None directly. One preserved: `PageHeader`'s `meta` slot stays separate from `action`, so the
dashboard's render timestamp cannot be mistaken for a control. That separation exists because
"every number is computed, never cached" (`docs/01-MVP-SCOPE.md` section 4) and a timestamp
sitting where a button goes reads like a refresh button — implying the figures were stale until
pressed.

A test asserts `meta` still lands in the title row with a `parent` present, precisely because 3.1
is about baseline alignment in that row.

---

## 5. How it was verified

```text
npx vitest run --project ui tests/ui/shell.test.tsx     25 passed  (was 19 + 6 new)
```

The five new assertions:

| Assertion | What it prevents |
| --- | --- |
| no link at all when `parent` is absent | a stray or default back link on the five nav destinations |
| the link carries the given `href` | wiring that renders but goes nowhere |
| the link precedes the `h1` in document order | a back link announced after the page's own name |
| the link is inside the `<header>` element | it drifting out of the header landmark into stray content |
| `meta` is in the title row and the link is **not** | the baseline regression in 3.1 being reintroduced by flattening the structure |

That last one is the guard for this group's one real risk. It asserts *structure* rather than
computed position, because jsdom evaluates no media queries and cannot report a baseline — which
is also why the geometry claim in 3.1 is a browser measurement and is recorded as such rather than
being pinned in a unit test.

The mobile title measurement itself is in group 48, taken from the recaptured screenshots at
393/402px.

---

## 6. Known gaps

- **The 20px baseline figure in 3.1 is from measuring the broken arrangement before rejecting
  it**, not from an automated check. It is not re-measured on every run, and it does not need to
  be — the test in 5 asserts the structure that makes it impossible.
- **Two `(app)` screens still have no `PageHeader`** and therefore cannot take a `parent`:
  `(app)/not-found.tsx` and `(app)/error.tsx`. Both already carry a named escape and both are
  marked OK in the audit, so this is by design rather than a gap to close.
- **No `parent` is wired anywhere yet.** Groups 45-47 do that; after this group the prop exists
  and nothing passes it.

---

## 7. Notes for the next group

Groups 45, 46 and 47 are all applications of this prop. Use `PARENTS` and the three
`*Parent()` helpers rather than object literals — that is what keeps the labels agreeing with the
navigation, and `navParent` will throw if a route is renamed out from under it.

Three files are touched by more than one of the next three groups: `ExpenseDetail` (parent in 45,
linked rows in 47), `TransferDetail` and `CardPaymentDetail` (same), and
`/transactions/[id]/edit` (parent in 46, the "Cannot edit" rebuild in 47). Coordinate if those
groups are run on separate branches.
