import crypto from "node:crypto";

export function getRequestId() {
  return crypto.randomBytes(8).toString("hex");
}

function normalizeMeta(meta: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => {
      if (value instanceof Error) {
        return [
          key,
          {
            name: value.name,
            message: value.message,
            stack: value.stack,
          },
        ];
      }
      return [key, value];
    }),
  );
}

export function logInfo(message: string, meta: Record<string, unknown>) {
  console.info(JSON.stringify({ level: "info", message, ...normalizeMeta(meta) }));
}

export function logWarn(message: string, meta: Record<string, unknown>) {
  console.warn(JSON.stringify({ level: "warn", message, ...normalizeMeta(meta) }));
}

export function logError(message: string, meta: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", message, ...normalizeMeta(meta) }));
}
