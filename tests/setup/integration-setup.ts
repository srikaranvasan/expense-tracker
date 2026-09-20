import { afterAll, afterEach, beforeAll } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { resetServerEnvCache } from "@/config/env";
import { closeMongoClient, getDb } from "@/server/db/client";
import { createIndexes } from "@/server/db/indexes";
import { resetRateLimits } from "@/server/api/rate-limit";
import { BASE_TEST_ENV, BASE_TEST_ENV_DEFAULTS, setTestEnv, setTestEnvDefaults } from "./test-env";

/**
 * Integration tests run against a real ephemeral MongoDB.
 *
 * A replica set (not a standalone) is required because the financial write paths
 * use multi-document transactions.
 */

let replSet: MongoMemoryReplSet | undefined;

setTestEnv({ ...BASE_TEST_ENV });
setTestEnvDefaults({ ...BASE_TEST_ENV_DEFAULTS });

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  setTestEnv({
    MONGODB_URI: replSet.getUri(),
    MONGODB_DB_NAME: "expense_tracker_integration",
  });
  resetServerEnvCache();

  await createIndexes();
}, 180_000);

afterEach(async () => {
  resetRateLimits();

  // Clear documents rather than dropping the database so indexes survive.
  const db = await getDb();
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await closeMongoClient();
  await replSet?.stop();
});
