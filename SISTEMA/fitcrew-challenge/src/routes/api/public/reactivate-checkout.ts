import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({ challengeId: z.string().uuid() });

function corsHeaders(request: Request) {
  return {
    "access-control-allow-origin": request.headers.get("origin") ?? "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

export const Route = createFileRoute("/api/public/reactivate-checkout")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      POST: async ({ request }) => {
        const headers = corsHeaders(request);
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return json({ error: "Sessão expirada. Entre novamente." }, { status: 401, headers });
          }
          const body = schema.parse(await request.json());
          const token = authHeader.slice("Bearer ".length).trim();
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!supabaseUrl || !supabaseKey) throw new Error("Backend não configurado.");

          const sb = createClient<Database>(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
            global: {
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                if (supabaseKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${supabaseKey}`) {
                  h.delete("Authorization");
                }
                h.set("apikey", supabaseKey);
                return fetch(input, { ...init, headers: h });
              },
            },
          });
          const { data: userData, error: userError } = await sb.auth.getUser(token);
          if (userError || !userData.user) {
            return json({ error: "Sessão expirada. Entre novamente." }, { status: 401, headers });
          }

          const { createReactivationCheckout } = await import("@/lib/reactivation-checkout.server");
          const checkout = await createReactivationCheckout({
            userId: userData.user.id,
            email: userData.user.email,
            challengeId: body.challengeId,
            returnOrigin: request.headers.get("origin"),
          });
          return json(checkout, { headers });
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 500;
          const message = error instanceof Error ? error.message : "Falha ao iniciar o checkout.";
          return json({ error: message }, { status, headers });
        }
      },
    },
  },
});
