import { describe, expect, it } from "vitest";
import { buildAccount, buildCreditCard, inr } from "@tests/helpers/builders";
import {
  InvalidAccountError,
  InvalidAmountError,
  InvalidCreditCardPaymentError,
} from "@/domain/shared/errors";
import { money } from "@/lib/money";
import {
  assertValidCardPaymentAccounts,
  assertValidCardPaymentAmount,
  isOverpayment,
} from "./card-payment-rules";

describe("assertValidCardPaymentAmount", () => {
  it("accepts a positive amount at the currency's precision", () => {
    expect(() => assertValidCardPaymentAmount(inr("15000"))).not.toThrow();
  });

  it("rejects zero and negative amounts", () => {
    expect(() => assertValidCardPaymentAmount(inr("0"))).toThrow(InvalidAmountError);
    expect(() => assertValidCardPaymentAmount(inr("-100"))).toThrow(InvalidAmountError);
  });

  it("rejects more precision than the currency supports", () => {
    expect(() => assertValidCardPaymentAmount(inr("100.001"))).toThrow(InvalidAmountError);
  });
});

describe("assertValidCardPaymentAccounts", () => {
  it("accepts a bank account paying a credit card", () => {
    const bank = buildAccount({ name: "HDFC Savings" });
    const card = buildCreditCard();

    expect(() => assertValidCardPaymentAccounts(bank, card, inr("15000"))).not.toThrow();
  });

  it("accepts cash paying a credit card", () => {
    const cash = buildAccount({ name: "Cash", type: "cash" });
    const card = buildCreditCard();

    expect(() => assertValidCardPaymentAccounts(cash, card, inr("500"))).not.toThrow();
  });

  it("rejects a destination that is not a credit card", () => {
    const bank = buildAccount();
    const other = buildAccount({ name: "ICICI", type: "bank" });

    // Bank to bank is a transfer, not a payment.
    expect(() => assertValidCardPaymentAccounts(bank, other, inr("500"))).toThrow(
      InvalidAccountError,
    );
  });

  it("rejects one card paying another", () => {
    const cardA = buildCreditCard({ name: "Amex" });
    const cardB = buildCreditCard({ name: "HDFC Card" });

    expect(() => assertValidCardPaymentAccounts(cardA, cardB, inr("500"))).toThrow(
      InvalidAccountError,
    );
  });

  it("rejects a card paying itself", () => {
    const card = buildCreditCard();

    expect(() => assertValidCardPaymentAccounts(card, card, inr("500"))).toThrow(
      InvalidCreditCardPaymentError,
    );
  });

  it("rejects an archived source", () => {
    const bank = buildAccount({ archivedAt: new Date("2026-01-01T00:00:00.000Z") });
    const card = buildCreditCard();

    expect(() => assertValidCardPaymentAccounts(bank, card, inr("500"))).toThrow(
      InvalidAccountError,
    );
  });

  it("rejects an archived card", () => {
    const bank = buildAccount();
    const card = buildCreditCard({ archivedAt: new Date("2026-01-01T00:00:00.000Z") });

    expect(() => assertValidCardPaymentAccounts(bank, card, inr("500"))).toThrow(
      InvalidAccountError,
    );
  });

  it("rejects accounts that use different currencies", () => {
    const bank = buildAccount({ currency: "INR" });
    const card = buildCreditCard({
      currency: "USD",
      openingBalance: money("0", "USD"),
      creditCard: { creditLimit: money("2000", "USD"), statementDay: 5, paymentDueDay: 25 },
    });

    expect(() => assertValidCardPaymentAccounts(bank, card, inr("500"))).toThrow(
      InvalidCreditCardPaymentError,
    );
  });

  it("rejects an amount whose currency does not match the accounts", () => {
    const bank = buildAccount();
    const card = buildCreditCard();

    expect(() => assertValidCardPaymentAccounts(bank, card, money("500", "USD"))).toThrow(
      InvalidAccountError,
    );
  });
});

describe("isOverpayment", () => {
  it("is true when the payment exceeds what is owed", () => {
    expect(isOverpayment(inr("20000"), inr("15000"))).toBe(true);
  });

  it("is false when the payment clears the balance exactly", () => {
    expect(isOverpayment(inr("15000"), inr("15000"))).toBe(false);
  });

  it("is false for a partial payment", () => {
    expect(isOverpayment(inr("5000"), inr("15000"))).toBe(false);
  });

  it("treats any payment against a zero balance as an overpayment", () => {
    expect(isOverpayment(inr("100"), inr("0"))).toBe(true);
  });

  it("treats any payment against a credit balance as an overpayment", () => {
    // A negative outstanding means the card already holds a credit.
    expect(isOverpayment(inr("100"), inr("-500"))).toBe(true);
  });
});
