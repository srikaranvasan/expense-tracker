import { getDb } from "@/server/db/client";
import { withApi } from "@/server/api/route-handler";
import { apiSuccess } from "@/server/api/response";
import { ServiceUnavailableError } from "@/lib/errors";

/**
 * Liveness/readiness probe. Confirms the process is up and the database answers.
 * Intentionally exposes no user data and no configuration values.
 */
export const GET = withApi({ operation: "health.check", rateLimit: "read" }, async (ctx) => {
  let database: "up" | "down" = "down";

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    database = "up";
  } catch (error) {
    ctx.log.error("health check: database unreachable", {
      detail: error instanceof Error ? error.message : String(error),
    });
    throw new ServiceUnavailableError("The database is temporarily unreachable.");
  }

  return apiSuccess(
    { status: "ok" as const, database, time: new Date().toISOString() },
    { requestId: ctx.requestId },
  );
});
