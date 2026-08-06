import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Mínimo 3 caracteres.")
  .max(20, "Máximo 20 caracteres.")
  .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _.");

export const setUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ username: usernameSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (existing && existing.id !== userId) {
      throw new Error("Esse @username já está em uso.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: data.username })
      .eq("id", userId);
    if (error) {
      if (error.message.includes("duplicate")) {
        throw new Error("Esse @username já está em uso.");
      }
      throw new Error(error.message);
    }
    return { ok: true, username: data.username };
  });

export const checkUsernameAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ username: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const parsed = usernameSchema.safeParse(data.username);
    if (!parsed.success) {
      return { valid: false, available: false, reason: parsed.error.issues[0]?.message ?? "Inválido." };
    }
    const { data: currentProfile, error: currentError } = await context.supabase
      .from("profiles")
      .select("username")
      .eq("id", context.userId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (currentProfile?.username === parsed.data) {
      return { valid: true, available: true, reason: null };
    }
    const { data: rpc, error } = await context.supabase.rpc("is_username_available", {
      _username: parsed.data,
    });
    if (error) throw new Error(error.message);
    return { valid: true, available: !!rpc, reason: rpc ? null : "Esse @username já está em uso." };
  });
