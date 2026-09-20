import type Dexie from "dexie";
import { TABLE_SCHEMA_V1 } from "./schema";

/**
 * Local database migrations.
 *
 * Every schema change gets a new numbered entry here. **Never** bump a version by
 * editing an existing entry and never recreate the database to get a new shape: local
 * records can be the only copy of financial data the user has not yet synced, and
 * deleting them to simplify a migration destroys their money records
 * (docs/08-OFFLINE-SYNC.md section 40).
 *
 * Dexie applies versions in order and carries data forward automatically when the
 * change is additive. A change that is not additive needs an explicit `upgrade()`
 * transform, which is why the signature takes the Dexie instance.
 */

export const LOCAL_DB_NAME = "expense-tracker";

/** Current version. Bump only by appending to `MIGRATIONS`. */
export const LOCAL_DB_VERSION = 1;

type Migration = {
  version: number;
  describe: string;
  apply: (db: Dexie) => void;
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    describe: "Initial schema: entities, sync queue, sync metadata, cached views.",
    apply: (db) => {
      db.version(1).stores(TABLE_SCHEMA_V1);
    },
  },
];

/**
 * Applies every migration to a Dexie instance.
 *
 * Called once at construction. Dexie only runs the upgrades a given browser actually
 * needs, so declaring all of them on every load is correct and cheap.
 */
export function applyMigrations(db: Dexie): void {
  for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    migration.apply(db);
  }
}
