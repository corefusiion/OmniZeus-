import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationPrefs = {
  checkin: boolean;
  comment: boolean;
  reaction: boolean;
  chat: boolean;
  winners: boolean;
  mention: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  checkin: true,
  comment: true,
  reaction: true,
  chat: true,
  winners: true,
  mention: true,
};

// Handle validators: strip @ / URL, keep 1-50 chars of allowed characters.
const handleSchema = z
  .string()
  .trim()
  .max(50)
  .regex(/^[a-zA-Z0-9_.]{1,50}$/, "Use apenas letras, números, _ ou .")
  .optional()
  .or(z.literal(""));

function cleanHandle(v: string | undefined | null): string | null {
  if (!v) return null;
  const stripped = v.trim().replace(/^@+/, "").replace(/https?:\/\/[^ ]+/, "");
  if (!stripped) return null;
  return stripped.slice(0, 50);
}

export const getSettingsExtras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("profiles")
      .select("instagram_handle, tiktok_handle, twitter_handle, notification_prefs, blocked_user_ids")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const prefs = { ...DEFAULT_PREFS, ...((data?.notification_prefs as Partial<NotificationPrefs>) ?? {}) };
    const blockedIds: string[] = data?.blocked_user_ids ?? [];
    let blocked: { id: string; display_name: string; username: string | null; avatar_url: string | null }[] = [];
    if (blockedIds.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", blockedIds);
      blocked = (profiles ?? []) as any[];
    }
    return {
      instagram_handle: data?.instagram_handle ?? null,
      tiktok_handle: data?.tiktok_handle ?? null,
      twitter_handle: data?.twitter_handle ?? null,
      notification_prefs: prefs,
      blocked,
    };
  });

export const saveSocialLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        instagram_handle: handleSchema,
        tiktok_handle: handleSchema,
        twitter_handle: handleSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({
        instagram_handle: cleanHandle(data.instagram_handle),
        tiktok_handle: cleanHandle(data.tiktok_handle),
        twitter_handle: cleanHandle(data.twitter_handle),
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        checkin: z.boolean(),
        comment: z.boolean(),
        reaction: z.boolean(),
        chat: z.boolean(),
        winners: z.boolean(),
        mention: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({ notification_prefs: data })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchUsersForBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ q: z.string().trim().min(2).max(30) }).parse(data))
  .handler(async ({ data, context }) => {
    const q = data.q.toLowerCase().replace(/^@/, "");
    const { data: rows } = await context.supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .neq("id", context.userId)
      .or(`username.ilike.${q}%,display_name.ilike.%${q}%`)
      .limit(8);
    return { items: (rows ?? []) as any[] };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Você não pode se bloquear.");
    const { data: prof } = await (context.supabase as any)
      .from("profiles")
      .select("blocked_user_ids")
      .eq("id", context.userId)
      .maybeSingle();
    const current: string[] = prof?.blocked_user_ids ?? [];
    if (current.includes(data.userId)) return { ok: true };
    const next = [...current, data.userId];
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({ blocked_user_ids: next })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: prof } = await (context.supabase as any)
      .from("profiles")
      .select("blocked_user_ids")
      .eq("id", context.userId)
      .maybeSingle();
    const current: string[] = prof?.blocked_user_ids ?? [];
    const next = current.filter((id) => id !== data.userId);
    const { error } = await (context.supabase as any)
      .from("profiles")
      .update({ blocked_user_ids: next })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
