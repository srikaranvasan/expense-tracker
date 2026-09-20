# Group 14 — Offline Storage

Status: complete.

---

## 1. What was built

The local half of offline support: a durable IndexedDB database, repositories to read
and write it, a durable sync queue, and connectivity detection.

This group deliberately builds **storage only**. Nothing here talks to the network.
Group 15 owns the engine that drains the queue, the push and pull requests, and
conflict handling. The split matters because it lets the storage guarantees be tested
in isolation — 43 tests against a real IndexedDB, with no server involved.

What exists now:

* `src/offline/db/` — the Dexie database, its schema, its migrations, and the mapping
  between domain entities and stored records.
* `src/offline/repositories/` — local repositories for transactions and splits,
  settlements and allocations, the reference data (accounts, people, categories), the
  sync queue, sync metadata, and cached views.
* `src/offline/network/connectivity.ts` — online/offline detection.
* `src/offline/local-store.ts` — the entry point features use.
* An `OfflineBanner` in the app shell, which appears only when offline.

---

## 2. Files added or changed

### Offline layer — `src/offline/` (all new)

* **`db/schema.ts`** — every stored record type. `SyncStatus`, `LocalRecordMeta`,
  `LocalAccount`, `LocalPerson`, `LocalCategory`, `LocalTransaction`,
  `LocalExpenseSplit`, `LocalSettlement`, `LocalSettlementAllocation`,
  `LocalSyncOperation`, `LocalSyncMetadata`, `LocalCachedView`, plus
  `SyncOperationType` and the Dexie index declarations in `TABLE_SCHEMA_V1`.
* **`db/migrations.ts`** — `LOCAL_DB_VERSION`, `MIGRATIONS`, `applyMigrations(db)`.
* **`db/client.ts`** — `LocalDatabase`, `localDb()`, `isOfflineStorageAvailable()`,
  `requestPersistentStorage()`, `estimateStorageUsage()`, `closeLocalDb()`,
  `setLocalDbForTesting()`.
* **`db/record-mapping.ts`** — `toMoneyDto` / `fromMoneyDto` and a `to…`/`from…` pair
  for every entity, plus `pendingMeta()`.
* **`db/record-mapping.test.ts`** — 22 unit tests.
* **`repositories/reference-repository.ts`** — `localAccountRepository`,
  `localPersonRepository`, `localCategoryRepository`.
* **`repositories/transaction-repository.ts`** — `localTransactionRepository`.
* **`repositories/settlement-repository.ts`** — `localSettlementRepository`.
* **`repositories/sync-operation-repository.ts`** — `localSyncOperationRepository`.
* **`repositories/sync-metadata-repository.ts`** — `localSyncMetadataRepository`,
  `localCachedViewRepository`, `getDeviceId()`.
* **`repositories/types.ts`** — shared query shapes.
* **`network/connectivity.ts`** — `isProbablyOnline()`, `probeServer()`,
  `observeConnectivity()`.
* **`hooks/useConnectivity.ts`** — `useConnectivity()`, `useIsOffline()`.
* **`local-store.ts`** — `localStore`, `initialiseOfflineStorage(userId)`,
  `clearLocalDataForUser(userId)`, `getPendingWorkSummary(userId)`.

### UI

* **`src/components/feedback/OfflineBanner.tsx`** (new).
* **`src/components/layout/AppShell.tsx`** (changed) — banner inside the sticky header.

### Tooling

* **`eslint.config.mjs`** (changed) — two new boundaries. `offline/` may not import
  `@/server/*`, `@/app/*`, MongoDB or a UI library; `server/` may not import `dexie` or
  `@/offline/*`. The layers are enforced, not just documented.
* **`vitest.config.mts`** (changed) — a fourth project, `offline`.
* **`tests/setup/offline-setup.ts`** (new), **`tests/helpers/offline.ts`** (new),
  **`tests/offline/local-storage.test.ts`** (new, 43 tests).
* **`package.json`** — `fake-indexeddb@6.2.2` as a dev dependency, and
  `npm run test:offline`.

---

## 3. Key decisions

### Money is stored as a string, and this is the decision everything else serves

IndexedDB stores structured clones. A structured clone of a `Money` instance **loses
its prototype** — it comes back as a plain object, and the first `.plus()` call on it
throws. Worse, storing a raw JavaScript number would reintroduce binary float error at
precisely the boundary the money layer exists to eliminate.

So every stored amount is a `MoneyDto`: `{ amount: string, currency: string }`, the
same shape used over the wire. `db/record-mapping.ts` is the **only** place the
conversion happens, and it has a test asserting no stored record holds a `Money`.

There is also a round-trip test on three shares of `1000` split as
`333.33 / 333.34 / 333.33`, asserting they still sum to exactly `1000.00` after going
through storage. That is the invariant the whole money layer protects, checked at the
one boundary where it could silently break.

`Date` needs no conversion — structured clone preserves it — and there is a test
pinning that too, because it would be easy to "helpfully" serialise dates to strings
later and break every date query.

### `clientId` is the primary key, not the server id

A record created offline has no server id, and the user must still be able to open,
edit and delete it. Keying on `clientId` — a UUID the client generates — means the
local record is complete from the moment it is written.

It is also why `LocalExpenseSplit` links to its transaction by
**`transactionClientId`**, not `transactionId`. A server-id link would be null exactly
when offline support matters.

### The local database mirrors the server's atomicity guarantees

A transaction and its splits are written in one Dexie transaction. A transaction whose
splits are missing looks like an expense with no participants, which corrupts every
spending total that reads it — the same invariant the server protects with a MongoDB
transaction (docs/08-OFFLINE-SYNC.md section 9). Settlements and allocations are
written the same way.

Splits are also **replaced wholesale** on write, matching the server's behaviour on an
amount change. Diffing them would be a second way to express the same intent, and the
two would eventually disagree.

### The queue holds domain commands, not row mutations

`SyncOperationType` is `CREATE_SHARED_EXPENSE`, not `INSERT transaction` +
`INSERT split` ×3. The command carries the whole business event so the server can
validate and persist it in one transaction (docs/08-OFFLINE-SYNC.md sections 11-12).
Syncing rows independently invites a half-applied expense that no amount of retrying
can repair.

The payload is stored **already built**, in the shape the API expects, rather than
being reconstructed from the local record at send time. The record may have been edited
or deleted since; the queued command must describe what the user actually did.

### A failed operation never deletes its local record

`markFailed()` touches the operation only. If the server rejects a change, that means
the server would not accept it — not that the user's data should disappear
(docs/08-OFFLINE-SYNC.md section 50, rule 8). There is an explicit test for this,
because it is the kind of "cleanup" that looks tidy and loses someone's money records.

Completed operations *are* deleted, though: the queue is a work list, not an audit log,
and keeping every command ever sent would consume storage that unsynced records may
need.

### Interrupted operations are recovered at startup, not on a timer

An operation left in `processing` because the browser closed mid-send would never be
retried. `recoverInterrupted()` returns them to `pending`, and
`initialiseOfflineStorage()` calls it once per session. Resending is safe because every
operation is idempotent (docs/08-OFFLINE-SYNC.md section 42).

### Backoff is stored, not scheduled

`nextRetryAt` lives on the row and `listPending()` filters against it. No timers, no
in-memory schedule — so a backoff survives a page reload, which an in-memory one would
not. Group 15 sets the value; group 14 only honours it.

### `navigator.onLine` is treated as a hint, never an answer

It reports whether a network interface exists, not whether this server is reachable. A
captive portal, a dropped VPN, or a server outage all leave it `true`
(docs/08-OFFLINE-SYNC.md section 15). So there are two functions:
`isProbablyOnline()` for the cheap hint and `probeServer()` for the real answer, which
hits `/api/health` with `cache: "no-store"` — a cached 200 would report a server that
is long gone.

`observeConnectivity()` also listens for `visibilitychange`, because a laptop that
slept through a network change fires no `online` event on wake.

### Reference data is cached, not created offline

Accounts, people and categories can be read offline so the pickers work, but the MVP
does not support creating them offline. They are managed on screens the user visits
deliberately and rarely, whereas recording an expense happens in a queue at a till. The
offline effort goes where the need is (docs/08-OFFLINE-SYNC.md section 31). The queue
already has `CREATE_ACCOUNT` and `CREATE_PERSON` types reserved for when this changes.

### `purgeUnsynced` refuses to purge anything the server has seen

Create-then-delete offline has nothing to tell the server, so both the record and its
queued operations are discarded (docs/08-OFFLINE-SYNC.md section 33). But the method
checks `serverId !== null` first and refuses if the server knows about the record —
physically removing it would just let the next pull bring it back.

### `clearLocalDataForUser` is scoped to one user

A browser profile can be shared. Every repository takes `userId` as a required first
argument — the same discipline as the server repositories — and sign-out clears only
that user's rows. There is a test asserting the other user's data survives.

### Tests run against a real IndexedDB

`fake-indexeddb` in a fourth vitest project, rather than mocking the repositories.
Mocking would test nothing that matters: the behaviour worth verifying *is* the storage
behaviour — that a transaction and its splits commit together, that a soft delete leaves
the row in place, that the queue survives a reload. None of that is observable against
a mock.

Each test gets a uniquely named database, which is cheaper than clearing tables and
also proves the schema can be built from scratch every time.

---

## 4. Business rules enforced

Storage enforces no financial rules — that is deliberate, and stated in
`docs/08-OFFLINE-SYNC.md` section 46. Repositories do not decide whether an account may
be used or what a person's balance is; `domain/` does, on both client and server.

What this group *does* guarantee:

| Guarantee | Test |
| --- | --- |
| Amounts survive storage exactly | `1234567.89` and `19999999.99` round-trip unchanged |
| Split shares still sum to the total after a round trip | `333.33 + 333.34 + 333.33 = 1000.00` |
| No stored record holds a `Money` instance | asserted on account and card records |
| `Date` survives storage as a `Date` | asserted on transaction dates |
| A transaction and its splits commit together | both present after one `put` |
| Splits are replaced, never accumulated | 2 splits then 1 split leaves 1 |
| A soft delete keeps the row so the delete can sync | `deletedAt` set, `syncStatus` pending, hidden from list |
| An unsynced create can be purged | record and splits gone |
| A synced record cannot be purged | `purgeUnsynced` returns false, record intact |
| Queue order is creation order | `CREATE_PERSON` before `CREATE_SHARED_EXPENSE` |
| Backoff is honoured without a timer | withheld before `nextRetryAt`, released after |
| A permanent failure keeps the local record | expense still present after `markFailed` |
| Interrupted sends are recoverable | `processing` → `pending` at startup |
| Data survives close and reopen | expense and queued command both present |
| One user's data is invisible to another | reads, queue and cache all scoped |

The account filter also matches a transfer from **either** side, mirroring the server's
behaviour, so the same query means the same thing online and offline.

---

## 5. How it was verified

```text
npx tsc --noEmit                        clean
npx eslint .                            clean
npx prettier --check                    clean
npx vitest run                          777 tests passed (32 files)
npx next build                          succeeded
```

Group 13 finished at 712 tests; this group added 65 (22 unit + 43 offline).

The two tests worth singling out:

* **"persists across a close and reopen"** closes the Dexie handle, reopens the same
  named database, and asserts both the expense and its queued command are still there.
  That is the literal meaning of the "persist data across app restarts" requirement, and
  it is the one thing a mocked store could never demonstrate.
* **"does not delete the local record when its operation fails permanently"** exists to
  stop a future refactor from "tidying up" a failed operation by removing the record it
  refers to.

---

## 6. Known gaps

* **No sync engine.** Nothing drains the queue yet. `push`, `pull`,
  `conflict-handler` and `sync-engine` are group 15.
* **No feature code writes to the local store yet.** The repositories are complete and
  tested, but the expense/settlement/transfer forms still go straight to server actions.
  Wiring the offline write path is group 15's job, because a local write without a
  working push would strand the user's data.
* **Reference data cannot be created offline.** See decisions. The queue types are
  reserved.
* **`requestPersistentStorage()` is written but not called.** It belongs at app startup
  alongside `initialiseOfflineStorage()`, which group 15 will wire in.
* **`estimateStorageUsage()` has no UI.** Written for a future diagnostics screen.
* **`probeServer()` is unused.** Group 15's engine is its caller.
* **No eviction or pruning policy.** `cachedViews` and old synced transactions grow
  without bound. `docs/08-OFFLINE-SYNC.md` section 47 warns against assuming unlimited
  storage; a cap belongs in group 15 or 20 once the real read volume is known.
* **`OfflineBanner` reports the browser hint only.** It does not yet distinguish "no
  network" from "server unreachable", and shows no pending count — both need the sync
  engine's state.
* **Pre-existing dependency advisories.** `npm audit` reports 2 vulnerabilities (1 high)
  in the `postcss` bundled inside `next@15.5.24`. They predate this group;
  `fake-indexeddb` added none. The fix is `next@16`, a breaking major upgrade, so it is
  left for group 17 ("Review third-party dependencies") as an explicit decision rather
  than taken silently here.

---

## 7. Notes for the next group

Group 15 (Offline Sync) is the other half of this. Everything it needs to store state
already exists and is tested.

**Draining the queue:**

* `localStore.syncQueue.listPending(userId)` — ready operations, oldest first, backoff
  already honoured. Just iterate it.
* `markProcessing` → `complete` on success.
* `markRetryable(operationId, { nextRetryAt, error, errorCode })` for a temporary
  failure. **Compute `nextRetryAt` with jitter**, or every client that reconnects after
  an outage retries in lockstep (docs/08-OFFLINE-SYNC.md section 19).
* `markFailed(operationId, { error, errorCode })` for a permanent rejection — validation
  errors, a deleted account, an over-settlement. Do not retry these forever
  (section 20).
* `retryFailed(userId)` is there for a user-initiated "try again".

**Which errors are which** matters more than it looks. The server already returns stable
codes: `INVALID_SPLIT_TOTAL`, `OVER_SETTLEMENT`, `EXPENSE_HAS_SETTLEMENTS`,
`INVALID_ACCOUNT` are permanent; a 503, a timeout, or a network failure are temporary.
`SYNC_CONFLICT` is neither — it needs the conflict path.

**Pushing:** the server side is already idempotent. Every create service checks
`findByClientId` **before validating anything**, so replaying a command returns the
original record rather than creating a second one. That has been true since group 6 and
is tested in groups 10 and 11.

**Pulling:** every repository has `changesSince(userId, query)` (group 3), and every
record carries `syncVersion` and `updatedAt`. `localStore.syncMetadata.setCursor()`
stores the cursor — **advance it only after the changes are committed locally**, or the
client skips them permanently (section 23).

**Conflicts:** the server's update paths accept `expectedSyncVersion` and reject a stale
one. Never merge financial values — `docs/08-OFFLINE-SYNC.md` section 29 is explicit
that combining a local ₹500 with a server ₹700 into ₹1,200 is unacceptable. Surface it
and let the user decide.

**The open question this group did not settle, again.** `findByClientId` on the server
ignores `deletedAt`, so replaying a create for a soft-deleted record returns the deleted
row with a 201. That is arguably correct — it refuses to resurrect — but it has now been
flagged in groups 10, 11, 13 and 14. **Group 15 should decide it explicitly for all
record types and write the decision down.**

**Where to write local data.** `localStore` is the only import features need. The lint
rules will reject a component that imports `dexie` or a repository directly, and will
reject `server/` importing anything from `offline/`.
