import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/lib/errors";
import {
  classifyErrorCode,
  classifyHttpStatus,
  classifyOperationFailure,
  classifyTransportFailure,
  describeFailure,
} from "./error-classification";

/**
 * This classification decides whether a user's expense is retried or abandoned, so both
 * directions are asserted explicitly rather than left to a default.
 */

describe("classifyHttpStatus", () => {
  it("treats a conflict as its own case", () => {
    expect(classifyHttpStatus(409)).toBe("conflict");
  });

  it("retries the statuses that mean 'not right now'", () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(classifyHttpStatus(status)).toBe("retryable");
    }
  });

  it("does not retry a rejection", () => {
    // The server understood and refused. Retrying gets the same answer forever.
    expect(classifyHttpStatus(400)).toBe("permanent");
    expect(classifyHttpStatus(401)).toBe("permanent");
    expect(classifyHttpStatus(403)).toBe("permanent");
    expect(classifyHttpStatus(404)).toBe("permanent");
    expect(classifyHttpStatus(422)).toBe("permanent");
  });
});

describe("classifyErrorCode", () => {
  it("routes a sync conflict to the conflict path", () => {
    expect(classifyErrorCode(ERROR_CODES.SYNC_CONFLICT)).toBe("conflict");
  });

  it("retries infrastructure failures", () => {
    expect(classifyErrorCode(ERROR_CODES.SERVICE_UNAVAILABLE)).toBe("retryable");
    expect(classifyErrorCode(ERROR_CODES.RATE_LIMITED)).toBe("retryable");
    expect(classifyErrorCode(ERROR_CODES.INTERNAL_ERROR)).toBe("retryable");
  });

  it("does not retry a business-rule rejection", () => {
    // These are the server saying no, and it will keep saying no.
    expect(classifyErrorCode(ERROR_CODES.INVALID_SPLIT_TOTAL)).toBe("permanent");
    expect(classifyErrorCode(ERROR_CODES.OVER_SETTLEMENT)).toBe("permanent");
    expect(classifyErrorCode(ERROR_CODES.INVALID_ACCOUNT)).toBe("permanent");
    expect(classifyErrorCode(ERROR_CODES.INVALID_TRANSFER)).toBe("permanent");
    expect(classifyErrorCode(ERROR_CODES.EXPENSE_HAS_SETTLEMENTS)).toBe("permanent");
    expect(classifyErrorCode(ERROR_CODES.VALIDATION_ERROR)).toBe("permanent");
  });

  it("retries when there is no code, because nothing was learned", () => {
    expect(classifyErrorCode(null)).toBe("retryable");
    expect(classifyErrorCode(undefined)).toBe("retryable");
  });
});

describe("classifyOperationFailure", () => {
  it("trusts the server's retryable flag over the code", () => {
    // The server knows whether it failed to reach the database or refused the operation.
    expect(classifyOperationFailure({ code: ERROR_CODES.INTERNAL_ERROR, retryable: false })).toBe(
      "permanent",
    );

    expect(classifyOperationFailure({ code: ERROR_CODES.VALIDATION_ERROR, retryable: true })).toBe(
      "retryable",
    );
  });

  it("still routes a conflict to the conflict path regardless of the flag", () => {
    expect(classifyOperationFailure({ code: ERROR_CODES.SYNC_CONFLICT, retryable: true })).toBe(
      "conflict",
    );
  });

  it("falls back to the code when no flag is present", () => {
    expect(classifyOperationFailure({ code: ERROR_CODES.OVER_SETTLEMENT })).toBe("permanent");
    expect(classifyOperationFailure({ code: ERROR_CODES.SERVICE_UNAVAILABLE })).toBe("retryable");
  });
});

describe("classifyTransportFailure", () => {
  it("is always retryable, because the request may never have been sent", () => {
    expect(classifyTransportFailure()).toBe("retryable");
  });
});

describe("describeFailure", () => {
  it("describes each kind without jargon", () => {
    expect(describeFailure("conflict")).toContain("another device");
    expect(describeFailure("permanent")).toContain("rejected");
    expect(describeFailure("retryable")).toContain("reach the server");
  });
});
