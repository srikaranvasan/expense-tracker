/**
 * Service worker registration, updates, and cache cleanup.
 *
 * The page side of `public/sw.js`. Kept in `offline/` rather than `features/` because it
 * is client infrastructure with no UI and no feature knowledge; the React wrappers live in
 * `features/pwa/components/`.
 *
 * The division of responsibility from docs/08-OFFLINE-SYNC.md section 48 holds here too:
 * this module manages *caching infrastructure*. It never touches financial records.
 */

export const SERVICE_WORKER_URL = "/sw.js";
export const SERVICE_WORKER_SCOPE = "/";

/**
 * Message vocabulary shared with `public/sw.js`.
 *
 * The worker cannot import this file — it is a classic worker script, not a module — so
 * the strings exist in two places. `tests/offline/service-worker.test.ts` asserts the
 * worker source declares exactly these values, which turns a silent mismatch (a
 * postMessage the worker quietly ignores) into a failing test.
 */
export const SERVICE_WORKER_MESSAGES = {
  skipWaiting: "SKIP_WAITING",
  clearPrivateCaches: "CLEAR_PRIVATE_CACHES",
  privateCachesCleared: "PRIVATE_CACHES_CLEARED",
} as const;

/** Also duplicated in `public/sw.js`, and asserted equal by the same test. */
export const CACHE_NAME_PREFIX = "expense-tracker-";

/** Caches holding rendered HTML for a signed-in user. Cleared on sign-out. */
export const PRIVATE_CACHE_PREFIX = `${CACHE_NAME_PREFIX}pages-`;

export type ServiceWorkerState =
  "unsupported" | "registering" | "ready" | "update-ready" | "failed";

export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

function isCacheStorageAvailable(): boolean {
  return typeof caches !== "undefined";
}

export type RegisterServiceWorkerOptions = {
  /**
   * Called when a new worker has installed and is waiting.
   *
   * The caller decides what to do about it. Reloading without asking would discard a
   * half-filled expense form.
   */
  onUpdateReady?: (registration: ServiceWorkerRegistration) => void;
};

/**
 * Registers the worker.
 *
 * Returns `null` rather than throwing when service workers are unavailable — Safari
 * private browsing, some embedded webviews, and any insecure origin. The app must stay
 * usable without a worker; it simply loses offline startup (docs/08-OFFLINE-SYNC.md
 * section 49).
 *
 * `updateViaCache: "none"` stops the browser answering its own request for `sw.js` from
 * the HTTP cache, which is the classic way to ship an update that nobody ever receives.
 * `next.config.ts` sends `no-store` for the same reason; both are needed, because the
 * header only helps once the request actually goes out.
 */
export async function registerServiceWorker(
  options: RegisterServiceWorkerOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
      updateViaCache: "none",
    });

    // A worker may already have been waiting when this page loaded, in which case no
    // "updatefound" event is coming.
    if (registration.waiting && navigator.serviceWorker.controller) {
      options.onUpdateReady?.(registration);
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        // "installed" while another worker is in control means a replacement shell is
        // ready. "installed" with no controller is the very first install, which is not
        // an update and must not prompt the user to reload.
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          options.onUpdateReady?.(registration);
        }
      });
    });

    return registration;
  } catch (error) {
    // A failed registration degrades the app; it must not break it.
    console.warn("Service worker registration failed.", error);
    return null;
  }
}

/**
 * Activates a waiting worker and reloads onto the new shell.
 *
 * The reload waits for `controllerchange`, so the page that comes back is served by the
 * new worker. Reloading first would be served by the old one and leave the update
 * waiting again.
 */
export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting;

  if (!waiting || !isServiceWorkerSupported()) {
    window.location.reload();
    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
    once: true,
  });

  waiting.postMessage({ type: SERVICE_WORKER_MESSAGES.skipWaiting });
}

/** Asks the browser to check for a new worker. Cheap, and a no-op when nothing changed. */
export async function checkForServiceWorkerUpdate(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE);
    await registration?.update();
  } catch {
    // An update check that fails is not worth surfacing; the next one will try again.
  }
}

function askWorkerToClearCaches(controller: ServiceWorker, timeoutMs: number): Promise<boolean> {
  if (typeof MessageChannel === "undefined") return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();

    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, timeoutMs);

    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      channel.port1.close();
      const type = (event.data as { type?: string } | null)?.type;
      resolve(type === SERVICE_WORKER_MESSAGES.privateCachesCleared);
    };

    controller.postMessage({ type: SERVICE_WORKER_MESSAGES.clearPrivateCaches }, [channel.port2]);
  });
}

/**
 * Deletes the page caches from the page itself.
 *
 * The fallback path, used when no worker is controlling this client. Matching by prefix
 * rather than exact name so a cache left behind by an older `VERSION` is removed too.
 */
async function deletePrivateCachesDirectly(): Promise<boolean> {
  if (!isCacheStorageAvailable()) return false;

  try {
    const names = await caches.keys();
    const removals = names
      .filter((name) => name.startsWith(PRIVATE_CACHE_PREFIX))
      .map((name) => caches.delete(name));

    await Promise.all(removals);
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes cached HTML that could show one user's finances to the next.
 *
 * Called on sign-out. The pages cache holds rendered dashboards and transaction lists,
 * complete with amounts and descriptions; on a shared device that must not survive the
 * session. Build output and icons are kept, so the next user can still start offline.
 *
 * This is the *cache* half of sign-out cleanup. The IndexedDB half is
 * `clearLocalDataForUser()`, which is separate on purpose: it destroys unsynced financial
 * records and must only ever run on an explicit user action.
 */
export async function clearPrivateCaches(timeoutMs = 2_000): Promise<boolean> {
  const controller = isServiceWorkerSupported() ? navigator.serviceWorker.controller : null;

  if (controller) {
    const acknowledged = await askWorkerToClearCaches(controller, timeoutMs);
    if (acknowledged) return true;
  }

  return deletePrivateCachesDirectly();
}

/**
 * Removes the worker and every cache it owns.
 *
 * Not used by the app. It exists for support: a client stuck on a broken shell can be
 * recovered from the console without clearing site data, which would also delete the
 * IndexedDB records that have not synced yet.
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (isServiceWorkerSupported()) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if (isCacheStorageAvailable()) {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith(CACHE_NAME_PREFIX)).map((name) => caches.delete(name)),
    );
  }
}
