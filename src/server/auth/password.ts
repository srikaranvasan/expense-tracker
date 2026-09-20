import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * bcrypt with a deliberate work factor; the cost is lowered under test so the
 * suite does not spend most of its time hashing.
 */
const COST = process.env.NODE_ENV === "test" ? 4 : 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // A malformed stored hash must fail closed, not throw a 500.
    return false;
  }
}

/**
 * Burns roughly the same time as a real verification.
 *
 * Called when the email does not exist so sign-in timing does not reveal which
 * addresses are registered.
 */
export async function fakeVerifyPassword(): Promise<false> {
  // Hashing at the same cost factor takes comparable time to a real comparison.
  await hashPassword("timing-equalising-value");
  return false;
}
