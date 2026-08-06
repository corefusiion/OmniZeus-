/**
 * Structured logger — emits single-line JSON on the server (ingestible by any
 * log platform) and pretty-printed grouped output in the browser. Safe to import
 * from client or server code.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function envLevel(): Level {
  const raw =
    (typeof process !== "undefined" && process.env?.LOG_LEVEL) ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_LOG_LEVEL) ||
    "info";
  return (["debug", "info", "warn", "error"].includes(raw) ? raw : "info") as Level;
}

const MIN = LEVEL_WEIGHT[envLevel()];
const isServer = typeof window === "undefined";

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (LEVEL_WEIGHT[level] < MIN) return;
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    env: isServer ? "server" : "client",
    ...ctx,
  };
  if (ctx?.error) payload.error = serializeError(ctx.error);

  if (isServer) {
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const style =
    level === "error"
      ? "color:#ef4444;font-weight:600"
      : level === "warn"
        ? "color:#f59e0b;font-weight:600"
        : level === "debug"
          ? "color:#6b7280"
          : "color:#3b82f6";
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`%c[${level}]%c ${msg}`, style, "color:inherit", ctx ?? "");
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
  child(base: Record<string, unknown>) {
    return {
      debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, { ...base, ...c }),
      info: (m: string, c?: Record<string, unknown>) => emit("info", m, { ...base, ...c }),
      warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, { ...base, ...c }),
      error: (m: string, c?: Record<string, unknown>) => emit("error", m, { ...base, ...c }),
    };
  },
};

export function newRequestId(): string {
  // Cheap, collision-resistant enough for log correlation.
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rnd}`;
}
