import { vi } from "vitest";
import type { User } from "@/domain/users/entities";
import { registerUser } from "@/server/services/users/register-user";

/**
 * Session control for integration tests.
 *
 * `auth()` reads a cookie from an ambient request, which does not exist when a
 * route handler is invoked directly. The session module is mocked so tests can
 * choose the current user, while every other layer - including the ownership
 * checks under test - runs for real.
 *
 * Call `installSessionMock()` at module scope in the test file (vi.mock is hoisted,
 * so it must be a static call in the test file itself; this helper holds the
 * shared state used by that mock).
 */

let currentUser: User | null = null;

export function setCurrentTestUser(user: User | null): void {
  currentUser = user;
}

export function getCurrentTestUser(): User | null {
  return currentUser;
}

/** Factory that mirrors the real `@/server/auth/session` module surface. */
export function sessionModuleMock() {
  return {
    getCurrentUser: vi.fn(async () => currentUser),
    requireUser: vi.fn(async () => {
      if (!currentUser) {
        const { UnauthorizedError } = await import("@/lib/errors");
        throw new UnauthorizedError();
      }
      return currentUser;
    }),
    getCurrentUserId: vi.fn(async () => currentUser?.id ?? null),
  };
}

let sequence = 0;

/** Creates a real user through the registration service. */
export async function createTestUser(
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    currency: string;
    timezone: string;
  }> = {},
): Promise<User> {
  sequence += 1;

  return registerUser({
    name: overrides.name ?? `Test User ${sequence}`,
    email: overrides.email ?? `user${sequence}.${Date.now()}@example.com`,
    password: overrides.password ?? "correct-horse-battery",
    currency: overrides.currency ?? "INR",
    timezone: overrides.timezone ?? "Asia/Kolkata",
  });
}

/** Creates a user and makes them the current session user. */
export async function createAndSignInTestUser(
  overrides?: Parameters<typeof createTestUser>[0],
): Promise<User> {
  const user = await createTestUser(overrides);
  setCurrentTestUser(user);
  return user;
}
