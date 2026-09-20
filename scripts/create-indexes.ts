/**
 * Ensures every MongoDB index exists.
 *
 * Run after deploying and whenever index definitions change:
 *   npm run db:indexes
 */
import { closeMongoClient } from "@/server/db/client";
import { createIndexes } from "@/server/db/indexes";

async function main(): Promise<void> {
  await createIndexes();
  console.log("Indexes ensured.");
}

main()
  .catch((error: unknown) => {
    console.error("Failed to create indexes:", error);
    process.exitCode = 1;
  })
  .finally(() => closeMongoClient());
