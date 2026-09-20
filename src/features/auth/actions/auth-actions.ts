"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { isAppError, toAppError } from "@/lib/errors";
import { fromZodError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { AUTH_ROUTES } from "@/server/auth/auth-config";
import { signIn, signOut } from "@/server/auth/auth";
import { registerUser } from "@/server/services/users/register-user";
import { loginSchema, registerSchema } from "../schemas/auth-schemas";

/**
 * Server actions behind the auth forms.
 *
 * Actions return a serialisable result rather than throwing, so forms can render
 * field-level errors. Redirects happen only after a successful mutation.
 */

export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const GENERIC_SIGN_IN_FAILURE = "Email or password is incorrect.";

export async function loginAction(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const error = fromZodError(parsed.error);
    return {
      ok: false,
      message: "Please check the details you entered.",
      fieldErrors: (error.details?.fieldErrors as Record<string, string[]>) ?? {},
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Never distinguish "no such account" from "wrong password".
      return { ok: false, message: GENERIC_SIGN_IN_FAILURE };
    }
    logger.error("sign-in failed unexpectedly", {
      operation: "auth.signIn",
      errorCode: toAppError(error).code,
    });
    return { ok: false, message: "Sign-in is temporarily unavailable. Please try again." };
  }

  redirect(AUTH_ROUTES.afterLogin);
}

export async function registerAction(
  _previous: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    currency: formData.get("currency") ?? undefined,
    timezone: formData.get("timezone") ?? undefined,
  });

  if (!parsed.success) {
    const error = fromZodError(parsed.error);
    return {
      ok: false,
      message: "Please check the details you entered.",
      fieldErrors: (error.details?.fieldErrors as Record<string, string[]>) ?? {},
    };
  }

  const { confirmPassword: _confirmPassword, ...input } = parsed.data;

  try {
    await registerUser(input);
  } catch (error) {
    const appError = toAppError(error);
    if (isAppError(error)) {
      return {
        ok: false,
        message: appError.userMessage,
        ...(appError.code === "CONFLICT" ? { fieldErrors: { email: [appError.userMessage] } } : {}),
      };
    }
    logger.error("registration failed", { operation: "auth.register", errorCode: appError.code });
    return { ok: false, message: "Could not create the account. Please try again." };
  }

  // Sign the new user straight in; asking them to log in again adds nothing.
  try {
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirect: false,
    });
  } catch {
    return { ok: true, message: "Account created. Please sign in." };
  }

  redirect(AUTH_ROUTES.afterLogin);
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: AUTH_ROUTES.login });
}
