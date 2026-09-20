import { describe, expect, it } from "vitest";
import { buildAccount, buildCreditCard, inr } from "@tests/helpers/builders";
import {
  InvalidAccountError,
  InvalidAmountError,
  InvalidTransferError,
} from "@/domain/shared/errors";
import { money } from "@/lib/money";
import {
  assertDestinationIsNotCreditCard,
  assertValidTransferAccounts,
  assertValidTransferAmount,
} from "./transfer-rules";

describe("assertValidTransferAmount", () => {
  it("accepts a positive amount at the currency's precision", () => {
    expect(() => assertValidTransferAmount(inr("5000"))).not.toThrow();
    expect(() => assertValidTransferAmount(inr("0.01"))).not.toThrow();
  });

  it("rejects zero", () => {
    expect(() => assertValidTransferAmount(inr("0"))).toThrow(InvalidAmountError);
  });

  it("rejects a negative amount", () => {
    // Direction is expressed by which account is the source, never by the sign.
    expect(() => assertValidTransferAmount(inr("-500"))).toThrow(InvalidAmountError);
  });

  it("rejects more precision than the currency supports", () => {
    expect(() => assertValidTransferAmount(inr("100.001"))).toThrow(InvalidAmountError);
  });
});

describe("assertValidTransferAccounts", () => {
  it("accepts a transfer between two usable accounts of the same currency", () => {
    const from = buildAccount({ name: "HDFC Savings" });
    const to = buildAccount({ name: "Cash", type: "cash" });

    expect(() => assertValidTransferAccounts(from, to, inr("2000"))).not.toThrow();
  });

  it("rejects a transfer to the same account", () => {
    const account = buildAccount();

    expect(() => assertValidTransferAccounts(account, account, inr("2000"))).toThrow(
      InvalidTransferError,
    );
  });

  it("rejects an archived source account", () => {
    const from = buildAccount({ archivedAt: new Date("2026-01-01T00:00:00.000Z") });
    const to = buildAccount({ type: "cash" });

    expect(() => assertValidTransferAccounts(from, to, inr("2000"))).toThrow(InvalidAccountError);
  });

  it("rejects an archived destination account", () => {
    const from = buildAccount();
    const to = buildAccount({ type: "cash", archivedAt: new Date("2026-01-01T00:00:00.000Z") });

    expect(() => assertValidTransferAccounts(from, to, inr("2000"))).toThrow(InvalidAccountError);
  });

  it("rejects accounts that use different currencies", () => {
    const from = buildAccount({ currency: "INR", openingBalance: inr("0") });
    const to = buildAccount({
      type: "cash",
      currency: "USD",
      openingBalance: money("0", "USD"),
    });

    expect(() => assertValidTransferAccounts(from, to, inr("2000"))).toThrow(InvalidTransferError);
  });

  it("rejects an amount whose currency does not match the accounts", () => {
    const from = buildAccount();
    const to = buildAccount({ type: "cash" });

    expect(() => assertValidTransferAccounts(from, to, money("2000", "USD"))).toThrow(
      InvalidAccountError,
    );
  });

  it("allows a credit card as the source, which is a cash advance", () => {
    const from = buildCreditCard();
    const to = buildAccount({ type: "bank" });

    expect(() => assertValidTransferAccounts(from, to, inr("2000"))).not.toThrow();
  });

  it("rejects a credit card as the destination", () => {
    const from = buildAccount();
    const to = buildCreditCard();

    expect(() => assertValidTransferAccounts(from, to, inr("2000"))).toThrow(InvalidTransferError);
  });
});

describe("assertDestinationIsNotCreditCard", () => {
  it("names the card so the user knows which record to use instead", () => {
    const card = buildCreditCard({ name: "Amex Platinum" });

    expect(() => assertDestinationIsNotCreditCard(card)).toThrow(/Amex Platinum/);
    expect(() => assertDestinationIsNotCreditCard(card)).toThrow(/card payment/);
  });

  it("permits every non-card account type", () => {
    expect(() => assertDestinationIsNotCreditCard(buildAccount({ type: "bank" }))).not.toThrow();
    expect(() => assertDestinationIsNotCreditCard(buildAccount({ type: "cash" }))).not.toThrow();
  });
});
