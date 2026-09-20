import { z } from "zod";
import { currencyCode, emailAddress, entityName, password } from "@/lib/validation/helpers";

/**
 * Auth request schemas, shared by the server actions and the API routes so the
 * client and server validate against the same definition.
 */

export const loginSchema = z.object({
  email: emailAddress,
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: entityName,
    email: emailAddress,
    password,
    confirmPassword: z.string(),
    currency: currencyCode.default("INR"),
    timezone: z.string().trim().min(1).max(64).default("Asia/Kolkata"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/** Server-side registration payload; the confirmation field is a UI concern. */
export const registerRequestSchema = registerSchema.transform(
  ({ confirmPassword: _confirmPassword, ...rest }) => rest,
);
