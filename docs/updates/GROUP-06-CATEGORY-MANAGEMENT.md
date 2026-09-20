# Group 6 - Category Management

## 1. What was built

Categories for classifying expenses, with one level of nesting, plus a starting set
created automatically when a user registers.

Three things here are worth a reviewer's attention:

- **Registration is now transactional.** The user row and their default categories are
  written together, so a partial failure cannot leave an account with no categories.
- **A create is idempotency-checked before it is validated.** This fixed a real bug
  found by the tests: a retried offline create was being rejected for clashing with the
  category it had itself already created.
- **Archiving a parent cascades to its children**, and restoring a child whose parent
  is still archived promotes it to the top level.

Delivered: default categories on sign-up, list as flat and tree, add, rename, move,
archive with cascade, restore with promotion, and a reusable `CategoryPicker` for the
expense forms in groups 7 and 8.

## 2. Files added or changed

### Domain — `src/domain/categories/`

`rules.ts` (new):

```ts
assertCategoryUsable(category, purpose?)      // rejects archived
assertCategoryKind(category, expectedKind)    // expense vs income
assertValidParent(parent, expectedKind)       // one level, active, same kind
assertNotSelfParent(categoryId, parentId)
assertCanBecomeChild(hasChildren, name)
assertNameAvailable(name, siblings, excludeId?)
siblingsOf(categories, parentId)
```

`entities.ts` was already present; `entities.test.ts` and `rules.test.ts` are new.

### Server — `src/server/services/categories/`

- `default-categories.ts` — `createDefaultCategories(userId, { session?, categories? })`.
- `category-service.ts` — `createCategory()`, `updateCategory()`, `archiveCategory()`,
  `restoreCategory()`, `listCategories()`, `getCategory()`, and
  **`resolveOwnedCategory()`** for groups 7 and 8 to validate a category reference.

### Changed — `src/server/services/users/register-user.ts`

Now wraps the user insert and the category seed in `withTransaction()`, and takes
`categories` in its dependencies. Password hashing stays outside the transaction.

### API

`api/categories/route.ts` (GET, POST), `api/categories/[id]/route.ts` (GET, PATCH,
DELETE = archive), `api/categories/[id]/restore/route.ts` (POST).

### Feature — `src/features/categories/`

- `schemas/category-schemas.ts` — `createCategorySchema`, `updateCategorySchema`,
  `listCategoriesQuerySchema`, `categoryIdParamSchema`.
- `view-models/category-view-model.ts` — `CategoryView`, `CategoryTreeView`,
  `CategoryOption`, `toCategoryView(s)`, `toCategoryTreeView`, `toCategoryOptions`,
  `toParentOptions`.
- `queries/category-queries.ts` — `getCategoryTreeView`, `getCategoryListView`,
  `getCategoryOptions`, `getParentCategoryOptions`.
- `actions/category-actions.ts` — `createCategoryAction`, `updateCategoryAction`,
  `archiveCategoryAction`, `restoreCategoryAction`.
- `components/` — `CategoryManager` (the whole management surface),
  `CategoryForm`, **`CategoryPicker`** (used by the expense forms).

### Pages and navigation

`app/(app)/categories/page.tsx`. `AppShell` and `BottomNav` gained a Categories link.

## 3. Key decisions

### Idempotency is checked before validation

The original order was: validate name uniqueness, then insert (where the repository
handles a duplicate `clientId`). An integration test exposed the flaw — a retried
create with the same `clientId` was rejected with "You already have a category called
Subscriptions", because the first attempt had created it.

`createCategory()` now calls `findByClientId()` first and returns the existing record
before running any rule. `08-OFFLINE-SYNC.md` section 18 requires a retry to be
harmless, and a validation rule that only fires on the retry breaks that.

Worth noting for later groups: this only bites where a uniqueness rule exists.
`createAccount` and `createPerson` have no such rule, so the repository-level check is
sufficient for them. **Any create service that adds a uniqueness rule must check
`clientId` first.**

### Registration is transactional

`registerUser()` writes the user and the default categories in one
`withTransaction()`. Without it, a failure between the two leaves an account with no
categories, and there is no repair path — the seed only runs at registration.

Password hashing stays outside the transaction. bcrypt at cost 12 takes long enough
that holding a transaction open across it would waste a database session for no
benefit.

### Default categories carry no "system" flag

The nine defaults (`DEFAULT_CATEGORIES` in `config/constants.ts`) are ordinary
user-owned rows. The user can rename or archive any of them, and a test asserts that.

Marking them protected was considered and rejected: it would be a limitation with no
purpose. "Rent" is meaningless to someone who owns their home, and the app has no
business insisting they keep it.

Their `clientId` values are server-generated, since they are not the result of a client
operation and there is no client id to reuse.

### One level of nesting, enforced three ways

`01-MVP-SCOPE.md` section 5 asks for parent/child categories. Arbitrary depth was
rejected: every spending rollup would need a recursive walk and the picker would need a
tree control, for no requested benefit.

Three separate rules keep the depth at one:

- `assertValidParent` — the chosen parent must not itself have a parent.
- `assertNotSelfParent` — a category cannot parent itself.
- `assertCanBecomeChild` — a category with children cannot become a child, since its
  children would silently end up two levels deep.

The third is the one that is easy to miss.

### Duplicate names are rejected among siblings only

Two top-level categories called "Food" are indistinguishable in a picker. But
"Trips › Taxi" and "Commute › Taxi" are meaningfully different, so the check is scoped
to categories sharing a parent.

Comparison is case-insensitive and whitespace-normalised, so "food", "Food", and
"  FOOD  " all collide.

**Archived siblings are included in the check.** Allowing an archived name to be reused
would produce two identically named categories the moment the old one is restored.

### Archiving a parent archives its children

Leaving a child selectable while its parent is hidden produces a picker entry belonging
to a group the user cannot see. The response reports `archivedChildren` so the UI can
say what happened.

### Restoring a child promotes it if its parent is still archived

The mirror of the above. `restoreCategory()` checks the parent and clears `parentId`
when the parent is missing or archived, rather than restoring the child into a hidden
group.

### `kind` is immutable

An expense category may already classify expenses. Flipping it to income would misfile
every one of them. `updateCategorySchema` omits the field.

### The archive response reports the transaction count

`transactionCount` tells the user their history is intact rather than leaving them to
wonder whether archiving destroyed the classification.

### `buildCategoryTree` promotes orphans rather than dropping them

If a parent is absent from the list (archived, so filtered out), its children would
otherwise vanish. They are promoted to the top level instead. Losing a category from
the picker is worse than showing it ungrouped, and a unit test asserts the total count
is preserved.

### The picker indents with spaces, not `<optgroup>`

A parent category is itself selectable, and `optgroup` labels are not. Children are
indented with non-breaking spaces inside a flat `<select>`. `CategoryOption` also
carries a qualified `label` ("Food › Restaurants") for anywhere the bare name would be
ambiguous.

### Icons are validated as names, not free text

`icon` must match `^[a-z0-9-]*$`. It is rendered into the UI, so restricting it to a
short identifier removes the question of whether it needs escaping. A test asserts
`<script>` is rejected.

### Category management is inline, not a separate page per category

Categories are small records and users usually adjust several at once. `CategoryManager`
edits in place; a page navigation per rename would be tedious.

## 4. Business rules enforced

```text
A new user starts with a usable set of expense categories
The user row and the default categories are created atomically
Default categories are editable and archivable like any other
A retried create with the same clientId returns the original record
Category names are whitespace-normalised; an empty name is rejected
Sibling names must be unique, case-insensitively, including archived siblings
The same name is allowed under different parents
Nesting is exactly one level deep
A category cannot be its own parent
A category with children cannot become a child
A parent must be active and of the same kind
kind cannot be changed after creation
An archived category cannot be edited or applied to a new transaction
Archiving a parent archives its children
Restoring a child whose parent is archived promotes it to the top level
Categories are archived, never deleted; classified transactions keep their reference
An icon must be a lowercase identifier, not markup
Every category reference is verified to belong to the requesting user
```

## 5. How it was verified

```text
npx tsc --noEmit                       clean
npx eslint .                           clean
npx prettier --check .                 clean
npx vitest run                         325 tests across unit, integration, ui
npx next build                         succeeds
```

### Unit tests

`domain/categories/entities.test.ts` — tree grouping, name sorting, orphan promotion,
and that every category appears exactly once.

`domain/categories/rules.test.ts` — each nesting rule, case-insensitive duplicate
detection, and that renaming a category to its own name is allowed (the
`excludeCategoryId` path).

`features/categories/view-models/category-view-model.test.ts` — child ordering
directly after its parent, qualified labels, parents staying selectable.

### Integration tests

`tests/integration/categories.test.ts` (39 tests). Notable cases:

- The nine defaults exist after registration, all top-level expense categories with
  icons, and are per-user rather than shared.
- A duplicate name is rejected; the same child name under two parents is accepted.
- Reusing an *archived* sibling's name is rejected.
- Nesting a third level is rejected; an archived parent is rejected; another user's
  category as a parent reports "not found".
- Archiving a parent archives its child and reports `archivedChildren: 1`.
- Archiving a category with a classified transaction reports `transactionCount: 1` and
  the transaction survives.
- Restoring a child while its parent stays archived returns `parentId: null`.
- Cross-user isolation on read, update, archive, and get.

### Changed existing tests

Two assertions in `tests/integration/database-foundation.test.ts` assumed a new user
had zero categories. They now measure relative to the seeded baseline, and a new case
asserts the default count directly. The category names used in those tests were
changed to avoid colliding with the defaults.

## 6. Known gaps

- **Income categories are not reachable from the UI.** The `kind` field, the schema, and
  the rules all support them, and `getCategoryOptions(userId, "income")` works, but the
  management page is hard-coded to `expense` because no task group builds an income
  flow.
- **No icon picker.** The field is stored, validated, and returned, but nothing renders
  it and the form does not offer a choice. The defaults ship with icon names ready for
  when one is added.
- **`CategoryPicker` is not yet used.** It is written and typed for groups 7 and 8.
- No spending-by-category rollup. That belongs to the dashboard in group 12, which will
  need to decide whether a parent's total includes its children.
- No merge or reassign. Archiving a category leaves its transactions classified under
  it; there is no way to move them elsewhere. Not in MVP scope.
- No reordering; categories sort alphabetically.

## 7. Notes for the next group

Group 7 (Personal Expense) needs:

- **`resolveOwnedCategory(userId, categoryId, "expense")`** to validate the reference.
  It returns `null` when no category is given — a category is optional on an expense —
  and otherwise verifies ownership, that it is not archived, and that the kind matches.
- **`getCategoryOptions(userId)`** for the form, and **`CategoryPicker`** to render it.
  The picker defaults to allowing "No category"; pass `required` to force a choice.
- The expense form should use `AmountInput` from `components/ui/Field` so amounts get a
  numeric keypad and tabular figures.

Also relevant:

- `createTestUser()` now produces a user with nine categories. Any test asserting a
  category count must account for that; prefer relative assertions.
- If a future create service adds a uniqueness rule, check `findByClientId` before
  validating, as `createCategory` does.
