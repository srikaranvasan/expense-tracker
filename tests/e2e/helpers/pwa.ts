import type { Page } from "@playwright/test";

/**
 * Service-worker readiness helpers.
 *
 * Shared by the PWA specs and the offline journey, because both have to know that the
 * worker is genuinely in charge before they cut the network. Getting this wrong produces
 * tests that pass or fail on timing rather than behaviour.
 */

/**
 * Waits until the worker has finished activating.
 *
 * `navigator.serviceWorker.ready` resolves as soon as there is an *active* worker, which can
 * still be in the `activating` state while its `activate` handler runs. Asserting anything
 * before that is a race: the precache is part of install, and the first navigation the worker
 * handles must find the offline page already stored.
 */
export async function waitForActivation(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker || worker.state === "activated") return;

    await new Promise<void>((resolve) => {
      const check = () => {
        if (worker.state === "activated") {
          worker.removeEventListener("statechange", check);
          resolve();
        }
      };
      worker.addEventListener("statechange", check);
      check();
    });
  });
}

/**
 * Waits until the worker is activated, controlling this page, and has precached the fallback.
 *
 * The precache check is the meaningful gate. Without it a test can go offline in the gap
 * between activation and `cache.add` completing, and then get the worker's inline last-resort
 * response instead of the real /offline page — a pass or fail decided by timing rather than by
 * behaviour.
 */
export async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await waitForActivation(page);

  await page.evaluate(async () => {
    if (navigator.serviceWorker.controller) return;
    // The worker claims clients during activation, which can land just after this point.
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
        once: true,
      });
      setTimeout(resolve, 5_000);
    });
  });

  await page.waitForFunction(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      if (await cache.match("/offline")) return true;
    }
    return false;
  });
}

/**
 * Visits a page while online so the worker stores its HTML.
 *
 * Needed before any offline test of an authenticated screen. The worker caches navigation
 * responses as they happen — it does not precache the application's pages, which would mean
 * guessing which ones matter and storing rendered financial data the user never asked for.
 * So "works offline" genuinely means "worked online first", and a test has to reproduce that.
 */
export async function warmPageCache(page: Page, paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
}

/* ------------------------------------------------------------------ *
 * Connectivity
 * ------------------------------------------------------------------ */

/** Key in `localStorage`, so the override survives navigation. */
const OFFLINE_FLAG = "__e2e_offline";

type OfflineWindow = Window & { __setOffline?: (offline: boolean) => void };

/**
 * Makes `navigator.onLine` controllable from the test.
 *
 * Must be called before the first navigation.
 *
 * ## Why this is necessary
 *
 * `context.setOffline(true)` really does cut the network — requests fail, which is what the
 * service-worker specs rely on. But in Chromium it does **not** flip `navigator.onLine`, and
 * that property is what `useConnectivity()` reads. So without this, the application still
 * believes it is online while every request fails: the expense form offers "Record expense"
 * instead of "Save on this device", and the offline path is unreachable from a test.
 *
 * This was first hit in group 16, where the offline page announced "You are back online"
 * while nothing could load.
 *
 * ## Why it is honest rather than a cheat
 *
 * The override is paired with a real `setOffline`, so both halves of being offline are true
 * at once: the browser reports no connection *and* there is none. That is the situation a
 * user is in. What it does not simulate is the awkward case the architecture warns about —
 * `navigator.onLine === true` with an unreachable server (docs/08-OFFLINE-SYNC.md section
 * 15) — which is covered separately by `useServerReachable` and the reconnect spec.
 *
 * The flag lives in `localStorage` because `addInitScript` runs afresh for every document,
 * so a plain variable would reset on the next navigation — and navigating while offline is
 * precisely what these tests do.
 */
export async function installConnectivityControl(page: Page): Promise<void> {
  await page.addInitScript((flag: string) => {
    const isOffline = () => {
      try {
        return localStorage.getItem(flag) === "1";
      } catch {
        return false;
      }
    };

    Object.defineProperty(navigator, "onLine", {
      get: () => !isOffline(),
      configurable: true,
    });

    (window as OfflineWindow).__setOffline = (offline: boolean) => {
      localStorage.setItem(flag, offline ? "1" : "0");
      // The application listens for these rather than polling, so the event is the signal
      // that matters.
      window.dispatchEvent(new Event(offline ? "offline" : "online"));
    };
  }, OFFLINE_FLAG);
}

async function setOffline(page: Page, offline: boolean): Promise<void> {
  await page.evaluate(
    ([flag, value]) => {
      const setter = (window as OfflineWindow).__setOffline;
      if (!setter) throw new Error("installConnectivityControl() was not called before loading");
      void flag;
      setter(value as boolean);
    },
    [OFFLINE_FLAG, offline] as const,
  );
}

/** Cuts the network and tells the application about it. */
export async function goOffline(
  page: Page,
  context: { setOffline: (offline: boolean) => Promise<void> },
): Promise<void> {
  await context.setOffline(true);
  await setOffline(page, true);
}

/** Restores the network and tells the application about it. */
export async function goOnline(
  page: Page,
  context: { setOffline: (offline: boolean) => Promise<void> },
): Promise<void> {
  await context.setOffline(false);
  await setOffline(page, false);
}
