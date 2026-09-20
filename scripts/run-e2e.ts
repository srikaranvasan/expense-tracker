/**
 * Runs the end-to-end suite against a disposable MongoDB.
 *
 * Why this wrapper exists instead of pointing Playwright at a database directly:
 *
 * The journey tests sign up a user and create real expenses, so they need a writable
 * database with transaction support. Using the developer's `.env.local` connection would
 * write test data into the cluster they are actually developing against — and a suite that
 * can damage real data is a suite people stop running.
 *
 * `mongodb-memory-server` is already a dependency (the integration suite uses it), and it
 * provides a single-node **replica set**, which is required because every financial write
 * goes through `withTransaction()` (docs/09-DATABASE-SCHEMA.md section 32). A standalone
 * mongod would fail on the first expense rather than at startup.
 *
 * It cannot be done from `playwright.config.ts` or a `globalSetup`: Playwright launches
 * `webServer` before global setup runs, so the URI would not exist yet when Next started.
 * Starting the database first and passing it down through the environment is the one
 * ordering that works.
 *
 * Usage:
 *   npm run test:e2e              headless
 *   npm run test:e2e -- --ui      Playwright's interactive runner
 *   npm run test:e2e -- --headed  watch it happen
 *
 * Arguments are forwarded to `playwright test`.
 */

import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

/** Distinct from the dev port (4000) and the integration database, so nothing collides. */
const E2E_PORT = process.env.E2E_PORT ?? "4300";
const E2E_DB_NAME = "expense_tracker_e2e";

async function main(): Promise<number> {
  console.log("Starting an in-memory MongoDB replica set…");

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  const uri = replSet.getUri();
  console.log(`MongoDB ready on ${new URL(uri.replace("mongodb://", "http://")).host}`);

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MONGODB_URI: uri,
    MONGODB_DB_NAME: E2E_DB_NAME,

    // Next reads .env.local after the process environment for *unset* variables only, so
    // these win. Set explicitly rather than relying on a developer's local file, which may
    // have a different port or no AUTH_SECRET at all.
    NODE_ENV: "production",
    AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-e2e-secret-e2e-secret-0000",
    AUTH_URL: `http://127.0.0.1:${E2E_PORT}`,
    AUTH_TRUST_HOST: "true",

    // The suite signs in repeatedly and would otherwise exhaust the 10/min auth budget.
    // This is exactly the case the flag was added for in group 17.
    RATE_LIMIT_ENABLED: "false",

    LOG_LEVEL: "error",
    E2E_PORT,
  };

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn(
      "npx",
      ["playwright", "test", ...process.argv.slice(2)],
      // `shell: true` is needed for `npx` to resolve on Windows.
      { stdio: "inherit", env: childEnv, shell: true },
    );

    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (error) => {
      console.error("Failed to start Playwright.", error);
      resolve(1);
    });
  });

  console.log("Stopping MongoDB…");
  await replSet.stop();

  return exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
