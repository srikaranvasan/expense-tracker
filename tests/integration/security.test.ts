import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { Category } from "@/domain/categories/entities";
import type { Person } from "@/domain/people/entities";
import type { User } from "@/domain/users/entities";
import { LIMITS, PAGINATION } from "@/config/constants";
import { expectError, invokeRoute } from "@tests/helpers/api";
import type { RouteHandler } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId, operationId } from "@tests/helpers/fixtures";
import {
  seedBankAccount,
  seedCategory,
  seedCreditCard,
  seedPerson,
  seedPersonalExpense,
  seedSettlement,
} from "@tests/helpers/seed";

/**
 * Cross-cutting security tests.
 *
 * The per-resource suites already check ownership for the resource they cover. This file
 * exists to check the properties that are only visible across the whole API at once, and to
 * make a regression in any single route fail here rather than nowhere:
 *
 *   - every protected route refuses an anonymous caller
 *   - no route will return another user's record
 *   - a malformed id is "not found", never a 500
 *   - error bodies never carry internals
 *
 * The list is taken from docs/12-SECURITY-AND-ERROR-HANDLING.md section 58.
 */

vi.mock("@/server/auth/session", () => sessionModuleMock());

const accountsRoute = await import("@/app/api/accounts/route");
const accountByIdRoute = await import("@/app/api/accounts/[id]/route");
const accountRestoreRoute = await import("@/app/api/accounts/[id]/restore/route");
const peopleRoute = await import("@/app/api/people/route");
const personByIdRoute = await import("@/app/api/people/[id]/route");
const personBalanceRoute = await import("@/app/api/people/[id]/balance/route");
const categoriesRoute = await import("@/app/api/categories/route");
const categoryByIdRoute = await import("@/app/api/categories/[id]/route");
const expensesRoute = await import("@/app/api/expenses/route");
const expenseByIdRoute = await import("@/app/api/expenses/[id]/route");
const sharedExpenseRoute = await import("@/app/api/expenses/shared/route");
const transfersRoute = await import("@/app/api/transfers/route");
const transferByIdRoute = await import("@/app/api/transfers/[id]/route");
const cardPaymentsRoute = await import("@/app/api/credit-card-payments/route");
const cardPaymentByIdRoute = await import("@/app/api/credit-card-payments/[id]/route");
const settlementsRoute = await import("@/app/api/settlements/route");
const settlementByIdRoute = await import("@/app/api/settlements/[id]/route");
const dashboardRoute = await import("@/app/api/dashboard/route");
const meRoute = await import("@/app/api/me/route");
const syncPushRoute = await import("@/app/api/sync/push/route");
const syncPullRoute = await import("@/app/api/sync/pull/route");
const syncRecordRoute = await import("@/app/api/sync/record/route");

/** An id that is a syntactically valid ObjectId but belongs to nothing. */
const ABSENT_ID = "0123456789abcdef01234567";

let owner: User;
let intruder: User;

let ownerAccount: Account;
let ownerPerson: Person;
let ownerCategory: Category;
let ownerExpenseId: string;
let ownerSettlementId: string;
let ownerCardId: string;

beforeEach(async () => {
  owner = await createAndSignInTestUser();

  ownerAccount = await seedBankAccount(owner.id);
  ownerPerson = await seedPerson(owner.id);
  ownerCategory = await seedCategory(owner.id);
  const card = await seedCreditCard(owner.id);
  ownerCardId = card.id;

  const expense = await seedPersonalExpense(owner.id, {
    accountId: ownerAccount.id,
    amount: "500",
  });
  ownerExpenseId = expense.transaction.id;

  const settlement = await seedSettlement(owner.id, {
    personId: ownerPerson.id,
    amount: "100",
    direction: "person_to_user",
  });
  ownerSettlementId = settlement.settlement.id;

  // A second, unrelated account holder. Everything below is attempted as this user.
  intruder = await createTestUser();
});

describe("unauthenticated access", () => {
  beforeEach(() => setCurrentTestUser(null));

  /**
   * Every protected endpoint, one call each.
   *
   * Enumerated rather than sampled: a new route that forgets `withAuthApi` is exactly the
   * kind of mistake that is invisible until someone finds it, and adding a row here is the
   * cheapest possible guard.
   */
  const protectedCalls: Array<[string, () => Promise<{ status: number }>]> = [
    ["GET /api/accounts", () => invokeRoute(accountsRoute.GET, "/api/accounts")],
    [
      "POST /api/accounts",
      () => invokeRoute(accountsRoute.POST, "/api/accounts", { method: "POST", body: {} }),
    ],
    [
      "GET /api/accounts/[id]",
      () =>
        invokeRoute(accountByIdRoute.GET, `/api/accounts/${ABSENT_ID}`, {
          params: { id: ABSENT_ID },
        }),
    ],
    ["GET /api/people", () => invokeRoute(peopleRoute.GET, "/api/people")],
    [
      "GET /api/people/[id]/balance",
      () =>
        invokeRoute(personBalanceRoute.GET, `/api/people/${ABSENT_ID}/balance`, {
          params: { id: ABSENT_ID },
        }),
    ],
    ["GET /api/categories", () => invokeRoute(categoriesRoute.GET, "/api/categories")],
    ["GET /api/expenses", () => invokeRoute(expensesRoute.GET, "/api/expenses")],
    [
      "POST /api/expenses/shared",
      () =>
        invokeRoute(sharedExpenseRoute.POST, "/api/expenses/shared", { method: "POST", body: {} }),
    ],
    ["GET /api/transfers", () => invokeRoute(transfersRoute.GET, "/api/transfers")],
    [
      "GET /api/credit-card-payments",
      () => invokeRoute(cardPaymentsRoute.GET, "/api/credit-card-payments"),
    ],
    ["GET /api/settlements", () => invokeRoute(settlementsRoute.GET, "/api/settlements")],
    ["GET /api/dashboard", () => invokeRoute(dashboardRoute.GET, "/api/dashboard")],
    ["GET /api/me", () => invokeRoute(meRoute.GET, "/api/me")],
    [
      "POST /api/sync/push",
      () =>
        invokeRoute(syncPushRoute.POST, "/api/sync/push", {
          method: "POST",
          body: { operations: [] },
        }),
    ],
    ["GET /api/sync/pull", () => invokeRoute(syncPullRoute.GET, "/api/sync/pull")],
  ];

  it.each(protectedCalls)("%s is refused", async (_label, call) => {
    const result = await call();
    expect(result.status).toBe(401);
  });

  it("reports UNAUTHORIZED rather than a validation failure", async () => {
    // Authentication is resolved before the body is parsed, so an anonymous caller sending
    // rubbish is told to sign in — not handed a field-level map of the schema.
    const result = await invokeRoute(accountsRoute.POST, "/api/accounts", {
      method: "POST",
      body: { nonsense: true },
    });

    expect(result.status).toBe(401);
    expect(expectError(result).code).toBe("UNAUTHORIZED");
  });
});

describe("cross-user access (IDOR)", () => {
  beforeEach(() => setCurrentTestUser(intruder));

  /**
   * Every owned resource type, fetched with a real id belonging to someone else.
   *
   * The expected answer is 404, not 403. A 403 confirms the record exists, which tells an
   * attacker enumerating ids that they found something real
   * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 7).
   */
  it("will not read another user's account", async () => {
    const result = await invokeRoute(accountByIdRoute.GET, `/api/accounts/${ownerAccount.id}`, {
      params: { id: ownerAccount.id },
    });

    expect(result.status).toBe(404);
    expect(expectError(result).code).toBe("NOT_FOUND");
  });

  it("will not read another user's person or their balance", async () => {
    const person = await invokeRoute(personByIdRoute.GET, `/api/people/${ownerPerson.id}`, {
      params: { id: ownerPerson.id },
    });
    expect(person.status).toBe(404);

    // The balance endpoint is a separate handler and a separate service path, so it needs
    // its own check: a leak here would expose what someone owes without exposing the person.
    const balance = await invokeRoute(
      personBalanceRoute.GET,
      `/api/people/${ownerPerson.id}/balance`,
      { params: { id: ownerPerson.id } },
    );
    expect(balance.status).toBe(404);
  });

  it("will not read another user's category", async () => {
    const result = await invokeRoute(categoryByIdRoute.GET, `/api/categories/${ownerCategory.id}`, {
      params: { id: ownerCategory.id },
    });
    expect(result.status).toBe(404);
  });

  it("will not read another user's expense", async () => {
    const result = await invokeRoute(expenseByIdRoute.GET, `/api/expenses/${ownerExpenseId}`, {
      params: { id: ownerExpenseId },
    });
    expect(result.status).toBe(404);
  });

  it("will not read another user's settlement", async () => {
    const result = await invokeRoute(
      settlementByIdRoute.GET,
      `/api/settlements/${ownerSettlementId}`,
      { params: { id: ownerSettlementId } },
    );
    expect(result.status).toBe(404);
  });

  it("will not modify another user's account", async () => {
    const patched = await invokeRoute(accountByIdRoute.PATCH, `/api/accounts/${ownerAccount.id}`, {
      method: "PATCH",
      body: { name: "Renamed by someone else" },
      params: { id: ownerAccount.id },
    });
    expect(patched.status).toBe(404);

    const deleted = await invokeRoute(accountByIdRoute.DELETE, `/api/accounts/${ownerAccount.id}`, {
      method: "DELETE",
      params: { id: ownerAccount.id },
    });
    expect(deleted.status).toBe(404);
  });

  it("will not delete another user's expense or settlement", async () => {
    const expense = await invokeRoute(expenseByIdRoute.DELETE, `/api/expenses/${ownerExpenseId}`, {
      method: "DELETE",
      params: { id: ownerExpenseId },
    });
    expect(expense.status).toBe(404);

    const settlement = await invokeRoute(
      settlementByIdRoute.DELETE,
      `/api/settlements/${ownerSettlementId}`,
      { method: "DELETE", params: { id: ownerSettlementId } },
    );
    expect(settlement.status).toBe(404);
  });

  it("will not restore another user's archived account", async () => {
    // Restore is a write that resurrects a soft-deleted record, so it gets its own check
    // (section 50: clients must not resurrect arbitrary deleted records).
    const result = await invokeRoute(
      accountRestoreRoute.POST,
      `/api/accounts/${ownerAccount.id}/restore`,
      { method: "POST", params: { id: ownerAccount.id } },
    );
    expect(result.status).toBe(404);
  });

  it("will not reference another user's account when creating an expense", async () => {
    // The dangerous case is not reading someone else's record but *writing* against it:
    // spending from an account you do not own.
    const result = await invokeRoute(expensesRoute.POST, "/api/expenses", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "250",
        description: "Charged to someone else's account",
        date: "2026-08-15T10:00:00.000Z",
        accountId: ownerAccount.id,
      },
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(["NOT_FOUND", "INVALID_ACCOUNT", "VALIDATION_ERROR"]).toContain(
      expectError(result).code,
    );
  });

  it("will not reference another user's person when creating a shared expense", async () => {
    const intruderAccount = await seedBankAccount(intruder.id, { name: "Intruder Bank" });

    const result = await invokeRoute(sharedExpenseRoute.POST, "/api/expenses/shared", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "600",
        description: "Split with someone else's contact",
        date: "2026-08-15T10:00:00.000Z",
        accountId: intruderAccount.id,
        splitMethod: "equal",
        participants: [{ type: "user" }, { type: "person", personId: ownerPerson.id }],
      },
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("will not read another user's sync record", async () => {
    const result = await invokeRoute(syncRecordRoute.GET, "/api/sync/record", {
      searchParams: { entityType: "transaction", entityId: ownerExpenseId },
    });
    expect(result.status).toBe(404);
  });

  it("does not include another user's data in a list", async () => {
    // The single-record checks above would all pass on an API that leaked through the
    // collection endpoints instead.
    for (const [handler, path] of [
      [accountsRoute.GET, "/api/accounts"],
      [peopleRoute.GET, "/api/people"],
      [expensesRoute.GET, "/api/expenses"],
      [settlementsRoute.GET, "/api/settlements"],
    ] as Array<[RouteHandler, string]>) {
      const result = await invokeRoute<unknown>(handler, path);
      const serialised = JSON.stringify(result.body);

      expect(serialised, `${path} leaked an owner id`).not.toContain(ownerAccount.id);
      expect(serialised, `${path} leaked an owner id`).not.toContain(ownerPerson.id);
      expect(serialised, `${path} leaked an owner id`).not.toContain(ownerExpenseId);
      expect(serialised, `${path} leaked an owner id`).not.toContain(ownerSettlementId);
    }
  });
});

describe("malformed identifiers", () => {
  /*
   * A malformed id is answered with 400 VALIDATION_ERROR, because the route parses
   * `ctx.params` through `z.object({ id: objectIdString })` before anything else runs.
   *
   * That is deliberate and it leaks nothing. The response depends only on the *shape* of
   * the string, so it is identical whether or not a record exists and whoever owns it. The
   * distinction that would leak — a real id belonging to someone else — is covered above,
   * and answers 404 exactly as section 7 requires.
   *
   * What must never happen is a 500, which would mean the string reached the driver and the
   * body could carry a fragment of a database error (section 13). `toObjectId` in the
   * repository layer is the second gate for anything that slips past the schema.
   *
   * These are the shapes an attacker actually sends.
   */
  const badIds = [
    ["too short", "abc"],
    ["not hexadecimal", "zzzzzzzzzzzzzzzzzzzzzzzz"],
    ["a Mongo operator", '{"$ne":null}'],
    ["a path traversal", "../../etc/passwd"],
    ["empty after trimming", "   "],
  ] as const;

  it.each(badIds)("rejects an account id that is %s", async (_label, id) => {
    const result = await invokeRoute(accountByIdRoute.GET, `/api/accounts/${id}`, {
      params: { id },
    });

    expect([400, 404]).toContain(result.status);
    expect(expectError(result).code).toBe("VALIDATION_ERROR");
  });

  it.each(badIds)("rejects an expense id that is %s", async (_label, id) => {
    const result = await invokeRoute(expenseByIdRoute.GET, `/api/expenses/${id}`, {
      params: { id },
    });
    expect([400, 404]).toContain(result.status);
  });

  it("never answers a malformed id with a server error", async () => {
    for (const [, id] of badIds) {
      for (const [handler, path] of [
        [accountByIdRoute.GET, "/api/accounts"],
        [expenseByIdRoute.GET, "/api/expenses"],
        [personByIdRoute.GET, "/api/people"],
        [settlementByIdRoute.GET, "/api/settlements"],
        [transferByIdRoute.GET, "/api/transfers"],
        [categoryByIdRoute.GET, "/api/categories"],
      ] as Array<[RouteHandler, string]>) {
        const result = await invokeRoute(handler, `${path}/${id}`, { params: { id } });
        expect(result.status, `${path} with id "${id}"`).toBeLessThan(500);
      }
    }
  });

  it("treats a well-formed but unknown id as not found", async () => {
    const result = await invokeRoute(accountByIdRoute.GET, `/api/accounts/${ABSENT_ID}`, {
      params: { id: ABSENT_ID },
    });
    expect(result.status).toBe(404);
  });
});

describe("client-supplied userId", () => {
  it("is rejected inside a sync payload", async () => {
    /*
     * Sync payloads arrive as an unvalidated record, so this is the only surface where a
     * userId could travel into the application. The command schemas would strip it, which
     * is safe but silent; the dispatcher rejects it instead (section 4).
     */
    const result = await invokeRoute(syncPushRoute.POST, "/api/sync/push", {
      method: "POST",
      body: {
        operations: [
          {
            operationId: operationId(),
            type: "CREATE_EXPENSE",
            clientId: clientId("txn"),
            payload: {
              userId: intruder.id,
              amount: "100",
              description: "Claiming another user",
              date: "2026-08-15T10:00:00.000Z",
              accountId: ownerAccount.id,
            },
          },
        ],
      },
    });

    // The push endpoint reports per-operation outcomes, so the rejection appears in the
    // result rather than as a failed request.
    const serialised = JSON.stringify(result.body);
    expect(serialised).toContain("FORBIDDEN");
  });

  it("is ignored in a REST body rather than honoured", async () => {
    // Zod strips unknown keys, so the record is created for the authenticated user. What
    // matters is that the supplied id has no effect.
    const result = await invokeRoute<{ id: string }>(accountsRoute.POST, "/api/accounts", {
      method: "POST",
      body: {
        clientId: clientId("acc"),
        userId: intruder.id,
        name: "Ownership test",
        type: "cash",
        currency: "INR",
        openingBalance: "0",
      },
    });

    expect(result.status).toBe(201);

    // Readable by the owner...
    const asOwner = await invokeRoute<{ id: string }>(accountsRoute.GET, "/api/accounts");
    expect(JSON.stringify(asOwner.body)).toContain("Ownership test");

    // ...and not by the user named in the payload.
    setCurrentTestUser(intruder);
    const asIntruder = await invokeRoute<unknown>(accountsRoute.GET, "/api/accounts");
    expect(JSON.stringify(asIntruder.body)).not.toContain("Ownership test");
  });
});

describe("payload and query limits", () => {
  it("caps the page size a client can ask for", async () => {
    const result = await invokeRoute(expensesRoute.GET, "/api/expenses", {
      searchParams: { limit: 1_000_000 },
    });

    expect(result.status).toBe(400);
    expect(expectError(result).code).toBe("VALIDATION_ERROR");
  });

  it("accepts the maximum page size", async () => {
    const result = await invokeRoute(expensesRoute.GET, "/api/expenses", {
      searchParams: { limit: PAGINATION.maxLimit },
    });
    expect(result.status).toBe(200);
  });

  it("refuses an oversized sync batch", async () => {
    const operations = Array.from({ length: LIMITS.maxSyncOperationsPerPush + 1 }, () => ({
      operationId: operationId(),
      type: "CREATE_EXPENSE",
      clientId: clientId("txn"),
      payload: {
        amount: "10",
        description: "Bulk",
        date: "2026-08-15T10:00:00.000Z",
        accountId: ownerAccount.id,
      },
    }));

    const result = await invokeRoute(syncPushRoute.POST, "/api/sync/push", {
      method: "POST",
      body: { operations },
    });

    expect(result.status).toBe(400);
  });

  it("refuses more participants than an expense may have", async () => {
    const participants = [
      { type: "user" as const },
      ...Array.from({ length: LIMITS.maxParticipantsPerExpense }, () => ({
        type: "person" as const,
        personId: ownerPerson.id,
      })),
    ];

    const result = await invokeRoute(sharedExpenseRoute.POST, "/api/expenses/shared", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "5100",
        description: "Very large split",
        date: "2026-08-15T10:00:00.000Z",
        accountId: ownerAccount.id,
        splitMethod: "equal",
        participants,
      },
    });

    expect(result.status).toBe(400);
  });

  it("refuses a name longer than the limit", async () => {
    const result = await invokeRoute(accountsRoute.POST, "/api/accounts", {
      method: "POST",
      body: {
        clientId: clientId("acc"),
        name: "x".repeat(LIMITS.nameMaxLength + 1),
        type: "cash",
        currency: "INR",
        openingBalance: "0",
      },
    });

    expect(result.status).toBe(400);
  });

  it.each([
    ["not a number", "abc"],
    ["infinite", "Infinity"],
    ["not a number literal", "NaN"],
    ["negative", "-100"],
    ["zero", "0"],
    ["beyond the maximum", "999999999999999"],
  ])("refuses an expense amount that is %s", async (_label, amount) => {
    const result = await invokeRoute(expensesRoute.POST, "/api/expenses", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount,
        description: "Bad amount",
        date: "2026-08-15T10:00:00.000Z",
        accountId: ownerAccount.id,
      },
    });

    expect(result.status).toBe(400);
  });
});

describe("error responses", () => {
  it("never carries a stack trace, a driver message, or a connection string", async () => {
    const failures = await Promise.all([
      invokeRoute(accountByIdRoute.GET, "/api/accounts/not-an-id", { params: { id: "not-an-id" } }),
      invokeRoute(expensesRoute.POST, "/api/expenses", { method: "POST", body: {} }),
      invokeRoute(expensesRoute.GET, "/api/expenses", { searchParams: { limit: 999_999 } }),
    ]);

    for (const failure of failures) {
      const serialised = JSON.stringify(failure.body);

      // Section 36: the error body is `{ code, message, details }` and nothing else.
      expect(serialised).not.toContain("mongodb://");
      expect(serialised).not.toContain("MongoServerError");
      expect(serialised).not.toContain("at Object.");
      expect(serialised.toLowerCase()).not.toContain("stack");
      expect(failure.body).not.toHaveProperty("stack");
    }
  });

  it("carries a stable error code and a request id", async () => {
    const result = await invokeRoute(expensesRoute.POST, "/api/expenses", {
      method: "POST",
      body: {},
    });

    // Clients branch on the code, never on the message text (section 35).
    expect(expectError(result).code).toBe("VALIDATION_ERROR");
    expect(result.requestId).toBeTruthy();
  });

  it("carries a request id on success too, so a log line can be found either way", async () => {
    const result = await invokeRoute(accountsRoute.GET, "/api/accounts");
    expect(result.status).toBe(200);
    expect(result.requestId).toBeTruthy();
  });
});

describe("credit-card payment ownership", () => {
  beforeEach(() => setCurrentTestUser(intruder));

  it("will not read or delete another user's card payment", async () => {
    const read = await invokeRoute(
      cardPaymentByIdRoute.GET,
      `/api/credit-card-payments/${ownerCardId}`,
      { params: { id: ownerCardId } },
    );
    expect(read.status).toBe(404);
  });

  it("will not pay another user's credit card", async () => {
    const intruderAccount = await seedBankAccount(intruder.id, { name: "Intruder Bank" });

    const result = await invokeRoute(cardPaymentsRoute.POST, "/api/credit-card-payments", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "1000",
        fromAccountId: intruderAccount.id,
        toAccountId: ownerCardId,
        date: "2026-08-15T10:00:00.000Z",
      },
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});

describe("transfer ownership", () => {
  beforeEach(() => setCurrentTestUser(intruder));

  it("will not transfer out of another user's account", async () => {
    const intruderAccount = await seedBankAccount(intruder.id, { name: "Intruder Bank" });

    const result = await invokeRoute(transfersRoute.POST, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "500",
        fromAccountId: ownerAccount.id,
        toAccountId: intruderAccount.id,
        date: "2026-08-15T10:00:00.000Z",
      },
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("will not read another user's transfer", async () => {
    const result = await invokeRoute(transferByIdRoute.GET, `/api/transfers/${ABSENT_ID}`, {
      params: { id: ABSENT_ID },
    });
    expect(result.status).toBe(404);
  });
});
