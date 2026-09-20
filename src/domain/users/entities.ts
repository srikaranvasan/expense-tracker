import type { EntityBase } from "@/domain/shared/entities";

/**
 * The application user.
 *
 * Deliberately excludes credentials: password material never travels with the
 * user entity, so it cannot be logged or serialised by accident.
 */
export type User = EntityBase & {
  email: string;
  name: string;
  /** Currency every amount for this user defaults to. */
  currency: string;
  /** IANA timezone used for daily/monthly grouping and statement dates. */
  timezone: string;
  settings: UserSettings;
};

export type UserSettings = {
  defaultAccountId: string | null;
  defaultCategoryId: string | null;
};

/** Credential material, loaded only by the sign-in path. */
export type UserCredentials = {
  userId: string;
  email: string;
  passwordHash: string;
};

export function emptyUserSettings(): UserSettings {
  return { defaultAccountId: null, defaultCategoryId: null };
}
