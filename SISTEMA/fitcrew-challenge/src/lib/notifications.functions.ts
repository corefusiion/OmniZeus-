import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KIND_TO_PREF: Record<string, keyof NotificationPrefs> = {
  checkin: "checkin",
  new_checkin: "checkin",
  streak_reminder: "checkin",
  comment: "comment",
  post_comment: "comment",
  checkin_comment: "comment",
  reaction: "reaction",
  post_reaction: "reaction",
  checkin_reaction: "reaction",
  chat_message: "chat",
  mention: "mention",
  winners: "winners",
  challenge_winner: "winners",
};

type NotificationPrefs = {
  checkin: boolean;
  comment: boolean;
  reaction: boolean;
  chat: boolean;
  winners: boolean;
  mention: boolean;
};

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await (context.supabase as any)
      .from("profiles")
      .select("notification_prefs")
      .eq("id", context.userId)
      .maybeSingle();
    const prefs: NotificationPrefs = {
      checkin: true, comment: true, reaction: true, chat: true, winners: true, mention: true,
      ...((prof?.notification_prefs as Partial<NotificationPrefs>) ?? {}),
    };

    const { data: items } = await context.supabase
      .from("notifications")
      .select("id, actor_id, kind, source_type, source_id, title, body, link, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const filtered = (items ?? []).filter((n: any) => {
      const prefKey = KIND_TO_PREF[n.kind as string];
      return prefKey ? prefs[prefKey] !== false : true;
    });
    const actorIds = [...new Set(filtered.map((n: any) => n.actor_id).filter(Boolean))];
    let actors: Record<string, { display_name: string; username: string | null; avatar_url: string | null }> = {};
    if (actorIds.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", actorIds);
      actors = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    }
    const unread = filtered.filter((n: any) => !n.read_at).length;
    return { items: filtered, actors, unread };
  });

export const unreadCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { count: count ?? 0 };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
