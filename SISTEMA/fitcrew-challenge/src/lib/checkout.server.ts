import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CATALOG, ensurePriceForSku, getStripe, getStripeMode, siteOrigin, type SkuId } from "./stripe.server";

type CheckoutArgs = {
  userId: string;
  email?: string | null;
  sku: SkuId;
  returnOrigin?: string | null;
};

function safeReturnOrigin(origin?: string | null): string {
  if (!origin) return siteOrigin();

  try {
    const url = new URL(origin);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || isLocal) return url.origin;
  } catch {
    // fallback abaixo
  }

  return siteOrigin();
}

export async function createStripeCheckoutForUser({ userId, email, sku, returnOrigin }: CheckoutArgs) {
  const stripe = getStripe();
  const stripeMode = getStripeMode();
  const cfg = CATALOG[sku];

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, display_name")
    .eq("id", userId)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;
  if (customerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(customerId);
      if ((existingCustomer as { deleted?: boolean }).deleted) {
        customerId = null;
      }
    } catch (err) {
      const maybeStripeError = err as { statusCode?: number; code?: string; message?: string };
      const missingCustomer =
        maybeStripeError.statusCode === 404 ||
        maybeStripeError.code === "resource_missing" ||
        maybeStripeError.message?.includes("No such customer") ||
        maybeStripeError.message?.includes("similar object exists in test mode") ||
        maybeStripeError.message?.includes("live mode key was used");

      if (!missingCustomer) throw err;
      console.warn("[stripe] customer salvo incompatível com o modo ativo; criando outro", {
        userId,
        stripeMode,
      });
      customerId = null;
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      name: profile?.display_name ?? undefined,
      metadata: { user_id: userId, stripe_mode: stripeMode },
    });
    customerId = customer.id;
    await supabaseAdmin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  }

  const priceId = await ensurePriceForSku(sku);
  const origin = safeReturnOrigin(returnOrigin);

  const session = await stripe.checkout.sessions.create({
    mode: cfg.kind === "subscription" ? "subscription" : "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/store?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store?canceled=1`,
    allow_promotion_codes: true,
    metadata: {
      user_id: userId,
      sku,
      coins: String(cfg.coins ?? 0),
      pro_days: String(cfg.proDays ?? 0),
      pro_bonus_coins: String(cfg.proBonusCoins ?? 0),
      stripe_mode: stripeMode,
    },
    ...(cfg.kind === "subscription"
      ? { subscription_data: { metadata: { user_id: userId, sku, stripe_mode: stripeMode } } }
      : {}),
  });

  return { url: session.url!, sessionId: session.id };
}