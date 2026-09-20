import { ObjectId } from "mongodb";
import { NotFoundError } from "@/lib/errors";

/**
 * ObjectId conversion helpers.
 *
 * Ids arriving from a client are untrusted strings. A malformed id is treated as
 * "not found" rather than a 500, and never reaches a query
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 13).
 */

export function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && ObjectId.isValid(value) && value.length === 24;
}

export function toObjectId(value: string): ObjectId {
  if (!isObjectIdString(value)) throw new NotFoundError("Resource");
  return new ObjectId(value);
}

/** Returns null instead of throwing, for optional references. */
export function toOptionalObjectId(value: string | null | undefined): ObjectId | null {
  if (value === null || value === undefined || value === "") return null;
  return toObjectId(value);
}

export function fromObjectId(value: ObjectId): string {
  return value.toHexString();
}

export function optionalFromObjectId(value: ObjectId | null | undefined): string | null {
  return value ? value.toHexString() : null;
}

export function newObjectId(): ObjectId {
  return new ObjectId();
}

export { ObjectId };
