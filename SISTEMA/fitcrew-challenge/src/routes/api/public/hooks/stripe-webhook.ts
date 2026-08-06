import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook — configure no dashboard Stripe apontando para:
 *   https://fitcrew.lovable.app/api/public/hooks/stripe-webhook
 * Eventos: checkout.session.completed, invoice.paid,
 *          customer.subscription.updated, customer.subscription.deleted
 */
export const Route = createFileRoute("/api/public/hooks/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { CATALOG, getStripe } = await import("@/lib/stripe.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const stripe = getStripe();
        const signature = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!signature || !secret) {
          return new Response("Missing signature or secret", { status: 400 });
        }
        const raw = await request.text();

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
        } catch (err) {
          console.error("[stripe-webhook] Invalid signature", err);
          return new Response("Invalid signature", { status: 401 });
        }

        // idempotência
        const { data: existing } = await supabaseAdmin
          .from("stripe_events")
          .select("id, processed_at")
          .eq("id", event.id)
          .maybeSingle();
        if (existing?.processed_at) {
          return Response.json({ ok: true, dedup: true });
        }
        if (!existing) {
          await supabaseAdmin.from("stripe_events").insert({
            id: event.id,
            type: event.type,
            payload: event as never,
          });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as import("stripe").Stripe.Checkout.Session;
              const userId = session.metadata?.user_id;
              const sku = session.metadata?.sku;
              const reactivateChallengeId = session.metadata?.reactivate_challenge_id;
              const coins = parseInt(session.metadata?.coins || "0", 10);
              const proDays = parseInt(session.metadata?.pro_days || "0", 10);
              const proBonusCoins = parseInt(session.metadata?.pro_bonus_coins || "0", 10);
              if (!userId) break;

              if (reactivateChallengeId) {
                const { cloneChallengeForNewSeason } = await import("@/lib/reactivation-clone.server");
                await cloneChallengeForNewSeason({
                  originalChallengeId: reactivateChallengeId,
                  triggeredByUserId: userId,
                  stripeSessionId: session.id,
                });
                break;
              }

              if (session.mode === "payment" && coins > 0) {
                await supabaseAdmin.rpc("credit_fitcoins", {
                  _user_id: userId,
                  _amount: coins,
                  _reason: `stripe_purchase_${sku}`,
                  _stripe_session: session.id,
                });
              }
              if (session.mode === "subscription" && proDays > 0) {
                await supabaseAdmin.rpc("grant_pro", { _user_id: userId, _days: proDays });
                if (proBonusCoins > 0) {
                  await supabaseAdmin.rpc("credit_fitcoins", {
                    _user_id: userId,
                    _amount: proBonusCoins,
                    _reason: `stripe_pro_bonus_${sku}`,
                    _stripe_session: session.id,
                  });
                }
              }

              // 💰 Programa de Parceiros — 10% de comissão ao padrinho (se houver)
              const grossCents = session.amount_total ?? 0;
              if (grossCents > 0) {
                await (supabaseAdmin as any).rpc("credit_affiliate_commission", {
                  _payer_id: userId,
                  _gross_amount: grossCents / 100,
                  _source_type: session.mode === "subscription" ? "subscription" : `purchase_${sku ?? "unknown"}`,
                  _stripe_session: session.id,
                });
              }
              break;
            }
            case "invoice.paid": {
              // renovação de assinatura → estende PRO
              const invoice = event.data.object as import("stripe").Stripe.Invoice;
              const subId = (invoice as unknown as { subscription: string | null }).subscription;
              if (!subId || invoice.billing_reason === "subscription_create") break;
              const sub = await stripe.subscriptions.retrieve(subId);
              const userId = sub.metadata?.user_id;
              const sku = sub.metadata?.sku;
              if (!userId) break;
              const days = sku === "pro_yearly" ? 366 : 31;
              await supabaseAdmin.rpc("grant_pro", { _user_id: userId, _days: days });
              const renewalBonus = sku === "pro_yearly" ? CATALOG.pro_yearly.proBonusCoins : CATALOG.pro_monthly.proBonusCoins;
              if (renewalBonus) {
                await supabaseAdmin.rpc("credit_fitcoins", {
                  _user_id: userId,
                  _amount: renewalBonus,
                  _reason: `stripe_pro_renewal_bonus_${sku ?? "pro_monthly"}`,
                  _stripe_session: invoice.id,
                });
              }
              break;
            }
            case "customer.subscription.deleted": {
              const sub = event.data.object as import("stripe").Stripe.Subscription;
              const userId = sub.metadata?.user_id;
              if (userId) {
                await supabaseAdmin.rpc("revoke_pro", { _user_id: userId });
              }
              break;
            }
          }

          await supabaseAdmin
            .from("stripe_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", event.id);

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[stripe-webhook] handler error", err);
          return new Response("Handler error", { status: 500 });
        }
      },
    },
  },
});
