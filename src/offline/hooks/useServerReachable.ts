"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { observeConnectivity, probeServer } from "../network/connectivity";

export type Reachability = "unknown" | "reachable" | "unreachable";

/** How often to retry while the server is still unreachable. */
const DEFAULT_INTERVAL_MS = 5_000;

export type ServerReachability = {
  status: Reachability;
  /** True while a probe is in flight, so the UI can avoid flickering between states. */
  checking: boolean;
  /** Probe now. For a "Try again" button. */
  check: () => void;
};

/**
 * Whether the server can actually be reached.
 *
 * The distinction from `useConnectivity()` matters. That hook reports `navigator.onLine`,
 * which only says the device has a network interface: a captive portal, a VPN drop, or a
 * server outage all leave it `true` (docs/08-OFFLINE-SYNC.md section 15). This hook asks
 * the server, via `/api/health`, and therefore knows the difference.
 *
 * It starts at `"unknown"` rather than `"reachable"`. The caller is typically a screen that
 * exists *because* a request already failed, and optimistically announcing a working
 * connection there would contradict what the user just experienced.
 *
 * Polling stops as soon as the server answers. There is no reason to keep probing a
 * connection that has come back, and the sync engine takes over from that point.
 */
export function useServerReachable(intervalMs = DEFAULT_INTERVAL_MS): ServerReachability {
  const [status, setStatus] = useState<Reachability>("unknown");
  const [checking, setChecking] = useState(false);

  // Guards against overlapping probes: the interval, a connectivity event and a click can
  // all fire at once, and three simultaneous requests would answer one question.
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const runProbe = useCallback(async () => {
    if (inFlight.current) return;

    inFlight.current = true;
    setChecking(true);

    try {
      const reachable = await probeServer();
      if (mounted.current) setStatus(reachable ? "reachable" : "unreachable");
    } finally {
      inFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void runProbe();

    // The browser's hint is still useful as a *trigger*: it is a good moment to ask, even
    // though it is not an answer.
    const stopObserving = observeConnectivity((state) => {
      if (state === "online") void runProbe();
      else if (mounted.current) setStatus("unreachable");
    });

    return () => {
      mounted.current = false;
      stopObserving();
    };
  }, [runProbe]);

  useEffect(() => {
    if (status === "reachable") return;

    const timer = setInterval(() => void runProbe(), intervalMs);
    return () => clearInterval(timer);
  }, [status, intervalMs, runProbe]);

  return { status, checking, check: () => void runProbe() };
}
