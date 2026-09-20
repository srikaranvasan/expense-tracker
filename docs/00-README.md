# Expense Tracker MVP - Architecture Documentation

## Purpose

This folder defines the architecture, product scope, data model, user flows, project structure, engineering standards, and implementation rules for the Expense Tracker MVP.

The application is a personal finance and shared-expense tracker built as a single Next.js application.

- Frontend: Next.js + React + TypeScript
- UI styling: Chakra UI (component library and theme)
- Backend: Next.js server-side capabilities and Route Handlers
- Database: MongoDB
- Client offline storage: IndexedDB
- Deployment: Decided later
- Primary clients: iPhone PWA and desktop web

## Documents

1. `01-MVP-SCOPE.md` - MVP features and boundaries
2. `02-DATA-MODEL.md` - MongoDB collections and invariants
3. `03-DATA-FLOW.md` - Read/write/synchronization flows
4. `04-USER-FLOWS.md` - UX and acceptance flows
5. `05-FOLDER-STRUCTURE.md` - Scalable project organization
6. `06-CODING-PRACTICES.md` - Engineering standards and separation of concerns
7. `07-API-CONTRACTS.md` - Backend/API conventions
8. `08-OFFLINE-SYNC.md` - Offline-first and synchronization rules
9. `09-SECURITY.md` - Security and data isolation
10. `10-IMPLEMENTATION-PLAN.md` - Recommended build sequence

## Architecture Principle

Build the MVP as a modular monolith.

Keep frontend, backend, domain logic, persistence, and synchronization clearly separated inside one repository.

Do not prematurely split the application into microservices.

## Source of Truth

For synchronized data:

- MongoDB is the server source of truth.
- IndexedDB is the client local store.
- UI reads primarily from the local store for fast interaction.
- Server synchronization reconciles local changes with MongoDB.

## Non-Negotiable Accounting Principle

Do not confuse:

- Expense
- Expense split/share
- Settlement
- Settlement allocation
- Transfer
- Credit-card payment

They represent different business events and must remain separate.

## Core Domain Concepts

### Expense

Represents a purchase or financial expense.

### Expense Split

Represents how an expense is divided among participants.

### Settlement

Represents actual money transferred between people to clear an existing shared-expense balance.

### Settlement Allocation

Links a settlement to one or more specific expense splits.

This allows specific and partial settlements.

### Transfer

Represents money moving between the user's own accounts.

A transfer is not an expense.

### Credit-Card Payment

Represents payment from a user's bank/cash account toward a credit-card account.

A credit-card payment is not a new expense.

## Key Accounting Rule

The application must distinguish between:

1. Who paid the bill.
2. Which financial account was used.
3. Who ultimately owes a share.
4. Whether that share has been settled.

For example:

```text
Arun paid ₹900 for:

You      ₹300
Arun     ₹300
Vijay    ₹300
````

The expense records that Arun paid.

The splits record each person's responsibility.

The resulting balance is derived from the splits.

If you later pay Arun ₹300, that is a settlement.

It must not become another expense.

## Design Goal

The application should make expense entry extremely fast while maintaining accurate financial records.

The user should be able to:

* Add a personal expense quickly.
* Add a shared expense quickly.
* Record an expense paid by another person.
* See who owes whom.
* Select specific expense splits for settlement.
* Partially settle a split.
* Track multiple bank accounts.
* Track multiple credit cards.
* Transfer money between accounts.
* Pay credit cards.
* Continue entering expenses while offline.
* Synchronize data when connectivity returns.

## Engineering Philosophy

Prefer:

* Simple architecture
* Strong domain boundaries
* Explicit business rules
* Type safety
* Runtime validation
* Testable domain logic
* Idempotent APIs
* Offline-first writes
* Atomic financial operations
* Secure server-side authorization

Avoid:

* Business logic inside UI components
* Direct database access from client components
* Floating-point monetary calculations
* Storing mutable authoritative balances
* Duplicate implementations of accounting calculations
* Premature microservices
* Over-engineering features outside the MVP
* Hand-rolled CSS or a second styling system alongside Chakra UI
* Hard-coded colours, spacing, and font sizes instead of theme tokens