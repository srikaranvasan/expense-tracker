import { cache } from "react";
import type { User } from "@/domain/users/entities";
import { UnauthorizedError } from "@/lib/errors";
import { userRepository } from "@/server/repositories/mongo/user-repository";
import { auth } from "./auth";

/**
 * The single source of the current user's identity.
 *
 * Every protected server path resolves the user here. `userId` is taken from the
 * signed session and never from a request body or query parameter
 * (docs/06-CODING-PRACTICES.md section 12).
 */

export type AuthenticatedUser = User;

/**
 * Returns the signed-in user, or null.
 *
 * Wrapped in React's `cache` so a single request that touches several server
 * components or helpers performs one database read.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await userRepository().findById(userId);
  if (!user) {
    // A valid cookie for a deleted account must not authenticate anything.
    return null;
  }

  return user;
});

/** Returns the signed-in user or throws an UnauthorizedError. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Cheap id-only accessor for paths that do not need the full profile. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
