/**
 * Configurable logger for @heydata/core
 *
 * Replaces raw console.log calls with structured, level-based logging
 * that can be silenced in tests and configured for production.
 */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface LoggerOptions {
  level: LogLevel;
  /** Output as JSON lines (for production log aggregation) */
  json?: boolean;
}

export function createLogger(options: LoggerOptions): Logger {
  const threshold = LEVEL_PRIORITY[options.level];

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= threshold;
  }

  function formatMessage(
    level: string,
    message: string,
    data?: Record<string, unknown>,
  ): string {
    if (options.json) {
      return JSON.stringify({ level, message, ...data, timestamp: new Date().toISOString() });
    }
    const prefix = `[${level.toUpperCase()}]`;
    if (data && Object.keys(data).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    return `${prefix} ${message}`;
  }

  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", message, data));
      }
    },
    info(message: string, data?: Record<string, unknown>) {
      if (shouldLog("info")) {
        console.log(formatMessage("info", message, data));
      }
    },
    warn(message: string, data?: Record<string, unknown>) {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", message, data));
      }
    },
    error(message: string, data?: Record<string, unknown>) {
      if (shouldLog("error")) {
        console.error(formatMessage("error", message, data));
      }
    },
  };
}

/** No-op logger that discards all output */
export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
