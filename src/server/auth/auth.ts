import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";
import { emailAddress } from "@/lib/validation/helpers";
import { userRepository } from "@/server/repositories/mongo/user-repository";
import { authConfig } from "./auth-config";
import { fakeVerifyPassword, verifyPassword } from "./password";

/**
 * Full Auth.js instance (Node runtime).
 *
 * Auth.js handles the cookie, CSRF token and session encoding rather than the
 * application implementing its own session layer
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 3).
 */

const credentialsSchema = z.object({
  email: emailAddress,
  // Length rules belong to registration; sign-in only needs a non-empty value.
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const credentials = await userRepository().findCredentialsByEmail(email);

        if (!credentials) {
          // Equalise timing so a missing account is indistinguishable from a
          // wrong password.
          await fakeVerifyPassword();
          logger.warn("sign-in rejected", { operation: "auth.signIn", reason: "unknown_email" });
          return null;
        }

        const valid = await verifyPassword(password, credentials.passwordHash);
        if (!valid) {
          logger.warn("sign-in rejected", { operation: "auth.signIn", reason: "bad_password" });
          return null;
        }

        logger.info("sign-in succeeded", { operation: "auth.signIn", userId: credentials.userId });

        // Only the id matters; the rest is loaded from the database per request.
        return { id: credentials.userId, email: credentials.email };
      },
    }),
  ],
});
