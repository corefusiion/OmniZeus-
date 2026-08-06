import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const checkoutSchema = z.object({
  sku: z.enum(["pro_monthly", "pro_yearly", "coins_100", "coins_350", "coins_800", "coins_2000"]),
});

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
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export const Route = createFileRoute("/api/public/checkout")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      POST: async ({ request }) => {
        const headers = corsHeaders(request);

        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return json({ error: "Sessão expirada. Entre novamente para comprar." }, { status: 401, headers });
          }

          const body = checkoutSchema.parse(await request.json());
          const token = authHeader.slice("Bearer ".length).trim();
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

          if (!supabaseUrl || !supabaseKey) {
            throw new Error("Backend não configurado para validar a sessão.");
          }

          const supabasePublic = createClient<Database>(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
            global: {
              fetch: (input, init) => {
                const requestHeaders = new Headers(init?.headers);
                if (supabaseKey.startsWith("sb_") && requestHeaders.get("Authorization") === `Bearer ${supabaseKey}`) {
                  requestHeaders.delete("Authorization");
                }
                requestHeaders.set("apikey", supabaseKey);
                return fetch(input, { ...init, headers: requestHeaders });
              },
            },
          });

          const { data: userData, error: userError } = await supabasePublic.auth.getUser(token);
          if (userError || !userData.user) {
            return json({ error: "Sessão expirada. Entre novamente para comprar." }, { status: 401, headers });
          }

          const { createStripeCheckoutForUser } = await import("@/lib/checkout.server");
          const checkout = await createStripeCheckoutForUser({
            userId: userData.user.id,
            email: userData.user.email,
            sku: body.sku,
            returnOrigin: request.headers.get("origin"),
          });

          return json(checkout, { headers });
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 500;
          const message = error instanceof Error ? error.message : "Não foi possível iniciar o checkout.";
          return json({ error: message }, { status, headers });
        }
      },
    },
  },
});