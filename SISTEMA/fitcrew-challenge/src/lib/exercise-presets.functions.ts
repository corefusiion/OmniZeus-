import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExercisePreset = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  category: string;
  suggested_points: number;
  suggested_min_minutes: number;
  sort_order: number;
};

export const listExercisePresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("exercise_presets" as any)
      .select("id, slug, name, icon, category, suggested_points, suggested_min_minutes, sort_order")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown) as ExercisePreset[];
  });

const addPresetsSchema = z.object({
  challengeId: z.string().uuid(),
  slugs: z.array(z.string().min(1)).min(1).max(80),
});

export const addPresetsToChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => addPresetsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_challenge_admin", {
      _user_id: userId,
      _challenge_id: data.challengeId,
    });
    if (!isAdmin) throw new Error("Acesso restrito ao admin do desafio.");

    const { data: presets, error: pErr } = await supabase
      .from("exercise_presets" as any)
      .select("slug, name, icon, suggested_points, suggested_min_minutes, sort_order")
      .in("slug", data.slugs);
    if (pErr) throw new Error(pErr.message);
    if (!presets || presets.length === 0) return { inserted: 0 };

    const { data: existing } = await supabase
      .from("exercise_types")
      .select("name")
      .eq("challenge_id", data.challengeId);
    const existingNames = new Set(
      ((existing as any[]) ?? []).map((e) => String(e.name).trim().toLowerCase()),
    );

    const rows = (presets as any[])
      .filter((p) => !existingNames.has(String(p.name).trim().toLowerCase()))
      .map((p) => ({
        challenge_id: data.challengeId,
        name: p.name,
        icon: p.icon,
        points: p.suggested_points,
        min_minutes: p.suggested_min_minutes,
        sort_order: p.sort_order,
      }));

    if (rows.length === 0) return { inserted: 0 };

    const { error } = await supabase.from("exercise_types").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });
