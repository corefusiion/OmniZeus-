import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DAILY_POSES } from "./daily-poses";

const POSE_KEYS = DAILY_POSES.map((p) => p.key) as [string, ...string[]];

export type DailyPoseRow = {
  id: string;
  challenge_id: string;
  date: string;
  pose_key: string;
  pose_emoji: string;
  pose_name: string;
  chosen_by_user_id: string;
  chosen_by_name: string | null;
  chosen_by_username: string | null;
};

export const getDailyPoses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeIds: z.array(z.string().uuid()).min(1).max(20),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<DailyPoseRow[]> => {
    const { supabase } = context;
    const { data: poses } = await supabase
      .from("daily_poses" as any)
      .select("id, challenge_id, date, pose_key, pose_emoji, pose_name, chosen_by_user_id")
      .in("challenge_id", data.challengeIds)
      .eq("date", data.date);

    const rows = (poses ?? []) as any[];
    if (!rows.length) return [];

    const userIds = Array.from(new Set(rows.map((r) => r.chosen_by_user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", userIds);
    const byId = new Map<string, any>();
    (profiles ?? []).forEach((p) => byId.set(p.id, p));

    return rows.map((r) => ({
      id: r.id,
      challenge_id: r.challenge_id,
      date: r.date,
      pose_key: r.pose_key,
      pose_emoji: r.pose_emoji,
      pose_name: r.pose_name,
      chosen_by_user_id: r.chosen_by_user_id,
      chosen_by_name: byId.get(r.chosen_by_user_id)?.display_name ?? null,
      chosen_by_username: byId.get(r.chosen_by_user_id)?.username ?? null,
    }));
  });

export const setDailyPose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        poseKey: z.enum(POSE_KEYS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const pose = DAILY_POSES.find((p) => p.key === data.poseKey)!;
    const { error } = await context.supabase.from("daily_poses" as any).insert({
      challenge_id: data.challengeId,
      date: data.date,
      pose_key: pose.key,
      pose_emoji: pose.emoji,
      pose_name: pose.name,
      chosen_by_user_id: context.userId,
    });
    if (error) {
      // Se outra pessoa já registrou (unique violation), não é fatal.
      if ((error as any).code === "23505") return { ok: true, alreadySet: true };
      throw new Error(error.message);
    }
    return { ok: true, alreadySet: false };
  });
