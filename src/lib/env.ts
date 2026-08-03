// Cloudflare Workers & Node.js Edge Environment Resolver — OmniZeus
// In Cloudflare Workers with @cloudflare/next-on-pages, environment variables and secrets
// are stored in getRequestContext().env, while in Node/Next dev they are in process.env.
// This helper resolves variables from both sources safely.

import { getRequestContext } from "@cloudflare/next-on-pages";

export function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env && (ctx.env as any)[key]) {
      return String((ctx.env as any)[key]);
    }
  } catch {
    // getRequestContext is unavailable during static build or outside request context
  }
  return undefined;
}
