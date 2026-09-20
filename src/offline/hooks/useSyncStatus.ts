"use client";

import { useCallback, useEffect, useState } from "react";
import { isOfflineStorageAvailable } from "../db/client";
import { syncEngine, stopSyncEngine } from "../sync/sync-engine";
import { IDLE_SYNC_STATUS } from "../sync/sync-status";
import type { SyncStatus } from "../sync/sync-status";

/**
 * Starts the sync engine for the signed-in user and exposes its status.
 *
 * Mounted once, in the app shell. Starting it per-screen would run several engines that
 * each try to claim the same queued operations.
 */
export function useSyncStatus(userId: string): {
  status: SyncStatus;
  syncNow: () => void;
  retryFailed: () => void;
} {
  const [status, setStatus] = useState<SyncStatus>(IDLE_SYNC_STATUS);

  useEffect(() => {
    if (!isOfflineStorageAvailable()) return;

    const engine = syncEngine(userId);
    const unsubscribe = engine.subscribe(setStatus);
    void engine.start();

    return () => {
      unsubscribe();
      // Stopped on unmount so a signed-out session leaves no timer running.
      stopSyncEngine();
    };
  }, [userId]);

  const syncNow = useCallback(() => {
    if (!isOfflineStorageAvailable()) return;
    void syncEngine(userId).run("manual");
  }, [userId]);

  const retryFailed = useCallback(() => {
    if (!isOfflineStorageAvailable()) return;
    void syncEngine(userId).retryFailed();
  }, [userId]);

  return { status, syncNow, retryFailed };
}
