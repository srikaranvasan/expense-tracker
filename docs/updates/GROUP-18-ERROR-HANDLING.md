# Group 18 — Error Handling

Spec: `docs/12-SECURITY-AND-ERROR-HANDLING.md` sections 34–47. Checklist:
`docs/13-MVP-TASK-GROUP.md` group 18.

**Scope note.** Dev/staging scope, as with group 17. Nothing in this group turned out to be
production-only: an application you cannot debug is not one you can develop against either.

---

## 1. What was built

Twelve of the fourteen checkboxes were already satisfied by groups 1–15. The audit in group
17 covered the error taxonomy, the response envelope, request ids and logging; this group
verified the remaining pieces and closed the one real hole.

**The hole: there were no React error boundaries at all.** No `error.tsx`, no
`global-error.tsx`, no `not-found.tsx`. A render failure anywhere took the whole application
down to Next's built-in white screen, and an unknown URL got an unstyled default page with
no way onward. Section 45 asks for a friendly error state, a retry, and a route back to safe
ground; none of the three existed.

Five files now provide them, layered so a failure is caught as close to where it happened as
possible:

| Boundary | Catches | What survives |
| --- | --- | --- |
| `(app)/error.tsx` | a render failure on any authenticated screen | header, navigation, sync status bar — and the sync engine keeps running |
| `(app)/not-found.tsx` | `notFound()` from a detail page | the same shell |
| `app/error.tsx` | a failure on sign-in, register, or the offline page | root layout and the theme |
| `app/not-found.tsx` | an unknown URL | root layout |
| `app/global-error.tsx` | a failure in the root layout itself | nothing — it renders its own document |

Plus `components/feedback/ErrorState.tsx`, the shared presentation, so a crash looks the
same wherever it happens.

### Entry points

| Symbol | Location | Notes |
| --- | --- | --- |
| `ErrorState` | `src/components/feedback/ErrorState.tsx` | `title`, `description`, `digest`, `onRetry`, `retryLabel`, `homeHref`, `homeLabel`, `children` |

---

## 2. Files added or changed

| File | Purpose |
| --- | --- |
| `src/components/feedback/ErrorState.tsx` | **New.** Shared error presentation: heading, description, optional retry, route home, optional digest. |
| `src/components/feedback/ErrorState.test.tsx` | **New.** 7 tests. |
| `src/app/error.tsx` | **New.** Root-segment boundary. |
| `src/app/not-found.tsx` | **New.** 404 page. |
| `src/app/global-error.tsx` | **New.** Root-layout boundary. Inline styles, no imports from the design system. |
| `src/app/(app)/error.tsx` | **New.** Boundary inside the authenticated shell. |
| `src/app/(app)/not-found.tsx` | **New.** "This record was not found", inside the shell. |
| `docs/13-MVP-TASK-GROUP.md` | Group 18 checkboxes ticked. |

Nothing existing was modified. The error layer needed no changes.

---

## 3. Key decisions

### Show the error digest to the user

This looks like leaking an internal, and it is the opposite. In production Next replaces a
server error's message with a generic string and hands the client only `error.digest`, a
hash that matches the server log entry for the same failure. Hiding it means a user report
of "it broke" can never be traced to a log line.

So `ErrorState` renders it under "Reference for support", in a `<code>` element with
`user-select: all` so it can be copied. It is a correlation id, not a stack trace — the
thing section 40 asks for, arriving by a different route than the `X-Request-Id` header.

### A boundary inside `(app)`, not only at the root

Placement is the whole point of this group. A boundary at the root would replace the entire
screen, including the navigation, so a user whose transaction list failed to render would be
stranded with nothing but a "try again" button for the page that just failed.

`(app)/error.tsx` sits inside the group, so the group's layout stays mounted: header,
navigation, and the sync status bar keep working, and the user can simply go elsewhere. It
also means **the sync engine keeps running** — `SyncStatusBar` mounts it in the shell — so a
queue of offline expenses continues to upload while the error is on screen. That is a
concrete instance of "a component crash should not destroy the entire application's usable
state".

### `global-error.tsx` imports nothing from the design system

It uses inline styles and raw HTML elements. If the root layout threw, the Chakra provider
never mounted, so the theme, the tokens and every `components/ui` primitive are unavailable —
importing them would risk the error page throwing too, and then the user gets a blank screen
with nothing to act on.

The colours are the literal hex values behind the `surface`, `content` and `brand` tokens
rather than references. If those change in `src/theme/tokens.ts` this one page will look
slightly dated. That is the right trade for a page that must never fail. The touch targets
are still 44px, because accessibility is not conditional on the error state.

Its "go to dashboard" is a plain `<a>`, not `next/link`: the router is part of what may have
failed, so a full page load is the more reliable escape.

### Only the boundary that knows says the data is safe

`(app)/error.tsx` says "Your saved data is safe. Anything waiting to sync is still queued."
That is accurate there: local records are durable in IndexedDB and a render failure does not
touch the queue.

`ErrorState`'s default copy is weaker — "Nothing you have already saved is affected" — because
the component cannot know. Making the strong claim the default would eventually put a
reassurance on a screen where it was false, and a false reassurance about financial data is
worse than no reassurance. A test asserts the strong wording only appears when passed in.

### The root boundary sends users to `/` rather than `/dashboard`

It catches failures on sign-in and register, where the user has no session. Offering the
dashboard would bounce them straight back through the login redirect.

### The 404 copy leads with deletion

"It may have been deleted, possibly on another device." Opening a link to a record removed on
another device is the ordinary way to reach a 404 in a multi-device app, and a bare "page not
found" reads like a mistake the user made. Soft deletion plus sync makes this common, not
exceptional.

### Boundaries log from the client

Each `error.tsx` logs in a `useEffect`. A client-side render failure never reaches the server
on its own, so without this the digest exists on screen and nowhere else. The log carries the
digest and the message only — no component tree, no props, nothing that could contain an
amount or a description (section 39).

### What was verified rather than rebuilt

Twelve checkboxes were already met. Recorded here so the next reviewer does not redo the
work:

- **Error classes** — `AppError` plus `DomainError`, `ValidationError`, `UnauthorizedError`,
  `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitedError`,
  `ServiceUnavailableError`, `InternalError`. Each carries a code, an HTTP status, and a
  separate `userMessage` so the log text and the user text can differ.
- **Stable codes** — 27 in `ERROR_CODES`, covering every category section 35 lists.
  `RETRYABLE_ERROR_CODES` is the set the sync engine retries.
- **Consistent API error response** — `apiError()` is the single construction point;
  `{ error: { code, message, details? } }` plus `X-Request-Id`, and `Retry-After` on a 429.
- **Frontend error handling** — every server action returns `ActionState`
  (`{ ok, message?, fieldErrors?, entityId? }`) rather than throwing, so a validation failure
  lands on the form field instead of tripping a boundary. That distinction matters: a
  boundary is for the unexpected, and a mistyped amount is not unexpected.
- **Network failures** — `useConnectivity` for the hint, `useServerReachable` for the truth,
  the sync engine's backoff, and the `/offline` route.
- **API and database failures** — `toApiError()` maps `MongoNetworkError` and
  `MongoNotConnectedError` to 503, a transient transaction error to 503, a duplicate key to
  409, and anything unrecognised to a generic 500. No driver text reaches a client, asserted
  by `tests/integration/security.test.ts`.
- **Validation failures** — `fromZodError()` produces per-field errors the forms bind to.
- **Authorization failures** — 401 for anonymous, 404 for another user's record.
- **Sync failures** — `error-classification.ts` splits retryable from permanent,
  `conflict-handler.ts` handles `SYNC_CONFLICT`, and permanent failures surface as the
  `attention` state with a retry, never deleting the local record (section 42).
- **Unknown errors** — `InternalError` with a generic message server-side, and now a boundary
  client-side.
- **Request ids** — `resolveRequestId()` per request, on every response and every log line.
- **Structured logging** — `logger.child()` carries `requestId`, `operation`, `route`,
  `method` and `userId`; 5xx logs the stack, 4xx logs a warning without one. `redact()`
  removes credentials and drops private financial fields.

---

## 4. Business rules enforced

No financial rules. The relevant guarantees are about not making a failure worse:

| Rule | Where |
| --- | --- |
| A render failure never discards queued financial data | boundaries re-render a segment; the sync engine lives in the shell layout and is not unmounted |
| `reset()` retries the render rather than reloading, so an in-flight sync survives | `(app)/error.tsx` |
| The user is never falsely told their data is safe | strong wording is passed in per boundary, not defaulted |
| A failure is always traceable to a server log line | digest rendered, digest and request id logged |
| An error screen never shows implementation detail | `ErrorState` renders only a message and a digest; no stack, no cause |
| A validation mistake is not escalated to a crash | actions return `ActionState` instead of throwing |

---

## 5. How it was verified

```powershell
npx tsc --noEmit       # clean
npx eslint .           # clean
npx prettier --check . # clean
npx vitest run         # 43 files, 1026 tests
npx playwright test    # 8 tests
npx next build         # succeeds
```

Test count went from 1019 to 1026 (+7 UI tests).

`ErrorState.test.tsx` asserts: it announces itself as `role="alert"` rather than `status`, a
crashed screen being the one thing worth interrupting a screen reader for; it always offers a
route home even with no retry; `onRetry` is wired to the button; the digest block appears with
a digest and is absent without one; the strong "still queued" reassurance appears only when
passed in; and an alternative destination works for the unauthenticated boundary.

### What was not verified

- **The boundaries have not been triggered in a browser.** Provoking one needs a component
  that throws on purpose, which would mean shipping a deliberate crash route or a test-only
  build flag. The composition is simple — each file renders `ErrorState` with different props,
  and `ErrorState` itself is tested — but "a real crash lands here and looks right" is
  currently reasoned, not observed.
- **`global-error.tsx` has never rendered.** It requires the root layout to throw, which
  needs a Providers or theme failure. It imports nothing that could fail, which is the design,
  and that is also why it cannot easily be exercised.
- **The 404 page is not covered by E2E.** An unknown URL redirects an anonymous visitor to
  sign-in before any 404 is reached, so exercising it needs an authenticated session — which
  the E2E suite does not yet have (see group 19).

---

## 6. Known gaps

| Gap | Deferred to |
| --- | --- |
| **No API timeout handling on the client** (section 46). The sync engine retries a failed request but does not abort a hanging one, so a request that never resolves holds the queue until the browser gives up. The idempotency needed to make a retry-after-timeout safe is already in place — only the `AbortSignal` is missing. | Post-MVP |
| **No conflict-resolution UI** (section 44). A `SYNC_CONFLICT` marks the operation failed and the status bar reports it needs attention, which preserves the local record as section 42 requires, but there is no screen to compare local against server and choose. Inherited from group 15. | Post-MVP |
| **The `attention` state does not say *which* change failed.** `describeSyncState` reports a count and the bar offers "Try again". `SyncStatus.lastError` carries the first message but nothing renders it. Section 43 asks the user be able to see what failed. | Post-MVP |
| **Boundaries are not exercised by a test that actually throws.** See section 5. | Group 19 if the E2E suite gains a session |
| **No client-side error reporting.** Boundaries log to the browser console; nothing is transmitted. Adding a reporter means choosing a third party, and section 54 forbids sending financial content to one. | Post-MVP, deliberately |
| **`InternalError` messages are generic by design**, so a 500 in staging needs the server log to diagnose. That is the intent of section 38 and the digest is the bridge. | Not a gap; recorded so it is not mistaken for one |

---

## 7. Notes for the next group

**Group 19 is testing.** What this group leaves for it:

- **The boundaries need a real crash to be properly verified.** If the E2E suite gains an
  authenticated session, a route that throws behind a development-only flag would let
  `(app)/error.tsx`, `(app)/not-found.tsx` and the 404 page be exercised for real. Worth it
  only if the session work happens anyway.
- **`tests/integration/security.test.ts` already covers error-body sanitisation and request
  ids.** Extend it rather than starting a parallel error-handling integration file.

**Practical notes:**

- **New route group? Consider an `error.tsx` beside its layout.** The value is entirely in
  what stays mounted; a boundary at the root is a much worse experience than one inside the
  shell.
- **Render `ErrorState`, do not write another error screen.** Consistency here is worth more
  than a bespoke message, and it is the only place the digest is handled.
- **Do not import from `@/theme`, `@/components` or Chakra in `global-error.tsx`.** It exists
  for the case where those are what failed.
- **Actions return `ActionState`; they do not throw.** A thrown error in an action trips the
  boundary and loses the user's form input. Anything expected — validation, a business rule,
  a conflict — belongs in the returned state.
