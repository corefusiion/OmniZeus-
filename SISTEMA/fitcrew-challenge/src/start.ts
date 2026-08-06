import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { logger, newRequestId } from "./lib/logger";

const errorMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  const reqId = newRequestId();
  const started = Date.now();
  try {
    const res = await next();
    // Best-effort correlation header (works when result is a Response).
    try {
      const maybe = res as unknown as { headers?: { set?: (k: string, v: string) => void } };
      maybe?.headers?.set?.("x-request-id", reqId);
    } catch {
      /* noop */
    }
    logger.debug("request.ok", { reqId, ms: Date.now() - started });
    return res;
  } catch (error) {
    if (handlerType === "serverFn") {
      logger.error("server_fn.failed", { reqId, ms: Date.now() - started, error });
      throw error;
    }

    if (error != null && typeof error === "object" && "statusCode" in error) {
      logger.info("request.thrown_response", {
        reqId,
        statusCode: (error as { statusCode: unknown }).statusCode,
        ms: Date.now() - started,
      });
      throw error;
    }
    logger.error("request.failed", { reqId, ms: Date.now() - started, error });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-request-id": reqId,
      },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
