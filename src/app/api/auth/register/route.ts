import { registerRequestSchema } from "@/features/auth/schemas/auth-schemas";
import { withApi } from "@/server/api/route-handler";
import { apiCreated } from "@/server/api/response";
import { registerUser } from "@/server/services/users/register-user";

export const runtime = "nodejs";

/**
 * POST /api/auth/register
 *
 * Rate limited with the `auth` bucket so the endpoint cannot be used to enumerate
 * addresses or to hash passwords at will
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 16).
 */
export const POST = withApi({ operation: "auth.register", rateLimit: "auth" }, async (ctx) => {
  const input = await ctx.body(registerRequestSchema);
  const user = await registerUser(input);

  return apiCreated(
    { id: user.id, email: user.email, name: user.name },
    { requestId: ctx.requestId },
  );
});
