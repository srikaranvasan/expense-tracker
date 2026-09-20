import type { ArchiveMeta, EntityBase, SyncMeta } from "@/domain/shared/entities";

/**
 * Someone the user shares expenses with.
 *
 * A Person is a contact owned by one user, not an application account
 * (docs/02-DATA-MODEL.md section 6). Their balance is always derived from expense
 * splits and settlement allocations, never stored.
 */
export type Person = EntityBase &
  SyncMeta &
  ArchiveMeta & {
    userId: string;
    name: string;
    notes: string | null;
  };

export function isArchivedPerson(person: Person): boolean {
  return person.archivedAt !== null;
}
