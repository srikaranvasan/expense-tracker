/**
 * Connectivity detection.
 *
 * `navigator.onLine` is a **hint**, not an answer. It reports whether the device has a
 * network interface, not whether this application's server can be reached: a captive
 * portal, a VPN drop, or a server outage all leave `onLine` true
 * (docs/08-OFFLINE-SYNC.md section 15).
 *
 * So there are two layers here. `isProbablyOnline()` is the cheap hint, used to decide
 * whether attempting a request is worth it. `probeServer()` is the real answer, and the
 * sync engine must still handle a request failing even when both said yes.
 */

export type ConnectivityState = "online" | "offline";

/** The browser's hint. Optimistic when unknown - during SSR, assume online. */
export function isProbablyOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

/**
 * Asks the server whether it is actually there.
 *
 * Uses `/api/health`, which touches the database, so a true result means the whole
 * write path is viable rather than just that a TCP connection succeeded.
 */
export async function probeServer(timeoutMs = 5000): Promise<boolean> {
  if (typeof fetch === "undefined") return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/health", {
      method: "GET",
      signal: controller.signal,
      // Never a cached answer: a cached 200 would report a server that is long gone.
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type ConnectivityListener = (state: ConnectivityState) => void;

/**
 * Subscribes to connectivity changes.
 *
 * Returns an unsubscribe function. Listens for `online`/`offline` and also for the tab
 * becoming visible again, because a laptop that slept through a network change fires no
 * event on wake - the visibility change is the only signal that anything happened
 * (docs/08-OFFLINE-SYNC.md section 14).
 */
export function observeConnectivity(listener: ConnectivityListener): () => void {
  if (typeof window === "undefined") return () => {};

  const notify = () => listener(isProbablyOnline() ? "online" : "offline");

  const onVisible = () => {
    if (document.visibilityState === "visible") notify();
  };

  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
