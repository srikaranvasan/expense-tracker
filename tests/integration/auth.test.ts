import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/config/constants";
import { getDb } from "@/server/db/client";
import { verifyPassword } from "@/server/auth/password";
import { expectData, expectError, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { POST: register } = await import("@/app/api/auth/register/route");
const { GET: me } = await import("@/app/api/me/route");
const { GET: health } = await import("@/app/api/health/route");

const validRegistration = {
  name: "Karan",
  email: "karan@example.com",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
  currency: "INR",
  timezone: "Asia/Kolkata",
};

beforeEach(() => {
  setCurrentTestUser(null);
});

describe("POST /api/auth/register", () => {
  it("creates the user and never stores the password in clear text", async () => {
    const response = await invokeRoute<{ id: string; email: string; name: string }>(
      register,
      "/api/auth/register",
      { method: "POST", body: validRegistration },
    );

    expect(response.status).toBe(201);
    const data = expectData(response);
    expect(data.email).toBe("karan@example.com");

    const db = await getDb();
    const document = await db
      .collection(COLLECTIONS.users)
      .findOne<{ passwordHash: string; email: string; currency: string }>({
        email: "karan@example.com",
      });

    expect(document).not.toBeNull();
    expect(document?.passwordHash).not.toContain(validRegistration.password);
    expect(document?.passwordHash.startsWith("$2")).toBe(true);
    expect(await verifyPassword(validRegistration.password, document!.passwordHash)).toBe(true);
    expect(document?.currency).toBe("INR");
  });

  it("normalises the email address", async () => {
    await invokeRoute(register, "/api/auth/register", {
      method: "POST",
      body: { ...validRegistration, email: "  MiXeD@Example.COM " },
    });

    const db = await getDb();
    expect(
      await db.collection(COLLECTIONS.users).findOne({ email: "mixed@example.com" }),
    ).not.toBeNull();
  });

  it("rejects a duplicate email with a conflict", async () => {
    await invokeRoute(register, "/api/auth/register", { method: "POST", body: validRegistration });

    const second = await invokeRoute(register, "/api/auth/register", {
      method: "POST",
      body: validRegistration,
    });

    expect(second.status).toBe(409);
    expect(expectError(second).code).toBe("CONFLICT");
  });

  it("rejects a password that is too short", async () => {
    const response = await invokeRoute(register, "/api/auth/register", {
      method: "POST",
      body: { ...validRegistration, password: "short", confirmPassword: "short" },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });

  it("rejects mismatched password confirmation", async () => {
    const response = await invokeRoute(register, "/api/auth/register", {
      method: "POST",
      body: { ...validRegistration, confirmPassword: "something-different" },
    });

    expect(response.status).toBe(400);
    const error = expectError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys((error.details?.fieldErrors ?? {}) as object)).toContain("confirmPassword");
  });

  it("rejects a malformed email address", async () => {
    const response = await invokeRoute(register, "/api/auth/register", {
      method: "POST",
      body: { ...validRegistration, email: "not-an-email" },
    });

    expect(response.status).toBe(400);
  });

  it("rejects an unsupported currency", async () => {
    const response = await invokeRoute(register, "/api/auth/register", {
      method: "POST",
      body: { ...validRegistration, currency: "XYZ" },
    });

    expect(response.status).toBe(400);
  });

  it("rejects a body that is not valid JSON", async () => {
    const { buildRequest, callRoute, parseResponse } = await import("@tests/helpers/api");
    const request = buildRequest("/api/auth/register", { method: "POST" });
    const broken = new Request(request.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    const response = await callRoute(
      register,
      new (await import("next/server")).NextRequest(broken),
    );
    const parsed = await parseResponse(response);

    expect(parsed.status).toBe(400);
    expect(expectError(parsed).code).toBe("VALIDATION_ERROR");
  });

  it("ignores a client-supplied id or userId", async () => {
    const response = await invokeRoute<{ id: string }>(register, "/api/auth/register", {
      method: "POST",
      body: {
        ...validRegistration,
        id: "deadbeefdeadbeefdeadbeef",
        userId: "cafecafecafecafecafecafe",
      },
    });

    expect(response.status).toBe(201);
    const data = expectData(response);
    expect(data.id).not.toBe("deadbeefdeadbeefdeadbeef");
  });
});

describe("protected API access", () => {
  it("returns 401 for an unauthenticated request", async () => {
    const response = await invokeRoute(me, "/api/me");

    expect(response.status).toBe(401);
    expect(expectError(response).code).toBe("UNAUTHORIZED");
  });

  it("returns the signed-in user's own profile", async () => {
    const user = await createAndSignInTestUser({ name: "Karan", currency: "INR" });

    const response = await invokeRoute<{ id: string; email: string; currency: string }>(
      me,
      "/api/me",
    );

    expect(response.status).toBe(200);
    const data = expectData(response);
    expect(data.id).toBe(user.id);
    expect(data.email).toBe(user.email);
    expect(data.currency).toBe("INR");
  });

  it("attaches a request id to every response", async () => {
    const response = await invokeRoute(me, "/api/me");
    expect(response.requestId).toMatch(/^req_[a-f\d]{32}$/);
  });

  it("echoes a well-formed inbound request id", async () => {
    await createAndSignInTestUser();

    const response = await invokeRoute(me, "/api/me", {
      headers: { "x-request-id": "req_traceable_1234" },
    });

    expect(response.requestId).toBe("req_traceable_1234");
  });

  it("ignores a malformed inbound request id", async () => {
    // Header-legal but outside the allowed character set, so it must be replaced
    // rather than echoed into the logs.
    const response = await invokeRoute(me, "/api/me", {
      headers: { "x-request-id": "id with spaces and <script>" },
    });

    expect(response.requestId).toMatch(/^req_[a-f\d]{32}$/);
  });

  it("ignores an over-long inbound request id", async () => {
    const response = await invokeRoute(me, "/api/me", {
      headers: { "x-request-id": "a".repeat(200) },
    });

    expect(response.requestId).toMatch(/^req_[a-f\d]{32}$/);
  });
});

describe("public API access", () => {
  it("allows the health endpoint without a session", async () => {
    const response = await invokeRoute<{ status: string; database: string }>(health, "/api/health");

    expect(response.status).toBe(200);
    expect(expectData(response)).toMatchObject({ status: "ok", database: "up" });
  });
});
