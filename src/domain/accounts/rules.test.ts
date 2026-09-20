import { describe, expect, it } from "vitest";
import { money } from "@/lib/money";
import type { Account } from "./entities";
import {
  assertAccountCurrencyMatches,
  assertAccountIsCreditCard,
  assertAccountIsNotCreditCard,
  assertAccountUsable,
  assertValidAccountDraft,
} from "./rules";

const inr = (value: string) => money(value, "INR");

function buildAccount(overrides: Partial<Account> = {}): Account {
  const base: Account = {
    id: "acc1",
    userId: "user1",
    clientId: "client1",
    name: "HDFC Savings",
    type: "bank",
    currency: "INR",
    openingBalance: inr("0"),
    institutionName: null,
    creditCard: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    syncVersion: 1,
  };
  return { ...base, ...overrides };
}

describe("assertValidAccountDraft", () => {
  it("accepts a bank account in the user's currency", () => {
    expect(() =>
      assertValidAccountDraft(
        { type: "bank", currency: "INR", openingBalance: inr("50000") },
        "INR",
      ),
    ).not.toThrow();
  });

  it("accepts a negative opening balance for a bank account", () => {
    expect(() =>
      assertValidAccountDraft(
        { type: "bank", currency: "INR", openingBalance: inr("-500") },
        "INR",
      ),
    ).not.toThrow();
  });

  it("rejects a currency that differs from the user's", () => {
    expect(() =>
      assertValidAccountDraft(
        { type: "bank", currency: "USD", openingBalance: money("100", "USD") },
        "INR",
      ),
    ).toThrow(/must use your currency/i);
  });

  it("rejects an opening balance with too many decimal places", () => {
    expect(() =>
      assertValidAccountDraft(
        { type: "cash", currency: "INR", openingBalance: inr("10.005") },
        "INR",
      ),
    ).toThrow(/decimal places/i);
  });

  it("rejects an absurdly large opening balance", () => {
    expect(() =>
      assertValidAccountDraft(
        { type: "bank", currency: "INR", openingBalance: inr("99999999999999") },
        "INR",
      ),
    ).toThrow(/exceed/i);
  });

  it("rejects card-only fields on a non-card account", () => {
    expect(() =>
      assertValidAccountDraft(
        { type: "bank", currency: "INR", openingBalance: inr("0"), creditLimit: inr("100000") },
        "INR",
      ),
    ).toThrow(/only credit-card accounts have a credit limit/i);

    expect(() =>
      assertValidAccountDraft(
        { type: "cash", currency: "INR", openingBalance: inr("0"), statementDay: 5 },
        "INR",
      ),
    ).toThrow(/statement day/i);
  });

  describe("credit cards", () => {
    it("accepts a card with a limit and statement dates", () => {
      expect(() =>
        assertValidAccountDraft(
          {
            type: "credit_card",
            currency: "INR",
            openingBalance: inr("18500"),
            creditLimit: inr("150000"),
            statementDay: 5,
            paymentDueDay: 25,
          },
          "INR",
        ),
      ).not.toThrow();
    });

    it("requires a credit limit", () => {
      expect(() =>
        assertValidAccountDraft(
          { type: "credit_card", currency: "INR", openingBalance: inr("0") },
          "INR",
        ),
      ).toThrow(/needs a credit limit/i);
    });

    it("rejects a zero or negative credit limit", () => {
      expect(() =>
        assertValidAccountDraft(
          {
            type: "credit_card",
            currency: "INR",
            openingBalance: inr("0"),
            creditLimit: inr("0"),
          },
          "INR",
        ),
      ).toThrow(/greater than zero/i);

      expect(() =>
        assertValidAccountDraft(
          {
            type: "credit_card",
            currency: "INR",
            openingBalance: inr("0"),
            creditLimit: inr("-1"),
          },
          "INR",
        ),
      ).toThrow();
    });

    it("rejects a negative opening outstanding balance", () => {
      expect(() =>
        assertValidAccountDraft(
          {
            type: "credit_card",
            currency: "INR",
            openingBalance: inr("-100"),
            creditLimit: inr("100000"),
          },
          "INR",
        ),
      ).toThrow(/must not be negative/i);
    });

    it("rejects an out-of-range statement or due day", () => {
      for (const day of [0, 32, -1, 1.5]) {
        expect(() =>
          assertValidAccountDraft(
            {
              type: "credit_card",
              currency: "INR",
              openingBalance: inr("0"),
              creditLimit: inr("100000"),
              statementDay: day,
            },
            "INR",
          ),
        ).toThrow(/statement day/i);
      }
    });

    it("allows omitting the statement and due days", () => {
      expect(() =>
        assertValidAccountDraft(
          {
            type: "credit_card",
            currency: "INR",
            openingBalance: inr("0"),
            creditLimit: inr("100000"),
            statementDay: null,
            paymentDueDay: null,
          },
          "INR",
        ),
      ).not.toThrow();
    });
  });
});

describe("assertAccountUsable", () => {
  it("accepts an active account", () => {
    expect(() => assertAccountUsable(buildAccount())).not.toThrow();
  });

  it("rejects an archived account", () => {
    expect(() => assertAccountUsable(buildAccount({ archivedAt: new Date() }))).toThrow(
      /archived/i,
    );
  });
});

describe("account type assertions", () => {
  it("requires a credit card where one is expected", () => {
    expect(() => assertAccountIsCreditCard(buildAccount({ type: "credit_card" }))).not.toThrow();
    expect(() => assertAccountIsCreditCard(buildAccount({ type: "bank" }))).toThrow(
      /not a credit-card account/i,
    );
  });

  it("rejects a credit card where one is not allowed", () => {
    expect(() =>
      assertAccountIsNotCreditCard(buildAccount({ type: "credit_card" }), "cannot be the source"),
    ).toThrow(/credit card/i);
    expect(() =>
      assertAccountIsNotCreditCard(buildAccount({ type: "bank" }), "cannot be the source"),
    ).not.toThrow();
  });
});

describe("assertAccountCurrencyMatches", () => {
  it("accepts a matching currency", () => {
    expect(() => assertAccountCurrencyMatches(buildAccount(), inr("100"))).not.toThrow();
  });

  it("rejects a mismatched currency", () => {
    expect(() => assertAccountCurrencyMatches(buildAccount(), money("100", "USD"))).toThrow(/INR/);
  });
});
