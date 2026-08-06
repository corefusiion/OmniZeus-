import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Badge = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
};

export type UserBadge = Badge & {
  earned_at: string;
  challenge_id: string | null;
};

function pub() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const listBadgesCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<Badge[]> => {
  const { data, error } = await pub().from("badges").select("id, slug, name, description, icon").order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listUserBadges = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<UserBadge[]> => {
    const { data: rows, error } = await pub()
      .from("user_badges")
      .select("earned_at, challenge_id, badges:badges!inner(id, slug, name, description, icon)")
      .eq("user_id", data.userId)
      .order("earned_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const b = (r as unknown as { badges: Badge }).badges;
      return {
        ...b,
        earned_at: r.earned_at as string,
        challenge_id: (r.challenge_id as string | null) ?? null,
      };
    });
  });
