import { describe, expect, it } from "vitest";
import { inr } from "@tests/helpers/builders";
import { sumMoney } from "@/lib/money";
import {
  assertIsSharedSplit,
  assertPayerIsKnown,
  assertSharesMatchTotal,
  assertValidParticipantList,
  calculateSplitShares,
  hasPersonParticipant,
  participantRefKey,
  personParticipant,
  userParticipant,
  userShareOf,
} from "./splits";
import type { ComputedShare } from "./splits";

const ARUN = "personArun";
const VIJAY = "personVijay";

const user = userParticipant();
const arun = personParticipant(ARUN);
const vijay = personParticipant(VIJAY);

function shares(computed: readonly ComputedShare[]): string[] {
  return computed.map((share) => share.shareAmount.toFixedString());
}

function total(computed: readonly ComputedShare[]): string {
  return sumMoney(
    computed.map((share) => share.shareAmount),
    "INR",
  ).toFixedString();
}

describe("equal split", () => {
  it("divides an evenly divisible amount", () => {
    const computed = calculateSplitShares(inr("900"), {
      method: "equal",
      participants: [user, arun, vijay],
    });

    expect(shares(computed)).toEqual(["300.00", "300.00", "300.00"]);
    expect(total(computed)).toBe("900.00");
  });

  it("distributes the remainder so the total is preserved", () => {
    // ₹1,000 / 3 would be 333.33 each, losing a rupee.
    const computed = calculateSplitShares(inr("1000"), {
      method: "equal",
      participants: [user, arun, vijay],
    });

    expect(shares(computed)).toEqual(["333.34", "333.33", "333.33"]);
    expect(total(computed)).toBe("1000.00");
  });

  it("preserves the total across many awkward amounts and participant counts", () => {
    const people = [user, arun, vijay, personParticipant("p4"), personParticipant("p5")];

    for (const amount of ["0.01", "0.05", "1", "10.01", "999.99", "1234.57", "100000.03"]) {
      for (let count = 1; count <= people.length; count += 1) {
        const computed = calculateSplitShares(inr(amount), {
          method: "equal",
          participants: people.slice(0, count),
        });

        expect(computed).toHaveLength(count);
        expect(total(computed)).toBe(inr(amount).toFixedString());
      }
    }
  });

  it("handles two participants with an odd amount", () => {
    const computed = calculateSplitShares(inr("1201"), {
      method: "equal",
      participants: [user, arun],
    });

    expect(shares(computed)).toEqual(["600.50", "600.50"]);
  });

  it("assigns the share to the right participant", () => {
    const computed = calculateSplitShares(inr("1000"), {
      method: "equal",
      participants: [user, arun, vijay],
    });

    expect(computed[0]?.participant).toEqual(user);
    expect(computed[1]?.participant).toEqual(arun);
    expect(computed[2]?.participant).toEqual(vijay);
  });
});

describe("custom split", () => {
  it("uses the amounts exactly as entered", () => {
    const computed = calculateSplitShares(inr("1000"), {
      method: "custom",
      participants: [
        { participant: user, amount: "250" },
        { participant: arun, amount: "500" },
        { participant: vijay, amount: "250" },
      ],
    });

    expect(shares(computed)).toEqual(["250.00", "500.00", "250.00"]);
  });

  it("accepts an uneven distribution that still totals correctly", () => {
    const computed = calculateSplitShares(inr("1000"), {
      method: "custom",
      participants: [
        { participant: user, amount: "0.01" },
        { participant: arun, amount: "999.99" },
      ],
    });

    expect(total(computed)).toBe("1000.00");
  });

  it("rejects amounts that add up to less than the total", () => {
    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "custom",
        participants: [
          { participant: user, amount: "400" },
          { participant: arun, amount: "400" },
        ],
      }),
    ).toThrow(/add up to the expense total/i);
  });

  it("rejects amounts that add up to more than the total", () => {
    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "custom",
        participants: [
          { participant: user, amount: "600" },
          { participant: arun, amount: "600" },
        ],
      }),
    ).toThrow(/add up to the expense total/i);
  });

  it("reports the expected and actual totals so the form can explain the gap", () => {
    try {
      calculateSplitShares(inr("1000"), {
        method: "custom",
        participants: [
          { participant: user, amount: "400" },
          { participant: arun, amount: "400" },
        ],
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      const details = (error as { details?: Record<string, unknown> }).details ?? {};
      expect(details.expectedTotal).toBe("1000.00");
      expect(details.actualTotal).toBe("800.00");
      expect(details.currency).toBe("INR");
    }
  });

  it("rejects a zero or negative share", () => {
    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "custom",
        participants: [
          { participant: user, amount: "1000" },
          { participant: arun, amount: "0" },
        ],
      }),
    ).toThrow(/greater than zero/i);

    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "custom",
        participants: [
          { participant: user, amount: "1100" },
          { participant: arun, amount: "-100" },
        ],
      }),
    ).toThrow(/greater than zero/i);
  });

  it("rejects a share that is more precise than the currency allows", () => {
    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "custom",
        participants: [
          { participant: user, amount: "500.005" },
          { participant: arun, amount: "499.995" },
        ],
      }),
    ).toThrow(/more precise/i);
  });
});

describe("percentage split", () => {
  it("applies whole percentages", () => {
    const computed = calculateSplitShares(inr("1000"), {
      method: "percentage",
      participants: [
        { participant: user, percentage: "50" },
        { participant: arun, percentage: "30" },
        { participant: vijay, percentage: "20" },
      ],
    });

    expect(shares(computed)).toEqual(["500.00", "300.00", "200.00"]);
    expect(total(computed)).toBe("1000.00");
  });

  it("keeps the total exact when a percentage does not divide cleanly", () => {
    // 33.33% of ₹1,000 is not a whole number of paise.
    const computed = calculateSplitShares(inr("1000"), {
      method: "percentage",
      participants: [
        { participant: user, percentage: "33.33" },
        { participant: arun, percentage: "33.33" },
        { participant: vijay, percentage: "33.34" },
      ],
    });

    expect(total(computed)).toBe("1000.00");
  });

  it("handles a single participant at 100%", () => {
    const computed = calculateSplitShares(inr("450"), {
      method: "percentage",
      participants: [{ participant: arun, percentage: "100" }],
    });

    expect(shares(computed)).toEqual(["450.00"]);
  });

  it("rejects percentages that do not add up to 100", () => {
    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "percentage",
        participants: [
          { participant: user, percentage: "50" },
          { participant: arun, percentage: "30" },
        ],
      }),
    ).toThrow(/add up to 100/i);
  });

  it("names the actual total in the error so the form can show the gap", () => {
    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "percentage",
        participants: [
          { participant: user, percentage: "60" },
          { participant: arun, percentage: "60" },
        ],
      }),
    ).toThrow(/120/);
  });

  it("rejects a zero percentage", () => {
    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "percentage",
        participants: [
          { participant: user, percentage: "100" },
          { participant: arun, percentage: "0" },
        ],
      }),
    ).toThrow(/greater than zero/i);
  });

  it("rejects a percentage above 100", () => {
    expect(() =>
      calculateSplitShares(inr("1000"), {
        method: "percentage",
        participants: [{ participant: user, percentage: "150" }],
      }),
    ).toThrow(/more than 100/i);
  });

  it("preserves the total across awkward percentage sets", () => {
    const sets = [
      ["10", "20", "70"],
      ["33.33", "33.33", "33.34"],
      ["0.01", "0.01", "99.98"],
      ["16.67", "16.67", "66.66"],
    ];

    for (const set of sets) {
      const computed = calculateSplitShares(inr("999.99"), {
        method: "percentage",
        participants: set.map((percentage, index) => ({
          participant: index === 0 ? user : personParticipant(`p${index}`),
          percentage,
        })),
      });

      expect(total(computed)).toBe("999.99");
    }
  });
});

describe("assertValidParticipantList", () => {
  it("accepts a valid list", () => {
    expect(() => assertValidParticipantList([user, arun])).not.toThrow();
  });

  it("rejects an empty list", () => {
    expect(() => assertValidParticipantList([])).toThrow(/at least one participant/i);
  });

  it("rejects a duplicate person", () => {
    expect(() => assertValidParticipantList([arun, personParticipant(ARUN)])).toThrow(
      /cannot be added twice/i,
    );
  });

  it("rejects the user appearing twice", () => {
    expect(() => assertValidParticipantList([user, userParticipant()])).toThrow(
      /cannot be added twice/i,
    );
  });

  it("rejects more participants than the limit allows", () => {
    const many = Array.from({ length: 60 }, (_, index) => personParticipant(`p${index}`));
    expect(() => assertValidParticipantList(many)).toThrow(/more than/i);
  });
});

describe("assertIsSharedSplit", () => {
  it("accepts a list containing another person", () => {
    expect(() => assertIsSharedSplit([user, arun])).not.toThrow();
  });

  it("accepts a list of only other people", () => {
    // "I paid ₹600 for Arun and Vijay" - the user's own share is zero.
    expect(() => assertIsSharedSplit([arun, vijay])).not.toThrow();
  });

  it("rejects a list containing only the user", () => {
    expect(() => assertIsSharedSplit([user])).toThrow(/at least one other person/i);
  });
});

describe("assertSharesMatchTotal", () => {
  it("accepts shares that sum to the total", () => {
    expect(() =>
      assertSharesMatchTotal(inr("1000"), [
        { shareAmount: inr("600") },
        { shareAmount: inr("400") },
      ]),
    ).not.toThrow();
  });

  it("rejects a mismatch of a single paisa", () => {
    expect(() =>
      assertSharesMatchTotal(inr("1000"), [
        { shareAmount: inr("600") },
        { shareAmount: inr("399.99") },
      ]),
    ).toThrow(/add up to the expense total/i);
  });
});

describe("assertPayerIsKnown", () => {
  it("accepts the user as payer", () => {
    expect(() => assertPayerIsKnown({ type: "user", personId: null }, new Set())).not.toThrow();
  });

  it("accepts a resolved person as payer", () => {
    expect(() =>
      assertPayerIsKnown({ type: "person", personId: ARUN }, new Set([ARUN])),
    ).not.toThrow();
  });

  it("rejects an unresolved person as payer", () => {
    expect(() => assertPayerIsKnown({ type: "person", personId: ARUN }, new Set([VIJAY]))).toThrow(
      /could not be found/i,
    );
  });
});

describe("helpers", () => {
  it("builds a stable participant key", () => {
    expect(participantRefKey(user)).toBe("user");
    expect(participantRefKey(arun)).toBe(`person:${ARUN}`);
  });

  it("detects a person participant", () => {
    expect(hasPersonParticipant([user])).toBe(false);
    expect(hasPersonParticipant([user, arun])).toBe(true);
  });

  it("sums the user's share", () => {
    const computed = calculateSplitShares(inr("900"), {
      method: "equal",
      participants: [user, arun, vijay],
    });

    expect(userShareOf(computed, "INR").toFixedString()).toBe("300.00");
  });

  it("reports a zero user share when the user is not a participant", () => {
    const computed = calculateSplitShares(inr("600"), {
      method: "equal",
      participants: [arun, vijay],
    });

    expect(userShareOf(computed, "INR").isZero()).toBe(true);
  });
});
