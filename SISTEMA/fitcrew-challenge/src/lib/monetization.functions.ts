import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Retorna saldo, status PRO e contadores de uso de IA do usuário atual. */
export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, chatToday, visionMonth] = await Promise.all([
      supabase
        .from("profiles")
        .select("fitcoins_balance, is_pro, pro_until, equipped_border, equipped_border_until, equipped_title, equipped_title_until")
        .eq("id", userId)
        .maybeSingle(),
      supabase.rpc("ai_usage_count_today", { _user_id: userId, _kind: "chat" }),
      supabase.rpc("ai_usage_count_month", { _user_id: userId, _kind: "vision" }),
    ]);
    return {
      balance: profile?.fitcoins_balance ?? 0,
      isPro: !!profile?.is_pro,
      proUntil: profile?.pro_until ?? null,
      equippedBorder: profile?.equipped_border ?? "none",
      equippedBorderUntil: profile?.equipped_border_until ?? null,
      equippedTitle: profile?.equipped_title ?? "none",
      equippedTitleUntil: profile?.equipped_title_until ?? null,
      chatUsedToday: (chatToday.data as number) ?? 0,
      visionUsedThisMonth: (visionMonth.data as number) ?? 0,
      chatDailyLimit: 10,
      visionMonthlyLimit: 2,
      chatRechargeCost: 10,
      visionExtraCost: 15,
    };
  });

/** Cria uma Stripe Checkout Session para o SKU informado e retorna a URL. */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sku: z.enum(["pro_monthly", "pro_yearly", "coins_100", "coins_350", "coins_800", "coins_2000"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createStripeCheckoutForUser } = await import("./checkout.server");
    const { siteOrigin } = await import("./stripe.server");
    return createStripeCheckoutForUser({
      userId: context.userId,
      email: context.claims?.email as string | undefined,
      sku: data.sku,
      returnOrigin: siteOrigin(),
    });
  });

/** Gasta FitCoins para recarregar o ChatFit (+10 mensagens) apagando os logs de uso do dia. */
export const rechargeChatBattery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const COST = 10;
    const { data: ok, error } = await supabaseAdmin.rpc("spend_fitcoins", {
      _user_id: context.userId,
      _amount: COST,
      _reason: "chat_recharge",
    });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Saldo insuficiente de FitCoins.");

    // zera contagem do dia
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    await supabaseAdmin
      .from("ai_usage_logs")
      .delete()
      .eq("user_id", context.userId)
      .eq("usage_type", "chat")
      .gte("created_at", startOfDay.toISOString());

    return { ok: true, cost: COST };
  });

/** Compra cosmético interno gastando FitCoins (moldura dourada 30d = 200 FC / nome VIP 30d = 150 FC). */
export const purchaseCosmetic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ item: z.enum(["gold_border", "vip_title"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const COST = data.item === "gold_border" ? 200 : 150;
    const { data: ok, error } = await supabaseAdmin.rpc("spend_fitcoins", {
      _user_id: context.userId,
      _amount: COST,
      _reason: `cosmetic_${data.item}`,
    });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Saldo insuficiente de FitCoins.");

    const until = new Date();
    until.setDate(until.getDate() + 30);

    const patch =
      data.item === "gold_border"
        ? { equipped_border: "gold", equipped_border_until: until.toISOString() }
        : { equipped_title: "vip", equipped_title_until: until.toISOString() };

    await supabaseAdmin.from("profiles").update(patch as never).eq("id", context.userId);
    return { ok: true, cost: COST, until: until.toISOString() };
  });
