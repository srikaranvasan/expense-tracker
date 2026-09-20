import { MongoClient, type ClientSession, type Db, type MongoClientOptions } from "mongodb";
import { getServerEnv } from "@/config/env";
import { logger } from "@/lib/logging/logger";

/**
 * MongoDB connection.
 *
 * The client is cached on the global object so Next.js hot reloads and serverless
 * invocations reuse one connection pool instead of exhausting the database with a
 * new pool per module instance. Only server code may import this module.
 */

const clientOptions: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  retryWrites: true,
  retryReads: true,
  ignoreUndefined: true,
};

type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
  uri: string | null;
};

const globalForMongo = globalThis as typeof globalThis & {
  __expenseTrackerMongo?: MongoCache;
};

function cache(): MongoCache {
  globalForMongo.__expenseTrackerMongo ??= { client: null, promise: null, uri: null };
  return globalForMongo.__expenseTrackerMongo;
}

export async function getMongoClient(): Promise<MongoClient> {
  const env = getServerEnv();
  const store = cache();

  // A changed URI (tests swapping in an in-memory server) invalidates the pool.
  if (store.uri && store.uri !== env.MONGODB_URI) {
    await closeMongoClient();
  }

  if (store.client) return store.client;

  if (!store.promise) {
    store.uri = env.MONGODB_URI;
    store.promise = new MongoClient(env.MONGODB_URI, clientOptions)
      .connect()
      .then((client) => {
        store.client = client;
        logger.debug("mongodb connected", { database: env.MONGODB_DB_NAME });
        return client;
      })
      .catch((error: unknown) => {
        store.promise = null;
        store.uri = null;
        throw error;
      });
  }

  return store.promise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getServerEnv().MONGODB_DB_NAME);
}

export async function closeMongoClient(): Promise<void> {
  const store = cache();
  const client = store.client;

  store.client = null;
  store.promise = null;
  store.uri = null;

  if (client) await client.close();
}

/**
 * Runs `work` inside a MongoDB transaction.
 *
 * Multi-document financial writes must be all-or-nothing
 * (docs/09-DATABASE-SCHEMA.md sections 32-33). Requires a replica set; a
 * standalone mongod cannot start a session transaction.
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getMongoClient();
  const session = client.startSession();

  try {
    return await session.withTransaction(work, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    });
  } finally {
    await session.endSession();
  }
}
