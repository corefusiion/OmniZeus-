import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAiQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ status: z.enum(["pending", "approved", "rejected"]).default("pending") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuperAdmin) throw new Error("Acesso restrito ao Super Admin.");

    const { data: items } = await context.supabase
      .from("ai_moderation_queue")
      .select("id, kind, target_post_id, body, media_url, status, moderated_by, moderated_at, created_at, metadata")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(50);
    return { items: items ?? [] };
  });

export const approveAiItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuperAdmin) throw new Error("Acesso restrito ao Super Admin.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: item, error } = await supabaseAdmin
      .from("ai_moderation_queue")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !item) throw new Error("Item não encontrado.");
    if (item.status !== "pending") throw new Error("Item já moderado.");

    // Find (or create) bot user id from profiles.is_bot
    const { data: bot } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .eq("is_bot", true)
      .limit(1)
      .maybeSingle();
    if (!bot) throw new Error("Nenhum usuário-bot configurado (marque profiles.is_bot = true).");

    if (item.kind === "post") {
      const { data: post, error: pErr } = await supabaseAdmin
        .from("posts")
        .insert({ user_id: bot.id, body: item.body, media_url: item.media_url })
        .select("id")
        .single();
      if (pErr || !post) throw new Error(pErr?.message ?? "Falha ao publicar.");
      await supabaseAdmin
        .from("ai_moderation_queue")
        .update({
          status: "approved",
          moderated_by: context.userId,
          moderated_at: new Date().toISOString(),
          published_post_id: post.id,
        })
        .eq("id", item.id);
      return { ok: true, postId: post.id };
    } else {
      if (!item.target_post_id) throw new Error("Comentário sem post alvo.");
      const { data: c, error: cErr } = await supabaseAdmin
        .from("post_comments")
        .insert({ post_id: item.target_post_id, user_id: bot.id, body: item.body })
        .select("id")
        .single();
      if (cErr || !c) throw new Error(cErr?.message ?? "Falha ao comentar.");
      await supabaseAdmin
        .from("ai_moderation_queue")
        .update({
          status: "approved",
          moderated_by: context.userId,
          moderated_at: new Date().toISOString(),
          published_comment_id: c.id,
        })
        .eq("id", item.id);
      return { ok: true, commentId: c.id };
    }
  });

export const rejectAiItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuperAdmin) throw new Error("Acesso restrito ao Super Admin.");

    await context.supabase
      .from("ai_moderation_queue")
      .update({
        status: "rejected",
        moderated_by: context.userId,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: true };
  });
