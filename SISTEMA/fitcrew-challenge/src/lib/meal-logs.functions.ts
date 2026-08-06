import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summarizeDailyMacros } from "@/lib/fitness-knowledge";

const logMealInput = z.object({
  meal_type: z.string().trim().min(1).max(40),
  food_description: z.string().trim().min(1).max(500),
  calories: z.number().int().min(0).max(5000).default(0),
  protein_g: z.number().min(0).max(500).default(0),
  carbs_g: z.number().min(0).max(1000).default(0),
  fat_g: z.number().min(0).max(500).default(0),
  skipped: z.boolean().default(false),
  image_url: z.string().url().max(500).nullable().optional(),
  occurred_on: z.string().optional(), // YYYY-MM-DD
  source: z.enum(["chat", "manual"]).default("chat"),
});

export const logMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => logMealInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("meal_logs")
      .insert({
        user_id: userId,
        meal_type: data.meal_type,
        food_description: data.food_description,
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        skipped: data.skipped,
        source: data.source,
        image_url: data.image_url ?? null,
        ...(data.occurred_on ? { occurred_on: data.occurred_on } : {}),
      })
      .select("id, occurred_on")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Falha ao registrar refeição.");
    return { id: inserted.id, occurred_on: inserted.occurred_on };
  });

export const dailyMacros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ date: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const day = data.date ?? new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabase
      .from("meal_logs")
      .select("meal_type, calories, protein_g, carbs_g, fat_g, skipped")
      .eq("user_id", userId)
      .eq("occurred_on", day);
    const meals = (rows ?? []).map((r) => ({
      meal_type: r.meal_type,
      calories: r.calories ?? 0,
      protein: Number(r.protein_g ?? 0),
      carbs: Number(r.carbs_g ?? 0),
      fat: Number(r.fat_g ?? 0),
      skipped: r.skipped ?? false,
    }));
    return { date: day, ...summarizeDailyMacros(meals) };
  });
