/**
 * Human-readable reference codes for financial records.
 *
 * The designs show a permanent reference on every transaction and settlement — a ledger line's
 * number, something a person can read out on the phone. A 24-character `ObjectId` is not that.
 *
 * ## The approach, and what was rejected
 *
 * Group 21 (section 3.1) chose to **derive** the code from an existing id rather than allocate a
 * sequence:
 *
 * - **A per-user monotonic sequence** would produce exactly the codes in the handoff (`#08231`), and
 *   was rejected. A gap-free sequence allocated inside `withTransaction()` means counter contention,
 *   retries on write conflict, and a guarantee to prove under concurrency — and it cannot produce a
 *   code until the server sees the write, which forces a draft state onto every offline create.
 * - **Dropping the reference** was rejected too: it is one of the load-bearing parts of the ledger
 *   framing.
 *
 * So: the last five hex characters of an id, uppercased.
 *
 * ## Which id — `clientId`, not the server `ObjectId`
 *
 * Group 21 wrote "derived from the `ObjectId`" and, in the same section, "available offline
 * immediately, because the id exists before the record syncs". Those two cannot both be true. A
 * record created offline has `serverId: null` until it syncs (`offline/db/record-mapping.ts`), so an
 * `ObjectId`-derived code would be absent while offline and would then **change** the moment the
 * server assigned one — which is the opposite of a permanent reference.
 *
 * Every record in this app carries a `clientId`: a client-generated UUID, required by every create
 * schema, stored by the server, and preserved through sync. Deriving from it gives the property group
 * 21 actually asked for:
 *
 * - present the instant the record exists locally, before any network call
 * - **identical before and after sync**, because the server stores the same value
 * - uniform — no branch on whether a record has reached the server
 *
 * The handoff settles it independently: `AddExpense-Light.html` shows `TXN-08232 · draft` on a record
 * that has **not been saved yet**. Only a client-generated id can produce a code at that moment.
 *
 * ## Two consequences, accepted deliberately
 *
 * 1. **The codes carry no ordering.** `#A3F09` is not "after" `#7B210`. Nothing in the UI may sort
 *    by them, count them, or present them as a sequence. This is the reason the function is named
 *    for a *reference* and not an *id* or a *number*.
 * 2. **They are not globally unique.** Five hex characters is about a million values; two records
 *    could collide. That is acceptable because a reference is a *human* handle used alongside a
 *    date, an amount and a description, never a lookup key. Never query by one.
 *
 * ## Where this is called from
 *
 * The **view models**, alongside `formattedAmount` and `dateLabel` — formatting is a view-model job
 * in this codebase, and `ReferenceCode` takes the finished string exactly as `Amount` takes
 * `formattedAmount`. Switching to a sequence later is a change to `referenceCodeFor` and nothing
 * else.
 */

/** How many trailing characters of the id become the code. */
const CODE_LENGTH = 5;

/**
 * Formats an id as a reference code.
 *
 * Returns `null` for a missing id rather than a placeholder, so a caller has to decide what an
 * unreferenced record looks like.
 *
 * Prefer `referenceCodeFor` — it names *which* id, which is the part that carries the decision.
 */
export function toReferenceCode(id: string | null | undefined): string | null {
  if (!id) return null;

  // Shorter ids are not expected — an ObjectId is 24 characters and a client id is a UUID — but a
  // fixture or a hand-written test id might be, and truncating to nothing would be worse than
  // showing what there is.
  const tail = id.slice(-CODE_LENGTH);
  if (!tail) return null;

  return `#${tail.toUpperCase()}`;
}

/**
 * The reference code for a record.
 *
 * This is the seam. It is the only place that decides *which field* a code comes from, so moving to a
 * server-allocated sequence means changing this function — the signature already accepts the whole
 * record, and already returns `null`, which is what a sequence-based code is before its first sync.
 *
 * Takes a structural type rather than a domain entity so the offline layer's `LocalRecordMeta` and a
 * bare `{ clientId }` from a create form both fit, without `lib` importing from `domain`.
 */
export function referenceCodeFor(record: { clientId: string | null | undefined }): string | null {
  return toReferenceCode(record.clientId);
}
