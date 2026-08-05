export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";
import { getEnv } from "@/lib/env";

export const runtime = "edge";

// HMAC-SHA256 Stripe Webhook Signature Verification
const SIGNATURE_TOLERANCE_SEC = 300;

async function verifyStripeSignature(rawBody: string, signatureHeader: string, webhookSecret: string): Promise<boolean> {
  try {
    const items = signatureHeader.split(",").reduce((acc: any, item: string) => {
      const [key, val] = item.trim().split("=");
      if (key && val) acc[key] = val;
      return acc;
    }, {});

    const timestamp = items.t;
    const signature = items.v1;

    if (!timestamp || !signature) return false;

    // Rejeita eventos antigos para impedir replay de um webhook capturado
    const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSec) || ageSec > SIGNATURE_TOLERANCE_SEC) return false;

    const payload = `${timestamp}.${rawBody}`;
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBytes = new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
    const expectedSignature = Array.from(sigBytes).map(b => b.toString(16).padStart(2, "0")).join("");

    // comparação em tempo constante (hex)
    if (signature.length !== expectedSignature.length) return false;
    let diff = 0;
    for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    return diff === 0;
  } catch (err) {
    console.error("Error verifying Stripe signature:", err);
    return false;
  }
}

// Helper to log financial audit event to Supabase
async function recordFinancialAuditLog(companyId: string, companyName: string, eventType: string, action: string, details: string) {
  await supabase.from('audit_logs').insert([{
    id: `log_fin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    company_id: companyId || "global",
    user_id: "stripe_webhook",
    user_name: "Stripe Webhook Motor Financial",
    action: action,
    resource: "Stripe Subscription Lifecycle",
    details: `[${eventType}] ${details}`,
    created_at: new Date().toISOString()
  }]);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("stripe-signature") || "";

    const { data: settingsData } = await supabase.from('settings').select('stripe_webhook_secret, grace_period_days').limit(1).maybeSingle();
    const webhookSecret = (settingsData?.stripe_webhook_secret || getEnv("STRIPE_WEBHOOK_SECRET") || "").trim();
    const defaultGracePeriodDays = Number(settingsData?.grace_period_days || 5);

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET não configurado — webhook rejeitado.");
      return NextResponse.json({ error: "Webhook secret não configurado no servidor." }, { status: 500 });
    }
    if (!signatureHeader) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }
    if (!(await verifyStripeSignature(rawBody, signatureHeader, webhookSecret))) {
      return NextResponse.json({ error: "Invalid Stripe Webhook signature" }, { status: 400 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventId = event?.id;
    const eventType = event?.type;

    if (!eventId || !eventType) {
      return NextResponse.json({ error: "Invalid event object" }, { status: 400 });
    }

    // Global Idempotency Registry check
    const { data: existingEvent } = await supabase.from('processed_stripe_events').select('id').eq('id', eventId).maybeSingle();
    if (existingEvent) {
      return NextResponse.json({ message: "Event already processed (idempotent)", event_id: eventId });
    }
    await supabase.from('processed_stripe_events').insert([{ id: eventId }]);

    // ─────────────────────────────────────────────────────────────────────────────
    // EVENT 1: checkout.session.completed & checkout.session.async_payment_succeeded
    // ─────────────────────────────────────────────────────────────────────────────
    if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
      const session = event?.data?.object;
      const orderId = session?.client_reference_id;
      const customerId = typeof session?.customer === "string" ? session.customer : session?.customer?.id;
      const subscriptionId = typeof session?.subscription === "string" ? session.subscription : session?.subscription?.id;
      const paymentIntentId = typeof session?.payment_intent === "string" ? session.payment_intent : session?.payment_intent?.id;

      if (orderId) {
        const { data: order } = await supabase.from('purchase_orders')
          .select('*')
          .or(`id.eq.${orderId},order_number.eq.${orderId}`)
          .maybeSingle();

        if (order) {
          const updateData: any = {
            status: "PAGAMENTO_CONFIRMADO",
            paid_at: new Date().toISOString()
          };
          if (session.id) updateData.stripe_session_id = session.id;
          if (paymentIntentId) updateData.stripe_payment_intent_id = paymentIntentId;
          if (customerId) updateData.stripe_customer_id = customerId;
          if (subscriptionId) updateData.stripe_subscription_id = subscriptionId;

          await supabase.from('purchase_orders').update(updateData).eq('id', order.id);

          // If company is already provisioned, update subscription status to active immediately
          if (order.provisioned_company_id) {
            const { data: comp } = await supabase.from('companies').select('*').eq('id', order.provisioned_company_id).maybeSingle();
            if (comp) {
              const compUpdate: any = {
                subscription_status: "active",
                status: "Ativo",
                grace_period_ends_at: null,
                suspension_reason: null
              };
              if (customerId) compUpdate.stripe_customer_id = customerId;
              if (subscriptionId) compUpdate.stripe_subscription_id = subscriptionId;
              
              await supabase.from('companies').update(compUpdate).eq('id', comp.id);
              await recordFinancialAuditLog(
                comp.id,
                comp.tradeName || comp.corporateName,
                eventType,
                "SUBSCRIPTION_ACTIVATED",
                `Assinatura ativada via Checkout Stripe. Customer: ${customerId || 'N/A'}, Subscription: ${subscriptionId || 'N/A'}`
              );
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EVENT 2: invoice.paid
    // ─────────────────────────────────────────────────────────────────────────────
    else if (eventType === "invoice.paid") {
      const invoice = event?.data?.object;
      const customerId = typeof invoice?.customer === "string" ? invoice.customer : invoice?.customer?.id;
      const subscriptionId = typeof invoice?.subscription === "string" ? invoice.subscription : invoice?.subscription?.id;
      const periodStart = invoice?.lines?.data?.[0]?.period?.start;
      const periodEnd = invoice?.lines?.data?.[0]?.period?.end;

      let orCondition = "";
      if (subscriptionId) orCondition += `stripe_subscription_id.eq.${subscriptionId}`;
      if (customerId) orCondition += (orCondition ? "," : "") + `stripe_customer_id.eq.${customerId}`;

      if (orCondition) {
        const { data: comps } = await supabase.from('companies').select('*').or(orCondition);
        if (comps && comps.length > 0) {
          const comp = comps[0];
          const compUpdate: any = {
            subscription_status: "active",
            status: "Ativo",
            grace_period_ends_at: null,
            suspension_reason: null
          };
          if (periodStart) compUpdate.subscription_current_period_start = new Date(periodStart * 1000).toISOString();
          if (periodEnd) compUpdate.subscription_current_period_end = new Date(periodEnd * 1000).toISOString();
          if (customerId) compUpdate.stripe_customer_id = customerId;
          if (subscriptionId) compUpdate.stripe_subscription_id = subscriptionId;

          await supabase.from('companies').update(compUpdate).eq('id', comp.id);
          await recordFinancialAuditLog(
            comp.id,
            comp.tradeName || comp.corporateName,
            eventType,
            "INVOICE_PAID_ACCESS_RESTORED",
            `Fatura paga com sucesso no Stripe. Acesso mantido/restaurado (ACTIVE). Período: ${compUpdate.subscription_current_period_start || comp.subscription_current_period_start} a ${compUpdate.subscription_current_period_end || comp.subscription_current_period_end}`
          );
        }

        const { data: orders } = await supabase.from('purchase_orders').select('*').or(orCondition);
        if (orders && orders.length > 0) {
          for (const order of orders) {
            if (order.status === "PENDENTE_PAGAMENTO") {
              await supabase.from('purchase_orders').update({
                status: "PAGAMENTO_CONFIRMADO",
                paid_at: new Date().toISOString()
              }).eq('id', order.id);
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EVENT 3: invoice.payment_failed & invoice.payment_action_required
    // ─────────────────────────────────────────────────────────────────────────────
    else if (eventType === "invoice.payment_failed" || eventType === "invoice.payment_action_required") {
      const invoice = event?.data?.object;
      const customerId = typeof invoice?.customer === "string" ? invoice.customer : invoice?.customer?.id;
      const subscriptionId = typeof invoice?.subscription === "string" ? invoice.subscription : invoice?.subscription?.id;

      let orCondition = "";
      if (subscriptionId) orCondition += `stripe_subscription_id.eq.${subscriptionId}`;
      if (customerId) orCondition += (orCondition ? "," : "") + `stripe_customer_id.eq.${customerId}`;

      if (orCondition) {
        const { data: comps } = await supabase.from('companies').select('*').or(orCondition);
        if (comps && comps.length > 0) {
          const comp = comps[0];
          const compUpdate: any = {
            subscription_status: "past_due"
          };

          let graceEnds = comp.grace_period_ends_at;
          if (!graceEnds) {
            const graceDate = new Date();
            graceDate.setDate(graceDate.getDate() + defaultGracePeriodDays);
            graceEnds = graceDate.toISOString();
            compUpdate.grace_period_ends_at = graceEnds;
          }

          const graceEndMs = new Date(graceEnds).getTime();
          if (Date.now() > graceEndMs) {
            compUpdate.status = "Suspenso";
            compUpdate.suspension_reason = "Inadimplência — Pagamento recusado após período de tolerância";
          } else {
            compUpdate.status = "Ativo";
          }

          await supabase.from('companies').update(compUpdate).eq('id', comp.id);
          await recordFinancialAuditLog(
            comp.id,
            comp.tradeName || comp.corporateName,
            eventType,
            "INVOICE_PAYMENT_FAILED",
            `Falha no pagamento da fatura Stripe. Status financeiro: PAST_DUE. Tolerância até: ${graceEnds}. Status operacional: ${compUpdate.status}`
          );
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EVENT 4: customer.subscription.updated
    // ─────────────────────────────────────────────────────────────────────────────
    else if (eventType === "customer.subscription.updated") {
      const subscription = event?.data?.object;
      const subscriptionId = subscription?.id;
      const customerId = typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id;
      const subStatus = subscription?.status; // active, past_due, unpaid, canceled, trialing

      let orCondition = "";
      if (subscriptionId) orCondition += `stripe_subscription_id.eq.${subscriptionId}`;
      if (customerId) orCondition += (orCondition ? "," : "") + `stripe_customer_id.eq.${customerId}`;

      if (orCondition) {
        const { data: comps } = await supabase.from('companies').select('*').or(orCondition);
        if (comps && comps.length > 0) {
          const comp = comps[0];
          const compUpdate: any = {
            subscription_status: subStatus
          };

          if (subStatus === "active") {
            compUpdate.status = "Ativo";
            compUpdate.grace_period_ends_at = null;
            compUpdate.suspension_reason = null;
          } else if (subStatus === "unpaid" || subStatus === "canceled") {
            compUpdate.status = "Suspenso";
            compUpdate.suspension_reason = subStatus === "canceled" ? "Assinatura cancelada no Stripe" : "Inadimplência não regularizada";
          } else if (subStatus === "past_due") {
            let graceEnds = comp.grace_period_ends_at;
            if (!graceEnds) {
              const graceDate = new Date();
              graceDate.setDate(graceDate.getDate() + defaultGracePeriodDays);
              graceEnds = graceDate.toISOString();
              compUpdate.grace_period_ends_at = graceEnds;
            }
            if (Date.now() > new Date(graceEnds).getTime()) {
              compUpdate.status = "Suspenso";
            }
          }

          if (subscription.current_period_start) {
            compUpdate.subscription_current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
          }
          if (subscription.current_period_end) {
            compUpdate.subscription_current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
          }

          await supabase.from('companies').update(compUpdate).eq('id', comp.id);
          await recordFinancialAuditLog(
            comp.id,
            comp.tradeName || comp.corporateName,
            eventType,
            "SUBSCRIPTION_UPDATED",
            `Assinatura atualizada no Stripe. Novo status financeiro: ${subStatus}. Status operacional: ${compUpdate.status || comp.status}`
          );
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EVENT 5: customer.subscription.deleted
    // ─────────────────────────────────────────────────────────────────────────────
    else if (eventType === "customer.subscription.deleted") {
      const subscription = event?.data?.object;
      const subscriptionId = subscription?.id;

      if (subscriptionId) {
        const { data: comps } = await supabase.from('companies').select('*').eq('stripe_subscription_id', subscriptionId);
        if (comps && comps.length > 0) {
          const comp = comps[0];
          const compUpdate: any = {
            subscription_status: "canceled",
            status: "Suspenso",
            suspension_reason: "Assinatura cancelada no Stripe"
          };

          await supabase.from('companies').update(compUpdate).eq('id', comp.id);
          await recordFinancialAuditLog(
            comp.id,
            comp.tradeName || comp.corporateName,
            eventType,
            "SUBSCRIPTION_DELETED",
            `Assinatura cancelada/deletada no Stripe. Acesso suspenso. Todos os dados mantidos preservados.`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Webhook Stripe processado com sucesso. Evento: ${eventType}`,
      event_id: eventId
    });
  } catch (err: any) {
    console.error("Stripe Webhook error:", err);
    return NextResponse.json({ error: err.message || "Webhook handler error" }, { status: 500 });
  }
}



