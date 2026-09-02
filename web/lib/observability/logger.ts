import "server-only";

type LogValue = string | number | boolean | null | undefined;
type LogContext = Record<string, LogValue | readonly LogValue[]>;
type LogLevel = "info" | "warn" | "error";

const sensitiveKeyPattern =
  /authorization|cookie|credential|password|secret|token|key/i;

function sanitizeContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).filter(([key]) => !sensitiveKeyPattern.test(key)),
  );
}

export function logEvent(
  level: LogLevel,
  event: string,
  context: LogContext = {},
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeContext(context),
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}
