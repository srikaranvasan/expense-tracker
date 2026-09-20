# Group 15 — Offline Sync

Status: complete.

---

## 1. What was built

The other half of offline support: the engine that drains the local queue, the server
endpoints it talks to, conflict handling, and the first offline write path in the UI.

A user can now record a personal expense with no connection, see it immediately, close
the browser, come back, reconnect, and have it reach the server without doing anything.

* **Server**: `POST /api/sync/push`, `GET /api/sync/pull`, `GET /api/sync/record`.
* **Client engine**: push, pull, backoff, error classification, conflict handling, and a
  status model, all in `src/offline/sync/`.
* **Offline write path**: `queueExpenseOffline()` plus an `ExpenseForm` that saves to the
  device when offline.
* **UI**: `SyncStatusBar` in the shell — invisible when synced, quiet when offline, and
  the only thing that raises its voice is a permanently rejected change.

---

## 2. Files added or changed

### Server — `src/server/services/sync/` (new)

* **`operation-dispatch.ts`** — `dispatchSyncOperation(user, operation)`. Maps a queued
  command onto the service that already implements it. Contains no business logic.
* **`push-service.ts`** — `processSyncPush(user, operations)` → `SyncOperationResult[]`.
* **`pull-service.ts`** — `pullChanges(userId, options)`, `getCanonicalRecord(...)`,
  `encodePullCursor` / `decodePullCursor`.
* **`sync-errors.ts`** — `SyncConflictError`.

### Server — repositories (changed)

* **`account-repository.ts`**, **`person-repository.ts`**,
  **`category-repository.ts`** (mongo + interfaces) — each gained `changesSince()`.
  Transactions, splits, settlements and allocations already had it from group 3; these
  three did not, and the pull endpoint needs all seven.

### API (new)

* `src/app/api/sync/push/route.ts`, `pull/route.ts`, `record/route.ts`.

### Features

* **`src/features/sync/schemas/sync-schemas.ts`** — `syncPushRequestSchema`,
  `syncPullQuerySchema`, `syncOperationTypeSchema`.
* **`src/features/sync/components/SyncStatusBar.tsx`** — status, and the engine's mount
  point.

### Offline — `src/offline/sync/` (new)

* **`backoff.ts`** — `backoffDelayMs`, `nextRetryAt`, `hasExhaustedRetries`,
  `MAX_RETRY_ATTEMPTS`.
* **`error-classification.ts`** — `classifyHttpStatus`, `classifyErrorCode`,
  `classifyOperationFailure`, `classifyTransportFailure`.
* **`sync-status.ts`** — `SyncStatus`, `deriveSyncState`, `describeSyncState`.
* **`push.ts`** — `pushPendingOperations(userId, deps)`, `sendPushRequest`.
* **`pull.ts`** — `pullServerChanges(userId, deps)`, `fetchPullPage`, `primeLinkCaches`.
* **`conflict-handler.ts`** — `toSyncConflict`, `listUnresolvedOperations`,
  `fetchCanonicalRecord`, `resolveConflict`.
* **`sync-engine.ts`** — `SyncEngine`, `syncEngine(userId)`, `stopSyncEngine()`.
* **`writes/queue-expense.ts`** — `queueExpenseOffline(input)`.
* **`hooks/useSyncStatus.ts`**.

### Offline — changed

* **`db/schema.ts`** — `SyncOperationType` is now **re-exported from `@/types/sync`**
  rather than redeclared. See decisions.

### UI (changed)

* **`ExpenseForm.tsx`** — takes `userId`; submits to the offline path when offline.
* **`AppShell.tsx`** — renders `SyncStatusBar`; `user` now carries `id`.
* **`app/(app)/layout.tsx`**, **`transactions/new/page.tsx`**,
  **`transactions/[id]/edit/page.tsx`** — pass `userId`.

### Tests

* **`src/offline/sync/*.test.ts`** — 27 unit tests (backoff, classification, status).
* **`tests/offline/sync-engine.test.ts`** — 25 tests, injected transport.
* **`tests/offline/offline-write.test.ts`** — 17 tests.
* **`tests/integration/sync.test.ts`** — 26 tests against real MongoDB.

---

## 3. Key decisions

### The sync path calls the same services as the REST path

`operation-dispatch.ts` is a `switch` that translates a command into a call on
`createPersonalExpense`, `createSharedExpense`, `createTransfer`, `createSettlement` and
the rest. It validates payloads with the **same Zod schemas the REST routes use**.

A second implementation of "create a shared expense" for offline clients would be a
second set of financial rules to keep in step, and the one that drifted would be the one
nobody was testing. There is an integration test asserting a transfer into a credit card
is rejected *through sync* with the same `INVALID_TRANSFER` code the REST route returns —
not because the sync path checks it, but because it cannot avoid checking it.

### Idempotency is enforced by a unique index, not by a lookup

`syncOperationRepository.claim()` inserts into the ledger and relies on the unique
`(userId, operationId)` index. A check-then-insert would let two devices pushing the same
operation simultaneously both pass the check.

There are **two** layers, and both are tested:

* Same `operationId` → the second push returns `duplicate` with the original entity id.
* Different `operationId`, same `clientId` → still one expense, because every create
  service checks `findByClientId` before validating anything (the pattern established in
  group 6).

The second matters because a client that lost its queue but kept its records would
regenerate operation ids.

### A push batch is independent operations, not a transaction

`POST /api/sync/push` always returns **200 with a result per operation**, even when some
failed. A user who queued eight expenses offline and got one account reference wrong
should have seven of them land. There is a test asserting exactly that: good, bad, good →
`["completed", "failed", "completed"]` and the balance reflects both good ones.

The batch is processed **sequentially**, not concurrently, because the client queues in
dependency order and parallelising would break it.

### Retryable versus permanent is the most consequential judgement in the group

Both mistakes are bad in different ways: retrying a permanent failure forever means a
queue that never drains and a user who is never told; failing a temporary problem
permanently means abandoning a valid expense because the network blinked.

So the rule is explicit in `error-classification.ts` and tested in both directions:

* **Retryable** — 408, 425, 429, 5xx, `SERVICE_UNAVAILABLE`, `RATE_LIMITED`,
  `INTERNAL_ERROR`, and any transport failure.
* **Permanent** — 400, 401, 403, 404, 422, `INVALID_SPLIT_TOTAL`, `OVER_SETTLEMENT`,
  `INVALID_ACCOUNT`, `INVALID_TRANSFER`, `EXPENSE_HAS_SETTLEMENTS`, `VALIDATION_ERROR`.
* **Conflict** — 409 / `SYNC_CONFLICT`, which is neither.

The server's own `retryable` flag wins over the code, because it knows whether it failed
to reach the database or refused the operation.

A **missing** result for an operation is treated as retryable, not as success. Assuming
success from silence could drop the record permanently; a retry is safe because the
operation is idempotent.

### Backoff has jitter, which is the part that is easy to omit

Every device that lost connectivity during an outage reconnects at roughly the same
moment. Without jitter they retry on identical schedules and arrive together, exactly when
the server is least able to absorb it. `backoffDelayMs` applies full jitter — a uniform
draw across `[50%, 100%]` of the exponential window — and there is a test asserting two
clients at the same retry count get different delays.

`MAX_RETRY_ATTEMPTS = 8` exists for the failure that keeps *looking* temporary but never
resolves. From the user's point of view that is broken, and telling them beats an
invisible queue.

### Push before pull, always

Sending local work first means the server has the client's changes before the client asks
what changed. Pulling first would fetch a server state that does not include the user's
own unsent expense, and the pull would then have to be careful not to clobber it — a
problem avoided entirely by ordering. There is a test asserting the call order.

A transport failure during push **skips the pull**: the network is gone, so pulling would
only fail too.

### The pull cursor is `(updatedAt, id)`, and it advances only after a successful write

Ordering by `updatedAt` alone is wrong: several records written in one MongoDB transaction
share a timestamp to the millisecond, so a timestamp-only cursor either replays them or
skips them. The id breaks the tie, and the cursor is base64 so clients treat it as opaque.

On the client, the cursor is stored **after** the changes are committed, and the whole page
is applied in one IndexedDB transaction. If the write fails the cursor stays put and the
client receives the same page again. There is a test asserting a failed pull leaves the
cursor untouched — the alternative is a client that skips changes permanently and holds
stale financial data with no way to notice.

### A pull never overwrites unsynced local edits

`applyOne` skips any record whose local `syncStatus` is `pending` or `failed`. Overwriting
would silently discard what the user typed, which `docs/08-OFFLINE-SYNC.md` section 29
forbids. The queued operation is still there; when it pushes, the server either accepts it
or reports a conflict, and that is where a human decides.

### Deletions travel as a flag, not an absent record

A deleted record arrives with `deleted: true` and **no body**. The client already has the
record and only needs to know it is gone; resending the body invites a client to "restore"
it. Locally the existing fields are kept and only the metadata changes.

### Conflicts are surfaced, never merged

`conflict-handler.ts` offers exactly two resolutions: `keep-server` (discard the queued
operation and let the next pull overwrite) or `keep-local` (re-queue with the server's
current version as the new base). No merge engine, per section 28.

`keep-server` deliberately does **not** delete the local record — the next pull replaces
it, which reaches the same outcome by a route that loses nothing if the pull fails.

### A failed sync never costs the user data

This is the rule the whole group is built around, and it is asserted repeatedly:

* A permanently rejected operation leaves the local record untouched.
* A transport failure leaves the record and re-queues the operation.
* `clearLocalDataForUser` only runs on explicit sign-out, never as error recovery.

### `SyncOperationType` is re-exported, not redeclared

Group 14 declared its own copy of the operation vocabulary, which had already drifted from
`@/types/sync` — mine had `CREATE_CARD_PAYMENT`, the canonical one has
`CREATE_CREDIT_CARD_PAYMENT`. That would have surfaced as a queued command the push
endpoint rejects as unknown, with the user's expense stuck and no obvious reason. Fixed by
re-exporting the canonical type.

### The offline write path was added because the checkbox was otherwise not honest

"Queue offline writes" was ticked while nothing in the UI enqueued anything. The queue
existed; no form used it. So `queueExpenseOffline()` was written and `ExpenseForm` now
routes to it when offline.

It writes the record, its split, and the sync operation in **one IndexedDB transaction**.
The alternative loses money: save the expense, browser dies, operation never queued, and
the user has an expense that can never reach the server with no indication anything is
wrong.

It also validates with the **same domain rules the server uses** before writing anything.
Queueing something the server will certainly reject just moves the error to a moment when
the user is no longer looking at the form. A rejected amount leaves nothing behind — no
record, no doomed operation.

**Offline editing is deliberately not supported.** It needs the queue to collapse a create
and an update, which is deferred. The edit form says so and requires a connection rather
than silently doing something half-handled.

### The sync UI is invisible when there is nothing to say

`SyncStatusBar` renders `null` when synced. Offline shows a quiet grey line; only a
permanent rejection gets colour and a "Try again" button. And offline is phrased as a fact
— "Offline · will sync later" — never as an error, because a user recording expenses on the
underground has nothing to fix (sections 21 and 49).

`deriveSyncState` puts `attention` above everything else, including `offline`, because a
rejected change is the one thing the user must know about.

---

## 4. Business rules enforced

The engine enforces **no financial rules** — section 45 requires that, and it holds: every
rule comes from the service it dispatches to.

| Guarantee | Test |
| --- | --- |
| Same `operationId` never creates two records | `duplicate` returned, balance moved once |
| Same `clientId` with a new `operationId` still creates one | second push returns the first entity id |
| A recorded rejection replays instead of re-running | second push returns `failed`, `retryable: false` |
| One bad operation does not abort the batch | `[completed, failed, completed]`, both good ones applied |
| Split totals are still validated through sync | `INVALID_SPLIT_TOTAL`, not retryable |
| Transfer-into-card still rejected through sync | `INVALID_TRANSFER` |
| `userId` in a payload is ignored | record written for the session user, absent for the other |
| Another user's account cannot be referenced | operation fails |
| Another user's changes never appear in a pull | their account id absent |
| Another user's record is 404 on `/api/sync/record` | asserted |
| A hand-crafted cursor is rejected | 400 |
| Amounts cross the wire as decimal strings | `typeof === "string"`, `"50000"` |
| Split shares still sum to the total after a round trip | equal split of 1000 → 500 + 500 |
| Deletions carry no body | `deleted: true`, `record` undefined |
| Cursor paging neither skips nor repeats | 8 expenses walked in pages of 5 → exactly 8 |
| A failed pull does not advance the cursor | cursor unchanged |
| A pull does not overwrite a pending local edit | local description survives |
| A permanent rejection keeps the local record | expense still present |
| A transport failure keeps the record and re-queues | present, operation pending after backoff |
| Offline validation matches the server's | zero, negative and over-precise all rejected locally |
| An offline write stores record + operation together | both present |
| A rejected offline write stores nothing | no record, no operation |

---

## 5. How it was verified

```text
npx tsc --noEmit                        clean
npx eslint .                            clean
npx prettier --check                    clean
npx vitest run                          872 tests passed (38 files)
npx next build                          succeeded
```

Group 14 finished at 777 tests; this group added 95 (27 unit + 42 offline + 26
integration).

Two notes on method:

* The client engine is tested with an **injected transport** (`send` / `fetchPage`), so
  push, pull, retry, conflict and status transitions are all exercised without a server
  and without mocking IndexedDB. The storage is real; only the network is substituted.
* One build failure during verification was a **corrupted `.next` directory** from a
  concurrent build being killed, not a code fault. `Remove-Item -Recurse .next` then
  rebuild was clean. Worth knowing before debugging a phantom
  `Cannot find module for page` error.

---

## 6. Known gaps

* **Only personal expenses can be created offline.** Shared expenses, settlements,
  transfers and card payments have queue types, dispatch support, and server handling —
  all tested — but their forms still post to the server. Wiring each is mechanical: copy
  the `queueExpenseOffline` shape.
* **No offline editing or deleting.** Needs create+update collapsing (section 32) and
  create-then-delete discard (section 33). The primitives exist (`discardForEntity`,
  `purgeUnsynced`) and are tested; nothing calls them from the UI.
* **The lists and dashboard still read from the server.** An offline expense is in
  IndexedDB and visible to `localStore.transactions.list()`, but `/transactions` and
  `/dashboard` are server components. Offline, they render whatever the service worker
  cached. **This is the biggest remaining offline gap** and it needs group 16's service
  worker plus a client-side read path. Right now the offline save confirms and redirects
  to a list that will not show the new row until sync — the form says so, but it is not
  the experience section 31 describes.
* **No conflict resolution UI.** `conflict-handler.ts` is complete and unused. Conflicts
  currently surface as "needs attention" with a retry button. Also: nothing yet sends
  `baseSyncVersion`, so `SYNC_CONFLICT` is reachable through the API but not through the
  app.
* **`SyncEngine` is per-tab.** Two open tabs run two engines. They will not duplicate
  records — operations are idempotent and claimed before sending — but they will duplicate
  requests. A `BroadcastChannel` lock or a leader election would fix it.
* **No pruning.** `cachedViews` and synced transactions grow without bound. Section 47
  warns against assuming unlimited storage. Group 20.
* **`requestPersistentStorage()` still is not called.** It belongs next to
  `initialiseOfflineStorage()`; the engine's `start()` is the natural place.
* **`processServerTime` is unused.** `SyncPullResponse.serverTime` is returned and ignored;
  it was included for future clock-skew diagnostics.
* **The `.env` / `.env.local` duplication** flagged earlier is still present. `.env.local`
  is authoritative; `.env` is redundant and should be deleted.

### Resolved: the `findByClientId` question

Flagged in groups 10, 11, 13 and 14, and now settled: **`findByClientId` intentionally
ignores `deletedAt`.** A replayed create for a soft-deleted record returns the deleted row
rather than inserting a duplicate. It refuses to resurrect, which is correct — the
alternative is that a retried offline create undoes a deliberate deletion. Documented here
so it stops being an open question.

---

## 7. Notes for the next group

Group 16 (PWA) is what makes the offline work visible.

**The division of responsibility is fixed and must not blur.** The service worker caches
the *application shell and network responses*. IndexedDB holds *application data*. The
service worker is never the financial database (section 48). If a decision seems to
require putting financial state in the service worker, it is the wrong decision.

**What to cache:** the app shell, `/dashboard`, `/transactions`, and the static chunks.
`/api/sync/*` must be **network-only** — a cached push response would tell the client an
operation succeeded when it never left the device.

**The read-path gap is the real work.** Caching the shell makes the app *open* offline;
it will still show stale or empty lists because the pages are server components. Either:
1. Cache the HTML and accept staleness, then let the sync engine refresh on reconnect; or
2. Add a client-side read path over `localStore` for the transaction list.

Option 1 is smaller and probably right for the MVP. Say which was chosen and why.

**Already in place:** `useIsOffline()` for connectivity, `SyncStatusBar` for status,
`initialiseOfflineStorage()` for startup recovery, and `requestPersistentStorage()` waiting
to be called. A manifest and icons do not exist yet.

**Verify with the real thing.** Chrome DevTools → Application → Service Workers →
"Offline", then reload. The task list asks for iPhone and desktop installation, which
cannot be checked from here — flag it as manual.
