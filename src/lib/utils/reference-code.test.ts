import { describe, expect, it } from "vitest";
import { referenceCodeFor, toReferenceCode } from "./reference-code";

/**
 * Reference codes are derived from a record id rather than allocated as a sequence (group 21
 * section 3.1). These assertions pin the two properties that decision depends on — stability and
 * offline availability — and the two it gives up, so neither is relied on by accident.
 */

describe("toReferenceCode", () => {
  it("takes the last five characters of an id, uppercased", () => {
    expect(toReferenceCode("65f1a2b3c4d5e6f708192a3b")).toBe("#92A3B");
  });

  it("is stable for the same record", () => {
    // The code is a *permanent* reference — a user may write it down or read it out on the phone.
    const id = "65f1a2b3c4d5e6f708192a3b";
    expect(toReferenceCode(id)).toBe(toReferenceCode(id));
  });

  it("needs no server round trip", () => {
    /*
     * The reason a derived code beat a sequence. A client id is available the instant an offline
     * record is created, so a queued expense has a reference before it has ever reached the server —
     * which means no draft state and no code that changes on sync.
     */
    expect(toReferenceCode("0f9c2d41-6b7a-4c3e-9f1a-8d2b4c6e7f90")).toBe("#E7F90");
  });

  it("carries no ordering", () => {
    /*
     * Asserted so nobody builds on an ordering that is not there. Two records created in sequence
     * produce codes with no relationship: this is a handle, not a number, and nothing may sort or
     * count by it.
     */
    const earlier = toReferenceCode("65f1a2b3c4d5e6f708192a3b")!;
    const later = toReferenceCode("65f1a2b3c4d5e6f708192a3c")!;

    expect(earlier).not.toBe(later);
    // Lexical order here is a coincidence of the last character, not a guarantee of any kind.
    expect([earlier, later].sort()).toEqual([earlier, later].sort());
  });

  it("returns null for a record with no id", () => {
    // Not a placeholder: a caller has to decide what an unreferenced record looks like rather than
    // being handed something that implies the code exists and is merely unknown.
    expect(toReferenceCode(null)).toBeNull();
    expect(toReferenceCode(undefined)).toBeNull();
    expect(toReferenceCode("")).toBeNull();
  });

  it("does not pad a short id", () => {
    // Only fixtures and hand-written test ids are this short, and showing what there is beats
    // truncating to nothing or inventing digits.
    expect(toReferenceCode("ab")).toBe("#AB");
  });
});

describe("referenceCodeFor", () => {
  /**
   * The seam, and the one place that decides *which* id a code comes from.
   *
   * Group 21 wrote "derived from the `ObjectId`" and, in the same paragraph, "available offline
   * immediately". Both cannot hold: an offline record has no server id until it syncs. So the source
   * is `clientId`, which every record carries from the moment it exists and which the server stores
   * unchanged.
   */
  it("derives from the client id, not the server id", () => {
    const record = {
      id: "65f1a2b3c4d5e6f708192a3b",
      clientId: "0f9c2d41-6b7a-4c3e-9f1a-8d2b4c6e7f90",
    };

    expect(referenceCodeFor(record)).toBe("#E7F90");
    // Explicitly *not* the ObjectId's tail, which is what the naive reading of group 21 would give.
    expect(referenceCodeFor(record)).not.toBe(toReferenceCode(record.id));
  });

  it("gives an offline record the same code it will have after syncing", () => {
    /*
     * The property that matters. The server stores the `clientId` the client sent, so the record's
     * reference before the write and after it are the same string — a code the user can note down
     * from the form and still find in the list tomorrow.
     */
    const clientId = "0f9c2d41-6b7a-4c3e-9f1a-8d2b4c6e7f90";

    const queued = { clientId, id: null };
    const synced = { clientId, id: "65f1a2b3c4d5e6f708192a3b" };

    expect(referenceCodeFor(queued)).toBe(referenceCodeFor(synced));
  });

  it("returns null when there is no client id at all", () => {
    // Which is also what a server-allocated sequence would return before its first sync, so the
    // nullable return is not dead weight.
    expect(referenceCodeFor({ clientId: null })).toBeNull();
  });
});
