/**
 * Test environment defaults.
 *
 * `process.env.NODE_ENV` is typed read-only by Next's ambient types, so writes go
 * through this module's narrow cast rather than being cast at every call site.
 */
const env = process.env as Record<string, string | undefined>;

export function setTestEnv(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    env[key] = value;
  }
}

export function setTestEnvDefaults(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    env[key] ??= value;
  }
}

export const BASE_TEST_ENV = {
  NODE_ENV: "test",
  LOG_LEVEL: "error",
  RATE_LIMIT_ENABLED: "false",
} as const;

export const BASE_TEST_ENV_DEFAULTS = {
  AUTH_SECRET: "test-secret-test-secret-test-secret-0000",
  AUTH_URL: "http://localhost:3000",
  AUTH_TRUST_HOST: "true",
  DEFAULT_CURRENCY: "INR",
  DEFAULT_TIMEZONE: "Asia/Kolkata",
  MONGODB_URI: "mongodb://127.0.0.1:27017/?replicaSet=rs0",
  MONGODB_DB_NAME: "expense_tracker_test",
} as const;
