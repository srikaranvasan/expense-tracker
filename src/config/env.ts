import { z } from "zod";

/**
 * Centralised environment access.
 *
 * `process.env` is read here and nowhere else on the server so that missing or
 * malformed configuration fails loudly at startup rather than at the first
 * request that happens to need it (docs/05-FOLDER-STRUCTURE.md section 27).
 */

const logLevels = ["debug", "info", "warn", "error"] as const;

const booleanFromString = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1, "MONGODB_DB_NAME is required"),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: booleanFromString.default(false),

  DEFAULT_CURRENCY: z.string().length(3).default("INR"),
  DEFAULT_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),

  LOG_LEVEL: z.enum(logLevels).default("info"),

  RATE_LIMIT_ENABLED: booleanFromString.default(true),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type LogLevel = (typeof logLevels)[number];

let cachedEnv: ServerEnv | null = null;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/**
 * Reads and validates server environment variables.
 *
 * Throws on invalid configuration. Never call this from client components: the
 * values include secrets and must stay on the server.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY,
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE,
    LOG_LEVEL: process.env.LOG_LEVEL,
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatIssues(parsed.error)}\n` +
        `Copy .env.example to .env.local and fill in the required values.`,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Test helper: forces the next getServerEnv() call to re-read process.env. */
export function resetServerEnvCache(): void {
  cachedEnv = null;
}

export function isProduction(): boolean {
  return getServerEnv().NODE_ENV === "production";
}

export function isTest(): boolean {
  return getServerEnv().NODE_ENV === "test";
}

/**
 * Values that are safe to render into the client bundle.
 * Nothing secret may ever be added here.
 */
export const publicConfig = {
  appName: "Expense Tracker",
  appShortName: "Expenses",
} as const;
