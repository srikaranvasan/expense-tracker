import { ObjectId } from "mongodb";
import type { Filter } from "mongodb";
import { ValidationError } from "@/lib/errors";

/**
 * Keyset pagination for date-ordered lists.
 *
 * A cursor encodes the last item's `(date, _id)` pair. Offset pagination would
 * skip or repeat rows whenever a new transaction is inserted mid-scroll, which is
 * exactly what happens in a list the user is actively adding to
 * (docs/06-CODING-PRACTICES.md section 43).
 */

export type DateCursor = {
  date: Date;
  id: ObjectId;
};

export function encodeDateCursor(date: Date, id: ObjectId): string {
  return Buffer.from(`${date.toISOString()}|${id.toHexString()}`, "utf8").toString("base64url");
}

export function decodeDateCursor(cursor: string): DateCursor {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new ValidationError("The pagination cursor is not valid.");
  }

  const separator = decoded.lastIndexOf("|");
  if (separator === -1) throw new ValidationError("The pagination cursor is not valid.");

  const isoDate = decoded.slice(0, separator);
  const rawId = decoded.slice(separator + 1);
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime()) || !ObjectId.isValid(rawId)) {
    throw new ValidationError("The pagination cursor is not valid.");
  }

  return { date, id: new ObjectId(rawId) };
}

/**
 * Filter fragment that continues a descending `(date, _id)` scan after `cursor`.
 */
export function afterDateCursor<T>(cursor: DateCursor): Filter<T> {
  return {
    $or: [{ date: { $lt: cursor.date } }, { date: cursor.date, _id: { $lt: cursor.id } }],
  } as Filter<T>;
}

/**
 * Fetches `limit + 1` rows to learn whether another page exists, then trims.
 */
export function buildPage<T extends { _id: ObjectId; date: Date }, R>(
  documents: T[],
  limit: number,
  map: (document: T) => R,
): { items: R[]; nextCursor: string | null; hasMore: boolean } {
  const hasMore = documents.length > limit;
  const page = hasMore ? documents.slice(0, limit) : documents;
  const last = page.at(-1);

  return {
    items: page.map(map),
    nextCursor: hasMore && last ? encodeDateCursor(last.date, last._id) : null,
    hasMore,
  };
}
