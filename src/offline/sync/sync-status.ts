/**
 * Sync state as the UI sees it.
 *
 * Deliberately small. The user needs to know whether their data is safe and whether
 * anything needs their attention — not how the queue works
 * (docs/08-OFFLINE-SYNC.md section 21).
 */

export type SyncState =
  /** Everything the client knows about has reached the server. */
  | "synced"
  /** Work is queued and the device is online; a push is due or running. */
  | "syncing"
  /** Work is queued and the device is offline. Nothing is wrong. */
  | "offline"
  /** At least one operation was permanently rejected. The user must act. */
  | "attention";

export type SyncStatus = {
  state: SyncState;
  pending: number;
  failed: number;
  lastSyncedAt: Date | null;
  /** Only set for `attention`, so the UI can explain the first problem. */
  lastError: string | null;
};

export const IDLE_SYNC_STATUS: SyncStatus = {
  state: "synced",
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  lastError: null,
};

/**
 * Derives the single state from the parts.
 *
 * Order matters: `attention` outranks everything, because a rejected expense is the one
 * thing the user has to know about. Being offline with queued work is *not* a problem
 * and must not be presented as one.
 */
export function deriveSyncState(input: {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
}): SyncState {
  if (input.failed > 0) return "attention";
  if (!input.online) return "offline";
  if (input.syncing || input.pending > 0) return "syncing";
  return "synced";
}

/** Short label for the status indicator. */
export function describeSyncState(status: SyncStatus): string {
  switch (status.state) {
    case "attention":
      return status.failed === 1
        ? "1 change needs attention"
        : `${status.failed} changes need attention`;
    case "offline":
      return status.pending > 0 ? "Offline · will sync later" : "Offline";
    case "syncing":
      return "Syncing…";
    default:
      return "Synced";
  }
}
