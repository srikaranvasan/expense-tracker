import type { ClientSession } from "mongodb";
import type { User, UserCredentials, UserSettings } from "@/domain/users/entities";

export type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
  currency: string;
  timezone: string;
};

export type UpdateUserInput = {
  name?: string;
  currency?: string;
  timezone?: string;
  settings?: Partial<UserSettings>;
};

/**
 * Persistence boundary for users.
 *
 * Application code depends on this interface, not on MongoDB, so the domain and
 * use cases stay testable without a database.
 */
export interface UserRepository {
  findById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** Loads password material. Only the sign-in path may call this. */
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  emailExists(email: string): Promise<boolean>;
  create(input: CreateUserInput, session?: ClientSession): Promise<User>;
  update(userId: string, input: UpdateUserInput): Promise<User>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
