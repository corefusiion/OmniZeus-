import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPlatformSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("platform_settings")
      .select("access_mode, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      access_mode: (data?.access_mode ?? "closed") as "closed" | "open",
      updated_at: data?.updated_at ?? null,
    };
  },
);

export const setAccessMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ access_mode: z.enum(["closed", "open"]) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    // Check super admin
    const { data: isSuper, error: rpcErr } = await context.supabase.rpc(
      "is_super_admin",
      { _user_id: context.userId },
    );
    if (rpcErr) throw new Error(rpcErr.message);
    if (!isSuper) throw new Error("Apenas super admins podem alterar o modo de acesso.");

    const { error } = await context.supabase
      .from("platform_settings")
      .upsert(
        {
          id: true,
          access_mode: data.access_mode,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, access_mode: data.access_mode };
  });
