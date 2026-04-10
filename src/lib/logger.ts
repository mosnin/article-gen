/**
 * Structured JSON logger for server-side use.
 * All output goes to stdout/stderr so Vercel/hosting platforms can collect it.
 * Never log secrets, credentials, or full request bodies.
 */

interface LogContext {
  userId?: string;
  requestId?: string;
  action?: string;
  endpoint?: string;
  errorCode?: string;
  [key: string]: unknown;
}

function serialize(level: string, message: string, context?: LogContext): string {
  return JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    message,
    ...context,
  });
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(serialize("INFO", message, context));
  },

  warn(message: string, context?: LogContext) {
    console.warn(serialize("WARN", message, context));
  },

  error(message: string, err?: unknown, context?: LogContext) {
    const errorDetails =
      err instanceof Error
        ? { errorName: err.name, errorMessage: err.message }
        : err
        ? { errorRaw: String(err) }
        : {};
    console.error(serialize("ERROR", message, { ...errorDetails, ...context }));
  },
};
