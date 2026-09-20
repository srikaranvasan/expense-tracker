"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyServiceWorkerUpdate,
  checkForServiceWorkerUpdate,
  isServiceWorkerSupported,
  registerServiceWorker,
} from "../pwa/service-worker";
import type { ServiceWorkerState } from "../pwa/service-worker";
import { requestPersistentStorage } from "../db/client";

/** How often to ask whether a new shell has been deployed while the tab stays open. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type ServiceWorkerStatus = {
  state: ServiceWorkerState;
  /** True when a new shell has installed and is waiting for a reload. */
  updateReady: boolean;
  /** Whether the browser promised not to evict local data under storage pressure. */
  storagePersisted: boolean;
  applyUpdate: () => void;
};

/**
 * Registers the service worker and reports its state.
 *
 * Mounted once, near the root. Registering per-screen would be harmless (the browser
 * deduplicates by URL and scope) but the update listeners would stack up.
 *
 * Registration is deferred to an effect rather than run during render because it is a
 * browser-only side effect, and because the first paint should not wait on it: the worker
 * only matters for the *next* visit.
 */
export function useServiceWorker(): ServiceWorkerStatus {
  const [state, setState] = useState<ServiceWorkerState>("registering");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [storagePersisted, setStoragePersisted] = useState(false);

  /*
   * Persistence is requested independently of the service worker.
   *
   * Deliberately its own effect: a browser without service workers still has IndexedDB,
   * and that is exactly the client whose unsynced expenses are most at risk of being
   * evicted. Tying the request to a successful registration would skip it there.
   *
   * This is also the first caller of `requestPersistentStorage()` — group 14 wrote it and
   * nothing had invoked it until now. Here, rather than at sign-in, because Chromium is
   * most likely to grant it to an installed app, and asking alongside installation reads
   * as one decision instead of two.
   *
   * A refusal is not an error. It means IndexedDB is evictable, which raises the stakes on
   * syncing promptly but changes nothing about correctness (docs/08-OFFLINE-SYNC.md
   * section 47).
   */
  useEffect(() => {
    let cancelled = false;

    void requestPersistentStorage().then((persisted) => {
      if (!cancelled) setStoragePersisted(persisted);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      setState("unsupported");
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await registerServiceWorker({
        onUpdateReady: (updated) => {
          if (cancelled) return;
          setRegistration(updated);
          setState("update-ready");
        },
      });

      if (cancelled) return;

      if (!result) {
        setState("failed");
        return;
      }

      setRegistration(result);
      // Do not overwrite an update that was already detected during registration.
      setState((current) => (current === "update-ready" ? current : "ready"));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === "unsupported" || state === "failed") return;

    // Long-lived tabs are common for this app — it is the sort of thing left open on a
    // second monitor — so a periodic check is the only way such a client ever learns
    // about a deploy.
    const interval = setInterval(
      () => void checkForServiceWorkerUpdate(),
      UPDATE_CHECK_INTERVAL_MS,
    );

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkForServiceWorkerUpdate();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state]);

  const applyUpdate = useCallback(() => {
    if (registration) applyServiceWorkerUpdate(registration);
  }, [registration]);

  return {
    state,
    updateReady: state === "update-ready",
    storagePersisted,
    applyUpdate,
  };
}
