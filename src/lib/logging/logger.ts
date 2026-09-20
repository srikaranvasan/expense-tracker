import { redact } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Fields the application consistently attaches to log lines. */
export type LogContext = {
  requestId?: string;
  userId?: string;
  operation?: string;
  entityId?: string;
  entityType?: string;
  errorCode?: string;
  durationMs?: number;
  route?: string;
  method?: string;
  status?: number;
  [key: string]: unknown;
};

export type Logger = {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Returns a logger that merges `context` into every line. */
  child(context: LogContext): Logger;
};

type LoggerConfig = {
  level: LogLevel;
  pretty: boolean;
};

/**
 * Read on every write rather than captured at import.
 *
 * A level frozen at module load cannot be changed without a restart, and it is
 * wrong in tests, where the environment is configured after imports are hoisted.
 * The cost is two `process.env` lookups per log line.
 */
function readConfig(): LoggerConfig {
  const level = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
  const validLevel: LogLevel = level !== undefined && level in LEVEL_WEIGHT ? level : "info";
  return {
    level: validLevel,
    pretty: process.env.NODE_ENV !== "production",
  };
}

function write(level: LogLevel, message: string, context: LogContext): void {
  const config = readConfig();
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[config.level]) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(redact(context) as Record<string, unknown>),
  };

  const line = config.pretty ? prettyLine(level, message, entry) : JSON.stringify(entry);

  // `console` is the transport. A hosted log drain collects stdout/stderr.
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

function prettyLine(level: LogLevel, message: string, entry: Record<string, unknown>): string {
  const { level: _level, time: _time, message: _message, ...rest } = entry;
  const suffix = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  return `${level.toUpperCase().padEnd(5)} ${message}${suffix}`;
}

function createLogger(base: LogContext): Logger {
  return {
    debug: (message, context) => write("debug", message, { ...base, ...context }),
    info: (message, context) => write("info", message, { ...base, ...context }),
    warn: (message, context) => write("warn", message, { ...base, ...context }),
    error: (message, context) => write("error", message, { ...base, ...context }),
    child: (context) => createLogger({ ...base, ...context }),
  };
}

/** Application-wide logger. Prefer `logger.child({ requestId })` per request. */
export const logger: Logger = createLogger({});
