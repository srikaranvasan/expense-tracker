import { isOfflineStorageAvailable } from "../db/client";
import { localSyncOperationRepository } from "../repositories/sync-operation-repository";
import { localSyncMetadataRepository } from "../repositories/sync-metadata-repository";
import { isProbablyOnline, observeConnectivity } from "../network/connectivity";
import { pullServerChanges } from "./pull";
import type { PullDependencies } from "./pull";
import { pushPendingOperations } from "./push";
import type { PushDependencies } from "./push";
import { IDLE_SYNC_STATUS, deriveSyncState } from "./sync-status";
import type { SyncStatus } from "./sync-status";

/**
 * Coordinates push and pull.
 *
 * Responsibilities, and nothing beyond them: read the queue, send, interpret, apply
 * server changes, report status. No financial calculation happens here — that belongs to
 * the domain layer and to the server (docs/08-OFFLINE-SYNC.md section 45).
 *
 * **Push before pull, always.** Sending local work first means the server has the
 * client's changes before the client asks what changed. Pulling first would fetch a
 * server state that does not yet include the user's own unsent expense, and the pull
 * would then have to be careful not to clobber it — a problem entirely avoided by
 * ordering.
 */

export type SyncTrigger =
  "startup" | "reconnect" | "visibility" | "after-write" | "interval" | "manual";

export type SyncRunResult = {
  trigger: SyncTrigger;
  pushed: number;
  pulled: number;
  failed: number;
  conflicted: number;
  skipped: boolean;
  error: string | null;
};

export type SyncEngineDependencies = {
  push?: PushDependencies;
  pull?: PullDependencies;
  now?: () => Date;
  isOnline?: () => boolean;
};

/** How often a background attempt runs while the tab is open. */
export const SYNC_INTERVAL_MS = 60_000;

export class SyncEngine {
  private running = false;
  /** Set when a trigger arrives mid-run, so the request is not simply dropped. */
  private rerunRequested = false;
  private status: SyncStatus = IDLE_SYNC_STATUS;
  private listeners = new Set<(status: SyncStatus) => void>();
  private stopFunctions: Array<() => void> = [];
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly userId: string,
    private readonly dependencies: SyncEngineDependencies = {},
  ) {}

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /**
   * Starts automatic syncing.
   *
   * Several triggers, because no single one is reliable: `online` does not fire when a
   * laptop wakes on a different network, and browsers are free to ignore background work
   * entirely (docs/08-OFFLINE-SYNC.md section 14).
   */
  async start(): Promise<void> {
    if (!isOfflineStorageAvailable()) return;

    // Operations left claimed by a previous session would never be retried otherwise.
    await localSyncOperationRepository.recoverInterrupted(this.userId);
    await this.refreshStatus();

    this.stopFunctions.push(
      observeConnectivity((state) => {
        if (state === "online") void this.run("reconnect");
        else void this.refreshStatus();
      }),
    );

    this.interval = setInterval(() => void this.run("interval"), SYNC_INTERVAL_MS);

    await this.run("startup");
  }

  stop(): void {
    for (const stop of this.stopFunctions) stop();
    this.stopFunctions = [];

    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * One sync cycle.
   *
   * Concurrent runs are collapsed rather than queued: two overlapping cycles would claim
   * the same operations. A trigger that arrives mid-run sets `rerunRequested` so the work
   * still happens, once.
   */
  async run(trigger: SyncTrigger): Promise<SyncRunResult> {
    if (!isOfflineStorageAvailable()) {
      return this.skipped(trigger, "Local storage is not available.");
    }

    if (this.running) {
      this.rerunRequested = true;
      return this.skipped(trigger, null);
    }

    const online = (this.dependencies.isOnline ?? isProbablyOnline)();
    if (!online) {
      await this.refreshStatus();
      return this.skipped(trigger, null);
    }

    this.running = true;
    await this.refreshStatus(true);

    try {
      const push = await pushPendingOperations(this.userId, this.dependencies.push);

      // A transport failure means the network is gone; pulling would only fail too.
      const pull = push.offline
        ? { applied: 0, error: null as string | null }
        : await pullServerChanges(this.userId, this.dependencies.pull);

      const result: SyncRunResult = {
        trigger,
        pushed: push.completed,
        pulled: pull.applied,
        failed: push.failed,
        conflicted: push.conflicted,
        skipped: false,
        error: pull.error,
      };

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed.";
      await localSyncMetadataRepository.recordError(this.userId, message);
      return { ...this.skipped(trigger, message), skipped: false };
    } finally {
      this.running = false;
      await this.refreshStatus();

      if (this.rerunRequested) {
        this.rerunRequested = false;
        void this.run(trigger);
      }
    }
  }

  /** Re-attempts everything that was permanently rejected. A user action. */
  async retryFailed(): Promise<SyncRunResult> {
    await localSyncOperationRepository.retryFailed(this.userId);
    return this.run("manual");
  }

  private skipped(trigger: SyncTrigger, error: string | null): SyncRunResult {
    return {
      trigger,
      pushed: 0,
      pulled: 0,
      failed: 0,
      conflicted: 0,
      skipped: true,
      error,
    };
  }

  private async refreshStatus(syncing = false): Promise<void> {
    const counts = await localSyncOperationRepository.countByStatus(this.userId);
    const metadata = await localSyncMetadataRepository.get(this.userId);
    const online = (this.dependencies.isOnline ?? isProbablyOnline)();

    const pending = counts.pending + counts.processing;

    this.status = {
      state: deriveSyncState({ online, pending, failed: counts.failed, syncing }),
      pending,
      failed: counts.failed,
      lastSyncedAt: metadata?.lastPulledAt ?? metadata?.lastPushedAt ?? null,
      lastError: counts.failed > 0 ? (metadata?.lastError ?? null) : null,
    };

    for (const listener of this.listeners) listener(this.status);
  }
}

let engine: SyncEngine | null = null;

/**
 * The shared engine for the signed-in user.
 *
 * One per user. Switching users replaces it, so a stale engine cannot keep pushing the
 * previous user's queue.
 */
export function syncEngine(userId: string, dependencies?: SyncEngineDependencies): SyncEngine {
  if (!engine || engine.userId !== userId) {
    engine?.stop();
    engine = new SyncEngine(userId, dependencies);
  }
  return engine;
}

export function stopSyncEngine(): void {
  engine?.stop();
  engine = null;
}
