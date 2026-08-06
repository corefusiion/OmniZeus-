import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROVIDERS = ["openai", "gemini", "openrouter", "anthropic", "grok"] as const;

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!data) throw new Error("Acesso restrito ao Super Admin.");
}

/** Retorna a configuração atual, mascarando a api_key. */
export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_settings")
      .select("provider, model_name, image_model_name, api_key, tavily_api_key, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const key = (data?.api_key as string | null) ?? null;
    const tavily = ((data as any)?.tavily_api_key as string | null) ?? null;
    return {
      provider: (data?.provider as string) ?? "openai",
      model_name: (data?.model_name as string) ?? "gpt-4o-mini",
      image_model_name: ((data as any)?.image_model_name as string | null) ?? null,
      has_key: !!key,
      key_preview: key ? `${key.slice(0, 4)}••••${key.slice(-4)}` : null,
      has_tavily_key: !!tavily,
      tavily_key_preview: tavily ? `${tavily.slice(0, 8)}••••${tavily.slice(-4)}` : null,
      updated_at: data?.updated_at ?? null,
    };
  });

export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        provider: z.enum(PROVIDERS),
        model_name: z.string().trim().min(1).max(120),
        image_model_name: z.string().trim().max(120).optional().nullable(),
        // string vazia => mantém chave atual; null => limpa
        api_key: z.string().max(400).optional().nullable(),
        tavily_api_key: z.string().max(400).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {
      provider: data.provider,
      model_name: data.model_name,
      updated_by: context.userId,
    };
    if (data.image_model_name === null) {
      patch.image_model_name = null;
    } else if (typeof data.image_model_name === "string") {
      patch.image_model_name = data.image_model_name.trim() || null;
    }
    if (data.api_key === null) {
      patch.api_key = null;
    } else if (typeof data.api_key === "string" && data.api_key.trim().length > 0) {
      patch.api_key = data.api_key.trim();
    }
    if (data.tavily_api_key === null) {
      patch.tavily_api_key = null;
    } else if (typeof data.tavily_api_key === "string" && data.tavily_api_key.trim().length > 0) {
      patch.tavily_api_key = data.tavily_api_key.trim();
    }

    const { error } = await supabaseAdmin
      .from("ai_settings")
      .upsert({ id: true, ...patch });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Testa a chave/config atual fazendo uma chamada mínima. */
export const testAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { chatCompletion } = await import("@/lib/ai-provider.server");
    try {
      const out = await chatCompletion({
        messages: [
          { role: "system", content: "Responda com uma única palavra: ok" },
          { role: "user", content: "ping" },
        ],
        temperature: 0,
      });
      return {
        ok: true,
        provider: out.provider,
        model: out.model,
        reply: (out.content ?? "").slice(0, 80),
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
