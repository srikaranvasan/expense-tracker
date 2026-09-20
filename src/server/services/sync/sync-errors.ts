import { AppError, ERROR_CODES } from "@/lib/errors";
import type { ErrorDetails } from "@/lib/errors";

/**
 * A client update was based on a version the server has since moved past.
 *
 * The server refuses rather than overwriting. Financial values must never be merged
 * automatically: combining a local ₹500 with a server ₹700 into ₹1,200 is exactly the
 * failure the whole conflict mechanism exists to prevent
 * (docs/08-OFFLINE-SYNC.md sections 27-29).
 *
 * The response carries the server's current version so the client can fetch the
 * canonical record and ask the user what they meant.
 */
export class SyncConflictError extends AppError {
  constructor(
    message: string,
    details: { serverVersion: number; clientVersion?: number } & ErrorDetails,
  ) {
    super(ERROR_CODES.SYNC_CONFLICT, message, { httpStatus: 409, details });
  }
}
