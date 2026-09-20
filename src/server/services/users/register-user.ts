import type { User } from "@/domain/users/entities";
import { ConflictError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { hashPassword } from "@/server/auth/password";
import { withTransaction } from "@/server/db/client";
import type { CategoryRepository } from "@/server/repositories/interfaces/category-repository";
import type { UserRepository } from "@/server/repositories/interfaces/user-repository";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { userRepository } from "@/server/repositories/mongo/user-repository";
import { createDefaultCategories } from "@/server/services/categories/default-categories";

/**
 * Registers a new user.
 *
 * A duplicate address is reported as a conflict rather than being folded into a
 * generic error, because the sign-up form needs to tell the user what to fix.
 * The unique index on `users.email` is the authoritative guard; the pre-check
 * only produces a better message.
 *
 * The user row and their starting categories are written in one transaction, so a
 * failure part-way through cannot leave an account that exists but has no
 * categories - a state the sign-up flow has no way to repair.
 */

export type RegisterUserInput = {
  name: string;
  email: string;
  password: string;
  currency: string;
  timezone: string;
};

export type RegisterUserDependencies = {
  users: UserRepository;
  categories: CategoryRepository;
};

function defaultDependencies(): RegisterUserDependencies {
  return { users: userRepository(), categories: categoryRepository() };
}

export async function registerUser(
  input: RegisterUserInput,
  dependencies: RegisterUserDependencies = defaultDependencies(),
): Promise<User> {
  const { users, categories } = dependencies;

  if (await users.emailExists(input.email)) {
    throw new ConflictError("An account with this email address already exists.");
  }

  // Hashing is deliberately outside the transaction: bcrypt at cost 12 takes long
  // enough that holding a transaction open for it would be wasteful.
  const passwordHash = await hashPassword(input.password);

  const user = await withTransaction(async (session) => {
    const created = await users.create(
      {
        email: input.email,
        name: input.name,
        passwordHash,
        currency: input.currency,
        timezone: input.timezone,
      },
      session,
    );

    await createDefaultCategories(created.id, { session, categories });

    return created;
  });

  logger.info("user registered", { operation: "users.register", userId: user.id });

  return user;
}
