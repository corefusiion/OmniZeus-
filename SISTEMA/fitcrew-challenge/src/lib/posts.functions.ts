import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistMentions } from "@/lib/mentions.functions";
import { flagCommentIfNeeded } from "@/lib/moderation.functions";


const createPostSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  mediaUrl: z.string().min(1).max(500).nullable().optional(),
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createPostSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        body: data.body,
        media_url: data.mediaUrl ?? null,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Falha ao publicar.");

    const { data: me } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    await persistMentions({
      supabase,
      authorId: userId,
      sourceType: "post",
      sourceId: inserted.id,
      body: data.body,
      link: `/feed#post-${inserted.id}`,
      actorName: (me as any)?.display_name ?? "Alguém",
    });
    return { id: inserted.id };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: deleted, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!deleted || deleted.length === 0) {
      throw new Error("Você não tem permissão para apagar este post.");
    }
    return { ok: true };
  });

export const editPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("posts")
      .update({ body: data.body })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editPostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("post_comments")
      .update({ body: data.body })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("post_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const postReactionSchema = z.object({
  postId: z.string().uuid(),
  emoji: z.string().trim().min(1).max(12),
});

export const togglePostReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => postReactionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("post_reactions")
      .select("id")
      .eq("post_id", data.postId)
      .eq("user_id", userId)
      .eq("emoji", data.emoji)
      .maybeSingle();
    if (existing) {
      await supabase.from("post_reactions").delete().eq("id", existing.id);
      return { reacted: false };
    }
    await supabase
      .from("post_reactions")
      .insert({ post_id: data.postId, user_id: userId, emoji: data.emoji });
    return { reacted: true };
  });

const postCommentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});

export const addPostComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => postCommentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("post_comments")
      .insert({ post_id: data.postId, user_id: userId, body: data.body })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Falha ao comentar.");
    const { data: me } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    await persistMentions({
      supabase,
      authorId: userId,
      sourceType: "post_comment",
      sourceId: inserted.id,
      body: data.body,
      link: `/feed#post-${data.postId}`,
      actorName: (me as any)?.display_name ?? "Alguém",
    });
    const flagged = await flagCommentIfNeeded({
      supabase,
      userId,
      commentTable: "post_comments",
      commentId: inserted.id,
      body: data.body,
    });
    return { ok: true, flagged };
  });

