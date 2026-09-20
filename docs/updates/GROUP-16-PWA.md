# Group 16 — PWA

Spec: `docs/08-OFFLINE-SYNC.md` section 48. Checklist: `docs/13-MVP-TASK-GROUP.md` group 16.

---

## 1. What was built

The app is now installable and starts with no network connection.

Concretely:

- A **web app manifest** at `/manifest.webmanifest`, generated from a route so its name
  and short name come from `publicConfig`.
- A generated **icon set** (192, 512, maskable variants, an iOS touch icon, an SVG, and a
  favicon), produced by a script from the brand token rather than committed as opaque
  binaries.
- A **service worker** at `public/sw.js` that caches the application shell, serves
  previously visited pages when the network is gone, and never caches an API response.
- An **`/offline` route** shown when a page is requested that has never been opened on the
  device. It probes the server and turns into a way forward once the connection returns.
- **Installation affordances**: a prompt where the browser supports one, and Share-menu
  instructions on iOS where it does not.
- An **update flow**: a new shell installs in the background and offers a reload rather
  than swapping itself in under a half-entered expense.
- The first caller of **`requestPersistentStorage()`**, which group 14 wrote and nothing
  had invoked.

The division of responsibility from section 48 is respected throughout: the worker caches
*network responses*, IndexedDB holds *application data*, and nothing in `public/sw.js`
reads or reasons about a transaction, a split, or a balance.

### Entry points another developer will need

| Symbol | Location | Purpose |
| --- | --- | --- |
| `registerServiceWorker(options)` | `src/offline/pwa/service-worker.ts` | Registers the worker, reports a waiting update |
| `applyServiceWorkerUpdate(registration)` | same | Activates the waiting worker and reloads onto it |
| `clearPrivateCaches(timeoutMs?)` | same | Drops cached HTML. Called on sign-out |
| `unregisterServiceWorker()` | same | Support escape hatch; not used by the app |
| `SERVICE_WORKER_MESSAGES`, `CACHE_NAME_PREFIX`, `PRIVATE_CACHE_PREFIX` | same | Constants mirrored in `public/sw.js` |
| `detectInstallPlatform(userAgent, maxTouchPoints?)` | `src/offline/pwa/install.ts` | Pure platform classification |
| `describeInstallSteps(platform)` | same | Per-platform manual instructions |
| `observeInstallability(listeners)` | same | Captures `beforeinstallprompt` / `appinstalled` |
| `useServiceWorker()` | `src/offline/hooks/useServiceWorker.ts` | Registration + update state + persistence |
| `useInstallPrompt()` | `src/offline/hooks/useInstallPrompt.ts` | Drives the install affordance |
| `useServerReachable(intervalMs?)` | `src/offline/hooks/useServerReachable.ts` | Is the *server* reachable, not just the interface |

---

## 2. Files added or changed

### Service worker (plain JS, outside the TypeScript layers)

| File | Purpose |
| --- | --- |
| `public/sw.js` | **New.** The whole caching layer: routing table, four strategies, install/activate/message lifecycle. Excluded from ESLint and Prettier (pre-existing config) because it runs in a worker global those tools do not model. |

### Offline layer (`src/offline/`)

| File | Purpose |
| --- | --- |
| `pwa/service-worker.ts` | **New.** Page-side registration, update handling, cache cleanup. |
| `pwa/install.ts` | **New.** Platform detection and install-prompt plumbing. Pure functions take the user agent as an argument so they are testable without a browser. |
| `pwa/install.test.ts` | **New.** 14 tests over the pure detection logic. |
| `hooks/useServiceWorker.ts` | **New.** Registers once near the root; periodic and on-visibility update checks; requests persistent storage. |
| `hooks/useInstallPrompt.ts` | **New.** Install state, dismissal memory. |
| `hooks/useServerReachable.ts` | **New.** Probes `/api/health` with backoff-free polling that stops once the server answers. |

### App shell and routes (`src/app/`, `src/components/`)

| File | Purpose |
| --- | --- |
| `app/manifest.ts` | **New.** Generates `/manifest.webmanifest`. |
| `app/offline/page.tsx` | **New.** Static offline fallback, outside both route groups. |
| `app/layout.tsx` | Manifest link, icon set, iOS standalone metadata, `viewport-fit: cover`, mounts `ServiceWorkerManager`. |
| `components/layout/AppShell.tsx` | Renders `InstallPrompt` after the sync bar. |

### Features (`src/features/`)

| File | Purpose |
| --- | --- |
| `pwa/components/ServiceWorkerManager.tsx` | **New.** Registers the worker; renders the update banner and nothing else. |
| `pwa/components/InstallPrompt.tsx` | **New.** Install button or iOS instructions, dismissible. |
| `pwa/components/OfflineNotice.tsx` | **New.** Content of the `/offline` route. |
| `auth/components/SignOutButton.tsx` | Clears cached HTML before ending the session. |

### Assets and tooling

| File | Purpose |
| --- | --- |
| `scripts/generate-icons.ts` | **New.** Hand-rolled PNG/ICO/SVG encoder. No native dependency. |
| `public/icons/*`, `public/favicon.ico` | **New.** Generated output, committed. |
| `playwright.config.ts` | **New.** E2E against a production build on `127.0.0.1`. |
| `tests/e2e/pwa-offline.spec.ts` | **New.** 8 browser tests. |
| `tests/offline/service-worker.test.ts` | **New.** 62 tests that evaluate `public/sw.js` as shipped. |
| `package.json` | Added `icons:generate`. |

---

## 3. Key decisions

### Cache the rendered HTML; do not build a client-side read path

This was the open question group 15 handed over, and it is the decision that shapes the
rest of the group. Two options were on the table:

1. Cache page HTML in the service worker and accept that offline pages show the last
   synchronised state.
2. Rewrite the lists and dashboard to read from `localStore` so offline-created records
   appear immediately.

**Chosen: option 1.** Option 2 means every list and the dashboard grow a second data path,
and the two paths have to agree about balances — which means the balance calculations get
duplicated or moved, and the risk is that the two disagree about money. That is a large
change to make in the same group that introduces a service worker.

The cost is stated plainly rather than hidden: an expense created offline sits in
IndexedDB and does not appear in `/transactions` until sync completes. `SyncStatusBar`
shows the queued count, so the user has a signal that something is pending. Closing this
properly is deferred (see section 6).

### Deliberately ignore `Cache-Control: no-store` for page navigations

Authenticated pages are dynamic, so Next sends `no-store`. Honouring that in the worker
would mean caching nothing and delivering none of this group.

The worker is an application-level cache under our control, so it overrides the header for
navigations — and the privacy consequence is mitigated rather than ignored: rendered HTML
goes into a separate `pages` cache, and `SignOutButton` clears it before the session ends.
The shell and build-output caches survive sign-out because they contain nothing personal
and dropping them would leave the next user unable to start offline.

### Every `/api/**` request is network-only, without exception

The one rule the whole file exists to protect. A cached `/api/sync/push` response would
tell the client an expense had reached the server when it never left the device; a cached
`/api/sync/pull` would hand it a stale financial snapshot it believes is current. Ten
explicit test cases cover this, plus a browser test asserting an offline `/api/health`
*fails* rather than resolving from cache.

`?_rsc=` requests are network-only for the same reason at a smaller scale: a stale flight
payload renders a stale screen inside a fresh app. When one fails offline, Next falls back
to a full navigation, which the navigation strategy does handle.

### Navigation is network-first, not cache-first

Cache-first would be faster and is the usual app-shell advice. It is wrong here: it would
show yesterday's balances to a user who is online. Financial figures must be current
whenever they can be.

### The offline fallback is a redirect, not a substituted document

**This was found by the browser tests, not by reasoning.** The first implementation
returned `/offline`'s HTML in answer to, say, `/accounts/123`. The App Router then hydrated
a document describing one route while the address bar showed another, threw a client-side
exception, and replaced the friendly page with *"Application error: a client-side exception
has occurred"* — the exact opposite of section 49's intent.

The worker now returns a 302 to `/offline`, so content and URL agree. A failed request for
`/offline` itself returns an inline last-resort body instead of redirecting, or a missing
precache would become an infinite loop.

### Precache the offline page's scripts, not just its HTML

**Also found by the browser tests.** Fetching a document does not fetch its subresources,
so `/offline` was cached while every chunk it references was not. Offline, those requests
failed and React never started.

`install` now reads the precached HTML, extracts `/_next/static/...` references with a
regular expression, and caches them. Only the offline page is warmed this way — every other
route's assets arrive through the cache-first strategy as the user visits it, and precaching
the whole build would put megabytes on a device that also has to hold unsynced expenses
(section 47).

### The offline page probes the server rather than trusting `navigator.onLine`

**Found the same way.** The first version read `navigator.onLine` and announced "You are
back online" while every request was still failing. Section 15 says exactly this:
`online ≠ server reachable`.

`useServerReachable()` asks `/api/health` and only reports recovery when the server answers.
The browser's hint is still used, as a *trigger* to probe — a good moment to ask, not an
answer.

### No `skipWaiting()` on install

A new worker waits, and `ServiceWorkerManager` offers a reload. Activating immediately
would swap the shell under a user part-way through entering an expense, and not losing
those is the point of the application.

`updateViaCache: "none"` on registration complements the `no-store` header
`next.config.ts` already sends for `/sw.js`. Both are needed: the header only helps once
the request actually goes out.

### Hand-written worker, not Workbox

The routing table is about forty lines. A generated worker would hide the rule that matters
behind a configuration file, and add a build step for the one file in the project that must
be readable at a glance. Being plain script also makes it evaluable in a test sandbox.

### Hand-rolled icon encoder, not `sharp`

`sharp` and `canvas` are native dependencies installed on every machine and in CI to draw
four rectangles. The mark is simple enough that `zlib` — already in Node — is sufficient.
`npm run icons:generate` regenerates the set from the brand token.

### Constants duplicated between `public/sw.js` and `src/offline/pwa/service-worker.ts`

The worker is a classic script and cannot import from `src/`. The message vocabulary and
cache-name prefix therefore exist twice, and a mismatch would be silent at runtime — the
worker would simply ignore a `postMessage` it did not recognise. Three tests assert the two
declarations agree.

### `localStorage` for the install dismissal

Deliberate, and not a contradiction of section 4. That prohibition concerns the
application's financial dataset. This is one UI preference that may be lost without
consequence.

---

## 4. Business rules enforced

This group adds no financial rules. It is caching infrastructure, and the relevant
constraints are about not *undermining* the rules other groups own:

| Rule | Where |
| --- | --- |
| A sync response is never served from cache, so a queued operation is never falsely reported as synced | `decideStrategy`, `public/sw.js` |
| A financial figure is never served from cache while the network is available | navigation strategy is network-first |
| A filtered list is never answered with the unfiltered document — a wrong answer, not merely a stale one | exact-URL cache match, no `ignoreSearch` |
| Cached financial HTML does not outlive the session on a shared device | `clearPrivateCaches()` from `SignOutButton` |
| A sign-out never destroys unsynced financial records | cache cleanup is separate from `clearLocalDataForUser()` and does not call it |
| An unauthenticated redirect is never cached under the protected URL it was requested for | `isCacheableNavigationResponse`, and `precacheUrl` on the install path |
| Local data durability is requested rather than assumed | `requestPersistentStorage()`, called independently of worker support |

---

## 5. How it was verified

```powershell
npx tsc --noEmit      # clean
npx eslint .          # clean
npx prettier --check . # clean
npx vitest run        # 40 files, 948 tests
npx playwright test   # 8 tests, chromium
npx next build        # succeeds
```

Test count went from 872 to 948 (+76): 62 service-worker tests, 14 install-detection tests.

### The service worker is tested as shipped

`tests/offline/service-worker.test.ts` evaluates `public/sw.js` in a `node:vm` sandbox with
stand-in Cache and `fetch` implementations. It is not a TypeScript reimplementation — for
the rule these tests exist to protect, a copy that could drift from the real file is not an
acceptable gap. Faked: the Cache API, `fetch`, `clients`, and the event objects. Real: every
line of routing and strategy logic, plus Node's `Request`, `Response` and `Headers`.

What it proves: ten API paths are network-only and leave nothing behind; non-GET and
cross-origin are untouched; hashed chunks are served cache-first with one network call;
navigation prefers the network, falls back to the cached page, then redirects to `/offline`;
a filtered URL is never answered with the unfiltered document; redirected, non-200 and
non-HTML responses are refused on both the runtime and install paths; install survives a
404, precaches the offline page's assets, and does not activate itself; activation evicts
old versions and leaves other applications' caches alone.

### Browser verification

`tests/e2e/pwa-offline.spec.ts` runs against a **production build** — `next dev` disables
caching and serves unminified chunks, so a worker verified there is not the one that ships.

Covers the four "verify" checkboxes: the worker activates and takes control; the manifest is
installable and every icon it declares resolves; the iOS metadata is present; the app starts
and *hydrates* with the network off (proved by typing into a controlled input, which requires
React to be running); an unvisited route lands on our offline page; `/api/health` fails
offline rather than resolving from cache; and recovery is detected once the server answers.

Three of the bugs described in section 3 were found by these tests and would not have been
caught any other way.

### Manual verification against a running production server

Confirmed by request, unauthenticated: `/manifest.webmanifest` → 200 `application/manifest+json`;
`/sw.js` → 200 with `no-cache, no-store, must-revalidate`; `/offline` → 200 HTML with no
login redirect; icons and `/favicon.ico` → 200; `/dashboard` → 307 to sign-in.

Rendered `<head>` inspected to confirm `link[rel=manifest]`, three `icon` links, the
`apple-touch-icon`, and both capable tags.

### One fix that came out of that inspection

Next 15 renders `appleWebApp.capable` as the standardised `mobile-web-app-capable` only.
iOS below 16.4 does not read that name and opens the installed app inside Safari chrome
with an address bar. The legacy `apple-mobile-web-app-capable` is now declared explicitly
via `metadata.other`, and both tags were confirmed in the rendered output.

### What was *not* verified

- **Installation on a physical iPhone or a desktop browser.** The prerequisites are
  verified — manifest, `display: standalone`, a ≥192px icon, a maskable icon, scope,
  `start_url`, and the iOS meta tags — and Chromium's documented installability criteria
  are met. Actually tapping through Share → Add to Home Screen, and confirming the app
  opens without Safari chrome, needs a real device. Group 20 has separate checkboxes for
  this and they remain unticked.
- **iOS-specific service-worker behaviour.** The E2E suite is Chromium only. Safari has a
  smaller cache quota and evicts more aggressively.

---

## 6. Known gaps

| Gap | Deferred to |
| --- | --- |
| **Offline reads still come from the server.** An expense created offline is in IndexedDB and visible to `localStore.transactions.list()`, but `/transactions` and the dashboard will not show it until sync completes. This is the decision recorded in section 3, not an oversight — but it is not the experience section 31 describes. | Post-MVP, or group 20 if it is judged a blocker |
| **The static cache is never pruned.** Content-hashed chunks accumulate across deploys within a cache version. Bumping `VERSION` in `public/sw.js` clears everything, which is the current escape hatch. | Post-MVP |
| **No storage-quota handling.** `requestPersistentStorage()` is called and its result surfaced by `useServiceWorker()`, but nothing acts on a refusal or warns as quota fills. | Post-MVP |
| **`initialiseOfflineStorage()` is still uncalled.** Inherited from group 14. The sync engine's `start()` does `recoverInterrupted()`, so nothing is broken, but the function is dead code. | Group 20 cleanup |
| **E2E covers only Chromium and only public pages.** No authenticated journeys, no seeded data, no WebKit. | Group 19 |
| **Push notifications, background sync, badging.** Out of MVP scope. | Post-MVP |
| **`.env` still exists alongside `.env.local`.** Flagged by group 15 and untouched here. | Group 17 |

---

## 7. Notes for the next group

**Group 17 is security.** Three things this group introduced are its business:

1. **Cached HTML is a new attack surface.** Rendered dashboards live in the Cache API. The
   mitigation is `clearPrivateCaches()` on sign-out. Worth confirming there is no other way
   to end a session — an expired cookie, for instance — that leaves the cache behind. That
   is a real hole: the session dies, the HTML does not.
2. **`/offline`, `/sw.js`, `/manifest.webmanifest` and `/icons/` are public paths.** They
   were already in `PUBLIC_PATH_PREFIXES`; they are now actually used. None of them render
   user data. Verify that remains true if the offline page ever grows.
3. **Delete `.env`.** `.env.local` is authoritative and holds the working Atlas URI. Two
   files means a future edit has even odds of landing in the ignored one.

**Practical notes for anyone touching this code:**

- **Bump `VERSION` in `public/sw.js`** whenever what is cached changes shape. `activate`
  deletes any cache not in the current set, which is the only eviction mechanism there is.
- **`npx playwright test` builds first.** `webServer.command` runs `npm run build` so a
  stale `.next` cannot silently test the previous revision. Expect roughly a minute.
- **Chromium is installed but not the other browsers.** `npx playwright install webkit`
  when group 19 wants Safari's engine.
- **Do not add anything financial to `public/sw.js`.** If a change seems to require reading
  a transaction there, it belongs in `src/offline/`. The worker caches responses; IndexedDB
  holds data.
- **Test the worker, not a copy of it.** `tests/offline/service-worker.test.ts` loads the
  real file. Adding a rule to `decideStrategy` should come with a case there.
- **`useServerReachable()` is the honest connectivity check.** Prefer it over
  `useConnectivity()` anywhere the answer needs to be true rather than merely plausible.
  `useConnectivity()` is still right for a passive indicator.
