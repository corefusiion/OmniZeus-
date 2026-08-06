import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Acesso restrito ao Super Admin.");
}

/** Lista produtos e preços ativos da conta Stripe. */
export const listStripeProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const [products, prices] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);
    const pricesByProduct = new Map<string, typeof prices.data>();
    for (const p of prices.data) {
      const pid = typeof p.product === "string" ? p.product : p.product.id;
      if (!pricesByProduct.has(pid)) pricesByProduct.set(pid, [] as never);
      pricesByProduct.get(pid)!.push(p);
    }
    return products.data.map((prod) => ({
      id: prod.id,
      name: prod.name,
      description: prod.description,
      metadata: prod.metadata,
      prices: (pricesByProduct.get(prod.id) ?? []).map((p) => ({
        id: p.id,
        lookup_key: p.lookup_key,
        unit_amount: p.unit_amount,
        currency: p.currency,
        recurring: p.recurring ? { interval: p.recurring.interval } : null,
      })),
    }));
  });

/** Lista os últimos cupons de promoção criados. */
export const listPromotionCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    const codes = await stripe.promotionCodes.list({ limit: 50, expand: ["data.coupon"] });
    return codes.data.map((c: any) => ({
      id: c.id,
      code: c.code,
      active: c.active,
      max_redemptions: c.max_redemptions,
      times_redeemed: c.times_redeemed,
      expires_at: c.expires_at,
      coupon: {
        id: c.coupon.id,
        percent_off: c.coupon.percent_off,
        amount_off: c.coupon.amount_off,
        currency: c.coupon.currency,
        duration: c.coupon.duration,
      },
    }));
  });

/** Cria um cupom + código promocional (percentual OU valor fixo). */
export const createPromotionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z.string().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
        percentOff: z.number().min(1).max(100).optional(),
        amountOffBrl: z.number().min(1).optional(),
        maxRedemptions: z.number().min(1).max(100000).optional(),
        expiresInDays: z.number().min(1).max(365).optional(),
        duration: z.enum(["once", "forever", "repeating"]).default("once"),
        durationInMonths: z.number().min(1).max(24).optional(),
      })
      .refine((v) => v.percentOff || v.amountOffBrl, {
        message: "Informe percentOff ou amountOffBrl.",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();

    const coupon = await stripe.coupons.create({
      ...(data.percentOff
        ? { percent_off: data.percentOff }
        : { amount_off: Math.round((data.amountOffBrl ?? 0) * 100), currency: "brl" }),
      duration: data.duration,
      ...(data.duration === "repeating" && data.durationInMonths
        ? { duration_in_months: data.durationInMonths }
        : {}),
      name: data.code,
    });

    const promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: data.code.toUpperCase(),
      ...(data.maxRedemptions ? { max_redemptions: data.maxRedemptions } : {}),
      ...(data.expiresInDays
        ? { expires_at: Math.floor(Date.now() / 1000) + data.expiresInDays * 86400 }
        : {}),
    } as any);

    return { id: promo.id, code: promo.code };
  });

/** Desativa um código promocional existente. */
export const deactivatePromotionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();
    await stripe.promotionCodes.update(data.id, { active: false });
    return { ok: true };
  });
