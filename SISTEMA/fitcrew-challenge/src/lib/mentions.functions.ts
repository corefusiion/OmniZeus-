import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractMentionUsernames } from "@/lib/mentions";

export const searchUsernames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ q: z.string().max(30) }).parse(data))
  .handler(async ({ data, context }) => {
    const q = data.q.trim().toLowerCase();
    if (!q) return { items: [] as { id: string; username: string; display_name: string; avatar_url: string | null }[] };
    const { data: rows } = await context.supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .not("username", "is", null)
      .ilike("username", `${q}%`)
      .limit(6);
    return { items: (rows ?? []) as { id: string; username: string; display_name: string; avatar_url: string | null }[] };
  });

/**
 * Persist mentions found in `body` for a given source.
 * Also enqueues a notification for each mentioned user (excluding the author).
 */
export async function persistMentions(params: {
  supabase: any;
  authorId: string;
  sourceType: "post" | "post_comment" | "checkin" | "checkin_comment";
  sourceId: string;
  body: string;
  link: string;
  actorName: string;
}) {
  const usernames = extractMentionUsernames(params.body);
  if (usernames.length === 0) return;
  const { data: users } = await params.supabase
    .from("profiles")
    .select("id, username")
    .in("username", usernames);
  const targets = (users ?? []).filter((u: any) => u.id !== params.authorId);
  if (targets.length === 0) return;

  await params.supabase.from("mentions").insert(
    targets.map((u: any) => ({
      source_type: params.sourceType,
      source_id: params.sourceId,
      mentioned_user_id: u.id,
      author_id: params.authorId,
    })),
  );

  await params.supabase.from("notifications").insert(
    targets.map((u: any) => ({
      user_id: u.id,
      actor_id: params.authorId,
      kind: "mention",
      source_type: params.sourceType,
      source_id: params.sourceId,
      title: `${params.actorName} mencionou você`,
      body: params.body.slice(0, 140),
      link: params.link,
    })),
  );
}
