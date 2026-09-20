import { describe, expect, it } from "vitest";
import { deriveSyncState, describeSyncState } from "./sync-status";

describe("deriveSyncState", () => {
  it("reports synced when nothing is queued", () => {
    expect(deriveSyncState({ online: true, pending: 0, failed: 0, syncing: false })).toBe("synced");
  });

  it("reports syncing while work is queued and the device is online", () => {
    expect(deriveSyncState({ online: true, pending: 3, failed: 0, syncing: false })).toBe(
      "syncing",
    );
    expect(deriveSyncState({ online: true, pending: 0, failed: 0, syncing: true })).toBe("syncing");
  });

  it("reports offline rather than an error when there is no connection", () => {
    // Queued work while offline is normal and must not look like a problem.
    expect(deriveSyncState({ online: false, pending: 5, failed: 0, syncing: false })).toBe(
      "offline",
    );
  });

  it("prioritises attention over everything, because only that needs the user", () => {
    expect(deriveSyncState({ online: true, pending: 5, failed: 1, syncing: true })).toBe(
      "attention",
    );
    // Even offline: a rejected change is still a rejected change.
    expect(deriveSyncState({ online: false, pending: 5, failed: 1, syncing: false })).toBe(
      "attention",
    );
  });
});

describe("describeSyncState", () => {
  const base = { pending: 0, failed: 0, lastSyncedAt: null, lastError: null };

  it("says nothing alarming about being offline", () => {
    const label = describeSyncState({ ...base, state: "offline", pending: 2 });

    expect(label).toBe("Offline · will sync later");
    expect(label).not.toMatch(/error|fail/i);
  });

  it("counts what needs attention, in singular and plural", () => {
    expect(describeSyncState({ ...base, state: "attention", failed: 1 })).toBe(
      "1 change needs attention",
    );
    expect(describeSyncState({ ...base, state: "attention", failed: 3 })).toBe(
      "3 changes need attention",
    );
  });

  it("labels the ordinary states plainly", () => {
    expect(describeSyncState({ ...base, state: "syncing" })).toBe("Syncing…");
    expect(describeSyncState({ ...base, state: "synced" })).toBe("Synced");
  });
});
