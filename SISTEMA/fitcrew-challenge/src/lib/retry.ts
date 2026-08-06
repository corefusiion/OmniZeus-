/**
 * Retry helpers — exponential backoff with jitter. Use for transient network /
 * upstream failures. Never retry on 4xx client errors.
 */
import { logger } from "./logger";

export type RetryOptions = {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  /** Return true to retry. Defaults to isTransientError. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  signal?: AbortSignal;
  label?: string;
};

const AUTH_ERR = /unauthor|forbid|not.?found|invalid|permission|401|403|404|422/i;

export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  // Explicit HTTP-shaped errors
  const status = (err as any)?.status ?? (err as any)?.statusCode;
  if (typeof status === "number") {
    if (status >= 500) return true;
    if (status === 408 || status === 429) return true;
    return false;
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (AUTH_ERR.test(msg)) return false;
  // Network / timeout signals
  return /network|timeout|fetch failed|ECONN|ETIMEDOUT|socket|abort/i.test(msg);
}

function backoff(attempt: number, min: number, max: number, factor: number) {
  const exp = Math.min(max, min * Math.pow(factor, attempt));
  // full jitter
  return Math.random() * exp;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    minDelayMs = 200,
    maxDelayMs = 3_000,
    factor = 2,
    shouldRetry = isTransientError,
    onRetry,
    signal,
    label,
  } = opts;

  let attempt = 0;
  // total attempts = retries + 1
  for (;;) {
    if (signal?.aborted) throw new Error("Aborted");
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err, attempt)) throw err;
      const delay = backoff(attempt, minDelayMs, maxDelayMs, factor);
      logger.warn("retry", {
        label,
        attempt: attempt + 1,
        of: retries,
        delayMs: Math.round(delay),
        error: err,
      });
      onRetry?.(err, attempt, delay);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
}

/** Fetch with retry — parses status onto the error so isTransientError works. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit & { retry?: RetryOptions },
): Promise<Response> {
  const { retry, ...rest } = init ?? {};
  return withRetry(async () => {
    const res = await fetch(input, rest);
    if (!res.ok && (res.status >= 500 || res.status === 429 || res.status === 408)) {
      const err = new Error(`HTTP ${res.status} ${res.statusText}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    return res;
  }, retry);
}
