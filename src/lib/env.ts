// Environment Resolver — OmniZeus (Edge-compatible)
// Uses only process.env (populated by @cloudflare/next-on-pages adapter at runtime
// via nodejs_compat flag). The top-level import of getRequestContext from
// @cloudflare/next-on-pages was crashing the Worker bundle at initialization.

export function getEnv(key: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env && process.env[key] !== undefined) {
      const val = process.env[key];
      if (val) return val;
    }
  } catch {}
  return undefined;
}
