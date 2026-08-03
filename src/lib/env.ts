// Cloudflare Workers & Node.js Edge Environment Resolver — OmniZeus
import { getRequestContext } from "@cloudflare/next-on-pages";

export function getEnv(key: string): string | undefined {
  // 1. Cloudflare Workers getRequestContext().env (Edge Runtime)
  try {
    const ctx = getRequestContext();
    if (ctx?.env && (ctx.env as Record<string, any>)[key] !== undefined) {
      const val = String((ctx.env as Record<string, any>)[key]);
      if (val) return val;
    }
  } catch {
    // getRequestContext is safely ignored in non-Cloudflare environments
  }

  // 2. Standard process.env (Node.js / Next dev)
  try {
    if (typeof process !== "undefined" && process.env && process.env[key] !== undefined) {
      const val = process.env[key];
      if (val) return val;
    }
  } catch {}

  return undefined;
}
