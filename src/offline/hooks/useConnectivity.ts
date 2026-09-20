"use client";

import { useEffect, useState } from "react";
import { isProbablyOnline, observeConnectivity } from "../network/connectivity";
import type { ConnectivityState } from "../network/connectivity";

/**
 * Connectivity as React state.
 *
 * Starts as `"online"` on purpose, and only corrects itself after mount. The server
 * cannot know the client's connectivity, so rendering "offline" on the server and
 * "online" on the client would be a hydration mismatch — and the first paint would
 * flash a warning at a user who is perfectly connected.
 */
export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>("online");

  useEffect(() => {
    setState(isProbablyOnline() ? "online" : "offline");
    return observeConnectivity(setState);
  }, []);

  return state;
}

export function useIsOffline(): boolean {
  return useConnectivity() === "offline";
}
