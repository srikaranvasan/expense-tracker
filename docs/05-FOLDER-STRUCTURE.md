# Expense Tracker MVP - Folder Structure

## 1. Goal

Use a scalable modular-monolith structure inside a single Next.js application.

The structure must provide clear separation between:

- UI
- Feature/application logic
- Domain/business rules
- Server-side infrastructure
- Database
- Offline storage
- Synchronization
- Shared utilities

The project should be easy to expand without turning into a large collection of unrelated files.

---

# 2. Technology

Use:

- Next.js
- React
- TypeScript
- MongoDB
- IndexedDB
- Zod
- A decimal/money library
- An authentication library rather than custom authentication
- Chakra UI for styling and UI primitives

Use Next.js App Router.

Chakra UI is the single styling system.

Do not introduce a second styling approach (utility-class frameworks, CSS
modules, or ad-hoc stylesheets) alongside it. One system means one place to
change spacing, colour, and typography.

---

# 3. Recommended Structure

```text
src/
│
├── app/
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (app)/
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── people/
│   │   ├── categories/
│   │   └── settings/
│   │
│   ├── api/
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── people/
│   │   ├── categories/
│   │   ├── settlements/
│   │   └── sync/
│   │
│   ├── layout.tsx
│   ├── providers.tsx
│   └── globals.css
│
├── theme/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── layout/
│   └── feedback/
│
├── features/
│   │
│   ├── transactions/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   ├── actions/
│   │   ├── queries/
│   │   └── view-models/
│   │
│   ├── accounts/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   ├── actions/
│   │   ├── queries/
│   │   └── view-models/
│   │
│   ├── people/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   ├── actions/
│   │   ├── queries/
│   │   └── view-models/
│   │
│   ├── settlements/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   ├── actions/
│   │   ├── queries/
│   │   └── view-models/
│   │
│   └── dashboard/
│       ├── components/
│       ├── queries/
│       └── view-models/
│
├── domain/
│   │
│   ├── transactions/
│   │   ├── entities.ts
│   │   ├── rules.ts
│   │   ├── calculations.ts
│   │   ├── validators.ts
│   │   └── errors.ts
│   │
│   ├── accounts/
│   │   ├── entities.ts
│   │   ├── rules.ts
│   │   ├── calculations.ts
│   │   └── errors.ts
│   │
│   ├── settlements/
│   │   ├── entities.ts
│   │   ├── rules.ts
│   │   ├── calculations.ts
│   │   ├── validators.ts
│   │   └── errors.ts
│   │
│   ├── people/
│   │   ├── entities.ts
│   │   └── rules.ts
│   │
│   └── categories/
│       ├── entities.ts
│       └── rules.ts
│
├── server/
│   │
│   ├── db/
│   │   ├── client.ts
│   │   ├── indexes.ts
│   │   └── models/
│   │
│   ├── repositories/
│   │   ├── interfaces/
│   │   │   ├── transaction-repository.ts
│   │   │   ├── account-repository.ts
│   │   │   ├── person-repository.ts
│   │   │   ├── settlement-repository.ts
│   │   │   └── category-repository.ts
│   │   │
│   │   └── mongo/
│   │       ├── transaction-repository.ts
│   │       ├── account-repository.ts
│   │       ├── person-repository.ts
│   │       ├── settlement-repository.ts
│   │       └── category-repository.ts
│   │
│   ├── services/
│   │   ├── transactions/
│   │   ├── settlements/
│   │   ├── accounts/
│   │   └── sync/
│   │
│   ├── auth/
│   │   ├── session.ts
│   │   └── authorization.ts
│   │
│   └── errors/
│       └── api-error.ts
│
├── offline/
│   │
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   └── migrations/
│   │
│   ├── repositories/
│   │   ├── transaction-repository.ts
│   │   ├── account-repository.ts
│   │   ├── person-repository.ts
│   │   └── settlement-repository.ts
│   │
│   └── sync/
│       ├── sync-engine.ts
│       ├── sync-queue.ts
│       ├── push.ts
│       ├── pull.ts
│       ├── conflict-handler.ts
│       └── sync-status.ts
│
├── lib/
│   │
│   ├── money/
│   │   ├── money.ts
│   │   ├── arithmetic.ts
│   │   └── rounding.ts
│   │
│   ├── dates/
│   │   ├── date-utils.ts
│   │   └── timezone.ts
│   │
│   ├── validation/
│   │   └── helpers.ts
│   │
│   ├── errors/
│   │   └── error-utils.ts
│   │
│   └── utils/
│       └── general.ts
│
├── types/
│   ├── api.ts
│   ├── common.ts
│   └── sync.ts
│
└── config/
    ├── env.ts
    └── constants.ts
````

---

# 4. `app/`

The `app` directory is responsible for:

* Routing
* Layouts
* Pages
* Route handlers
* Metadata
* Loading states
* Error boundaries

It should not contain complex business logic.

Example:

```text
app/(app)/transactions/page.tsx
```

should compose the transaction page.

It should not contain code that calculates:

```text
who owes whom
```

That belongs in the domain/application layer.

---

# 5. `components/`

Contains reusable UI components.

Example:

```text
components/ui/Button.tsx
components/ui/Dialog.tsx
components/ui/Input.tsx
components/ui/Select.tsx
```

Chakra UI supplies the primitives. `components/ui/` holds the thin project
wrappers over them.

Wrap a Chakra component when the project needs a consistent default that should
not be repeated at every call site:

```text
components/ui/Button.tsx
  → Chakra Button with the project's default size and variant

components/ui/Field.tsx
  → Chakra Field wired to label, hint, and error text
```

Use the Chakra component directly when no project-specific default is needed:

```text
Stack, Box, Flex, Grid, Text, Heading, Badge, Separator
```

Do not wrap a Chakra component just to rename it. A wrapper needs a reason:
a default, a constraint, or an accessibility guarantee.

These components should be generic.

Avoid putting accounting rules into generic components.

Bad:

```text
Button.tsx
  → calculateSettlement()
```

Good:

```text
Button
  → triggers action
```

## Theme

The Chakra theme lives in `theme/`.

```text
theme/index.ts      → the exported theme system
theme/tokens.ts     → colour, spacing, radius, and font tokens
theme/semantic.ts   → semantic tokens (surface, content, positive, negative)
```

Design decisions belong in the theme, not in component props.

Bad:

```text
<Text color="#16a34a">   → a raw colour at the call site
```

Good:

```text
<Text color="positive">  → a semantic token defined once
```

Financial UI needs a small, deliberate set of semantic tokens, because the same
meanings recur everywhere:

```text
positive   money coming in, or a person owing the user
negative   money going out, or the user owing a person
warning    over a credit limit, or an unsettled balance
muted      secondary and supporting text
```

Colour must never be the only signal. Pair every token with a text label so the
meaning survives for colour-blind users and screen readers.

## Providers

`app/providers.tsx` holds the Chakra provider and any other client-side
providers.

It is a Client Component. `app/layout.tsx` stays a Server Component and renders
the provider around `children`, so making the UI themeable does not force the
whole tree onto the client.

---

# 6. `features/`

Features contain application-specific UI and orchestration.

Example:

```text
features/transactions/
```

can contain:

```text
components/
hooks/
schemas/
actions/
queries/
view-models/
```

This is where transaction-specific frontend behavior belongs.

Example:

```text
features/transactions/components/ExpenseForm.tsx
features/transactions/schemas/expense-schema.ts
features/transactions/actions/create-expense.ts
```

The feature layer can call application/domain logic but should not directly implement database queries.

---

# 7. `domain/`

This is the most important architectural boundary.

The domain contains the application's financial rules.

Examples:

```text
domain/transactions/calculations.ts
domain/settlements/calculations.ts
domain/accounts/calculations.ts
```

Examples of domain functions:

```text
calculateEqualSplit()
calculateCustomSplit()
calculatePercentageSplit()
validateSplitTotal()
calculateRemainingSplitAmount()
calculatePersonBalance()
calculateAccountBalance()
calculateCreditCardOutstanding()
validateSettlementAllocation()
```

Domain code must not import:

* React
* Next.js
* MongoDB
* IndexedDB
* browser APIs
* HTTP clients

The domain should be independently testable.

---

# 8. `server/`

Everything inside `server/` is server-only.

Responsibilities:

* MongoDB
* Authentication
* Authorization
* Repository implementations
* Server services
* Server-specific error handling

Never import server-only modules into client components.

---

# 9. Repository Pattern

Define interfaces:

```text
server/repositories/interfaces/
```

Example:

```ts
interface TransactionRepository {
  create(input: CreateTransactionInput): Promise<Transaction>

  getById(
    userId: string,
    transactionId: string
  ): Promise<Transaction | null>

  list(
    userId: string,
    query: TransactionQuery
  ): Promise<Transaction[]>

  update(
    userId: string,
    transactionId: string,
    input: UpdateTransactionInput
  ): Promise<Transaction>

  softDelete(
    userId: string,
    transactionId: string
  ): Promise<void>
}
```

MongoDB implementation:

```text
server/repositories/mongo/transaction-repository.ts
```

This means domain/application code does not depend directly on MongoDB.

---

# 10. Services / Use Cases

Business workflows should be represented by explicit application services/use cases.

Examples:

```text
CreateExpense
CreateSharedExpense
CreateSettlement
CreateTransfer
PayCreditCard
GetPersonBalance
GetDashboard
```

Example:

```text
CreateSharedExpense
       ↓
Validate request
       ↓
Validate accounts/people
       ↓
Calculate splits
       ↓
Validate split total
       ↓
Create transaction
       ↓
Create expense splits
       ↓
Persist atomically
```

Do not put this entire workflow inside a route handler.

---

# 11. API Route Handlers

Route handlers should be thin.

Example:

```text
app/api/transactions/route.ts
```

Responsibilities:

```text
Receive request
 ↓
Authenticate
 ↓
Parse/validate request
 ↓
Call use case
 ↓
Return response
```

Not:

```text
Receive request
 ↓
Authenticate
 ↓
Query MongoDB
 ↓
Calculate splits
 ↓
Calculate balances
 ↓
Update collections
 ↓
Handle transactions
 ↓
Build response
```

That becomes unmaintainable very quickly.

---

# 12. Offline Layer

`offline/` owns IndexedDB and client synchronization.

Responsibilities:

* Local persistence
* Local repositories
* Sync queue
* Push
* Pull
* Conflict handling
* Sync status

The UI should not directly interact with IndexedDB.

Bad:

```text
React Component
 ↓
indexedDB.open(...)
```

Good:

```text
React Component
 ↓
Feature action
 ↓
Offline repository
 ↓
IndexedDB
```

---

# 13. Shared Domain Logic

If a calculation is needed on both client and server, keep it in the domain layer.

Example:

```text
domain/transactions/calculations.ts
```

can be used by:

```text
Client
Server
Tests
```

This prevents:

```text
Client calculation ≠ Server calculation
```

which is particularly dangerous for financial data.

---

# 14. `lib/money`

All money calculations should go through:

```text
lib/money/
```

Examples:

```text
addMoney()
subtractMoney()
multiplyMoney()
divideMoney()
percentageOf()
roundMoney()
compareMoney()
```

Do not scatter decimal arithmetic throughout the application.

Bad:

```ts
amount * 0.33
```

Good:

```ts
moneyPercentage(amount, percentage)
```

Use a decimal-safe implementation.

---

# 15. Schemas

Use Zod or an equivalent runtime validation library.

Example:

```text
features/transactions/schemas/expense-schema.ts
```

Schemas validate:

* required fields
* field types
* basic constraints
* enum values

Domain rules remain in the domain layer.

Do not assume schema validation replaces domain validation.

---

# 16. View Models

Do not expose database documents directly to the UI.

Convert domain/database data into UI-specific view models.

Example:

```text
Transaction database record
        ↓
Transaction View Model
        ↓
TransactionCard
```

Example view model:

```ts
type TransactionListItem = {
  id: string
  title: string
  formattedAmount: string
  categoryName: string
  accountName: string
  dateLabel: string
  typeLabel: string
}
```

This keeps presentation logic away from database structures.

---

# 17. Client vs Server Components

Use React Server Components by default where appropriate.

Use Client Components only when needed for:

* user interaction
* local state
* browser APIs
* IndexedDB
* offline functionality
* Chakra UI components that carry their own state or context

Chakra's layout and typography primitives render fine on the server. Only
interactive components (dialogs, menus, popovers, toasts, anything using a Chakra
hook) need `"use client"`.

Do not add `"use client"` to a whole page just to use `Box` or `Text`.

Examples that likely require client components:

```text
ExpenseForm
SplitEditor
SettlementSelector
QuickAdd
OfflineSyncIndicator
```

Static pages and data composition can remain server-side where appropriate.

---

# 18. Dependency Direction

Preferred dependency direction:

```text
┌───────────────┐
│      app      │
└───────┬───────┘
        ↓
┌───────────────┐
│   features    │
└───────┬───────┘
        ↓
┌───────────────┐
│    domain     │
└───────┬───────┘
        ↓
┌───────────────┐
│  interfaces   │
└───────────────┘

Infrastructure implementations:

MongoDB ───────→ repository interfaces
IndexedDB ──────→ repository interfaces
```

The domain must not depend on infrastructure.

---

# 19. Forbidden Dependencies

Avoid these:

```text
domain → MongoDB
domain → Next.js
domain → React
domain → IndexedDB

UI → MongoDB
UI → database models

components/ui → business logic

domain → Chakra UI
server → Chakra UI
lib → Chakra UI
```

Styling is a presentation concern. A domain or server module that imports a UI
library has taken on a responsibility that does not belong to it.

The architecture should make these dependencies difficult rather than merely asking developers not to do them.

---

# 20. Feature Boundaries

A feature should own its feature-specific code.

For example:

```text
features/settlements/
```

owns:

* settlement UI
* settlement forms
* settlement queries
* settlement actions
* settlement view models

But financial rules such as:

```text
validateSettlementAllocation()
```

belong in:

```text
domain/settlements/
```

---

# 21. Database Model Location

MongoDB-specific models/schema definitions belong under:

```text
server/db/models/
```

Do not import MongoDB model definitions into client code.

The UI should work with domain/view types instead.

---

# 22. API Types

Shared API request/response types can live under:

```text
types/api.ts
```

Do not make the database document type the API contract.

The API contract should be intentionally designed.

---

# 23. Tests

Keep tests close to the code when practical.

Example:

```text
domain/settlements/
├── calculations.ts
├── rules.ts
├── errors.ts
└── calculations.test.ts
```

Integration tests:

```text
tests/integration/
```

End-to-end tests:

```text
tests/e2e/
```

At minimum test all financial calculations independently.

---

# 24. Naming Conventions

Use:

```text
kebab-case
```

for filenames where practical.

Examples:

```text
expense-form.tsx
transaction-repository.ts
calculate-balance.ts
```

Use PascalCase for React components:

```text
ExpenseForm.tsx
TransactionCard.tsx
SettlementDialog.tsx
```

Use descriptive names.

Avoid:

```text
utils.ts
helpers.ts
misc.ts
common.ts
```

unless the file truly represents generic reusable functionality.

---

# 25. Avoid Giant Files

Do not create files containing:

* multiple unrelated features
* hundreds of lines of business logic
* all API handlers
* all database operations
* all domain calculations

Split code based on responsibility.

---

# 26. Avoid Premature Abstraction

Do not create:

```text
GenericFinancialService
UniversalRepository
BaseEverythingService
```

just because abstraction sounds architectural.

Create an abstraction when there is a real boundary or multiple implementations.

The architecture should be expandable, not ceremonially complicated.

---

# 27. Environment Configuration

Centralize environment access:

```text
config/env.ts
```

Do not scatter:

```ts
process.env.MONGODB_URI
```

throughout the application.

Validate required environment variables during application startup/build where appropriate.

Never expose server secrets to the client.

---

# 28. Folder Growth Rule

When a feature grows significantly, keep its UI/application code inside its feature directory.

Example:

```text
features/transactions/
```

can grow into:

```text
features/transactions/
├── components/
│   ├── expense-form/
│   ├── transaction-list/
│   ├── transaction-details/
│   └── split-editor/
│
├── actions/
├── queries/
├── schemas/
├── hooks/
└── view-models/
```

Do not flatten everything into one directory.

---

# 29. Architecture Rule

When deciding where new code belongs, ask:

### Is it UI?

→ `components/` or `features/*/components/`

### Is it a visual design decision?

→ `theme/` as a token, not a prop at the call site

### Is it a user workflow?

→ `features/*/actions/` or application service

### Is it a financial/business rule?

→ `domain/`

### Is it MongoDB-specific?

→ `server/`

### Is it IndexedDB/synchronization-specific?

→ `offline/`

### Is it generic infrastructure?

→ `lib/`

### Is it routing?

→ `app/`

This rule should be followed consistently.

---

# 30. Final Principle

The project should remain a:

```text
Modular Monolith
```

not a collection of unrelated Next.js files.

The desired architecture is:

```text
             Next.js
                │
       ┌────────┴────────┐
       │                 │
   Frontend           Backend
       │                 │
   Features          Use Cases
       │                 │
       └───────┬─────────┘
               ↓
            Domain
               ↓
      ┌────────┴────────┐
      ↓                 ↓
  MongoDB            IndexedDB
                         │
                         ↓
                     Sync Engine
```

The architecture must allow future features such as:

* recurring transactions
* budgets
* OCR
* automatic categorization
* bank integrations
* advanced analytics

to be added without rewriting the existing expense, split, settlement, and account domains.
