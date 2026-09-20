# Implementation Updates

One document per task group from `13-MVP-TASK-GROUP.md`, written for a developer
who did not do the work.

Each document records what was built, which files it touched, the decisions taken
and rejected, the business rules it enforces, how it was verified, and what was
deliberately left for later.

## Index

| Group | Document | Status |
| --- | --- | --- |
| 1 | [Project Foundation](GROUP-01-PROJECT-FOUNDATION.md) | Complete |
| 2 | [Authentication](GROUP-02-AUTHENTICATION.md) | Complete |
| 3 | [Database Foundation](GROUP-03-DATABASE-FOUNDATION.md) | Complete |
| 4 | [Account Management](GROUP-04-ACCOUNT-MANAGEMENT.md) | Complete |
| — | [Chakra UI Migration](CHAKRA-UI-MIGRATION.md) | Complete |
| 5 | [People Management](GROUP-05-PEOPLE-MANAGEMENT.md) | Complete |
| 6 | [Category Management](GROUP-06-CATEGORY-MANAGEMENT.md) | Complete |
| 7 | [Personal Expense](GROUP-07-PERSONAL-EXPENSE.md) | Complete |
| 8 | [Shared Expense](GROUP-08-SHARED-EXPENSE.md) | Complete |
| 9 | [Settlement](GROUP-09-SETTLEMENT.md) | Complete |
| 10 | [Transfers](GROUP-10-TRANSFERS.md) | Complete |
| 11 | [Credit Card Payments](GROUP-11-CREDIT-CARD-PAYMENTS.md) | Complete |
| 12 | [Dashboard](GROUP-12-DASHBOARD.md) | Complete |
| 13 | [Transaction History](GROUP-13-TRANSACTION-HISTORY.md) | Complete |
| 14 | [Offline Storage](GROUP-14-OFFLINE-STORAGE.md) | Complete |
| 15 | [Offline Sync](GROUP-15-OFFLINE-SYNC.md) | Complete |
| 16 | [PWA](GROUP-16-PWA.md) | Complete |
| 17 | [Security](GROUP-17-SECURITY.md) | Complete (dev/staging scope) |
| 18 | [Error Handling](GROUP-18-ERROR-HANDLING.md) | Complete |
| 19 | Testing | Not started |
| 20 | Final MVP Hardening | Not started |

## Reading order for a new developer

Start with the architecture documents in the parent folder, then read these in
group order. The financial model is cumulative: person balances (group 5) only make
sense after the split and settlement records they are derived from (groups 3, 8, 9).

## Current state at a glance

```text
Working end to end   authentication, accounts, people, categories,
                     personal and shared expenses, settlements, transfers,
                     credit-card payments, derived account and person balances,
                     dashboard, transaction history with filters and paging
Domain complete      money arithmetic, split allocation, account balances,
                     card outstanding and available credit, person balances,
                     settlement allocation, spending classification,
                     transfer and card-payment rules
Offline working      IndexedDB store, durable queue, push/pull sync engine
                     with backoff and conflict detection, offline creation
                     of personal expenses
Installable PWA      manifest, generated icon set, hand-written service
                     worker (shell caching, API never cached), /offline
                     fallback, install prompt, background update flow
Not yet built        offline read path for lists, conflict resolution UI,
                     security and error-handling hardening, authenticated
                     E2E journeys
```
