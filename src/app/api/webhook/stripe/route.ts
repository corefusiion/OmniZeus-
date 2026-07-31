import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PurchaseOrder } from "@/lib/db/serverDb";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

// HMAC-SHA256 Stripe Webhook Signature Verification
function verifyStripeSignature(rawBody: string, signatureHeader: string, webhookSecret: string): boolean {
  try {
    const items = signatureHeader.split(",").reduce((acc: any, item: string) => {
      const [key, val] = item.trim().split("=");
      if (key && val) acc[key] = val;
      return acc;
    }, {});

    const timestamp = items.t;
    const signature = items.v1;

    if (!timestamp || !signature) return false;

    const payload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload, "utf8")
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (err) {
    console.error("Error verifying Stripe signature:", err);
    return false;
  }
}

// Helper to log financial audit event to local SQL DB
function recordFinancialAuditLog(dbData: any, companyId: string, companyName: string, eventType: string, action: string, details: string) {
  if (!Array.isArray(dbData.audit_logs)) {
    dbData.audit_logs = [];
  }
  dbData.audit_logs.unshift({
    id: `log_fin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    company_id: companyId || "global",
    user_id: "stripe_webhook",
    user_name: "Stripe Webhook Motor Financial",
    action: action,
    resource: "Stripe Subscription Lifecycle",
    details: `[${eventType}] ${details}`,
    created_at: new Date().toISOString()
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("stripe-signature") || "";

    if (!fs.existsSync(DB_FILE_PATH)) {
      return NextResponse.json({ error: "Database file not found" }, { status: 500 });
    }

    let rawDb = fs.readFileSync(DB_FILE_PATH, "utf-8");
    if (rawDb.charCodeAt(0) === 0xFEFF) rawDb = rawDb.slice(1);
    const dbData = JSON.parse(rawDb);

    const webhookSecret = (dbData.settings?.stripe_webhook_secret || "").trim();

    // Verify webhook signature if whsec_ is configured
    if (webhookSecret && webhookSecret.startsWith("whsec_")) {
      if (!signatureHeader) {
        return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
      }
      const isValid = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Stripe Webhook signature" }, { status: 400 });
      }
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
    if (!Array.isArray(dbData.processed_stripe_event_ids)) {
      dbData.processed_stripe_event_ids = [];
    }

    if (dbData.processed_stripe_event_ids.includes(eventId)) {
      return NextResponse.json({ message: "Event already processed (idempotent)", event_id: eventId });
    }

    // Mark event as processed globally
    dbData.processed_stripe_event_ids.push(eventId);

    const defaultGracePeriodDays = Number(dbData.settings?.grace_period_days || 5);

    // ─────────────────────────────────────────────────────────────────────────────
    // EVENT 1: checkout.session.completed & checkout.session.async_payment_succeeded
    // ─────────────────────────────────────────────────────────────────────────────
    if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
      const session = event?.data?.object;
      const orderId = session?.client_reference_id;
      const customerId = typeof session?.customer === "string" ? session.customer : session?.customer?.id;
      const subscriptionId = typeof session?.subscription === "string" ? session.subscription : session?.subscription?.id;
      const paymentIntentId = typeof session?.payment_intent === "string" ? session.payment_intent : session?.payment_intent?.id;

      if (orderId && Array.isArray(dbData.purchase_orders)) {
        const orderIndex = dbData.purchase_orders.findIndex(
          (o: PurchaseOrder) => o.id === orderId || o.order_number === orderId
        );

        if (orderIndex !== -1) {
          const order: PurchaseOrder = dbData.purchase_orders[orderIndex];

          order.status = "PAGAMENTO_CONFIRMADO";
          order.paid_at = new Date().toISOString();
          if (session.id) order.stripe_session_id = session.id;
          if (paymentIntentId) order.stripe_payment_intent_id = paymentIntentId;
          if (customerId) order.stripe_customer_id = customerId;
          if (subscriptionId) order.stripe_subscription_id = subscriptionId;

          dbData.purchase_orders[orderIndex] = order;

          // If company is already provisioned, update subscription status to active immediately
          if (order.provisioned_company_id && Array.isArray(dbData.companies)) {
            const compIdx = dbData.companies.findIndex((c: any) => c.id === order.provisioned_company_id);
            if (compIdx !== -1) {
              dbData.companies[compIdx].subscription_status = "active";
              dbData.companies[compIdx].status = "Ativo";
              if (customerId) dbData.companies[compIdx].stripe_customer_id = customerId;
              if (subscriptionId) dbData.companies[compIdx].stripe_subscription_id = subscriptionId;
              dbData.companies[compIdx].grace_period_ends_at = null;
              dbData.companies[compIdx].suspension_reason = null;

              recordFinancialAuditLog(
                dbData,
                dbData.companies[compIdx].id,
                dbData.companies[compIdx].tradeName || dbData.companies[compIdx].corporateName,
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

      if (Array.isArray(dbData.companies)) {
        const compIdx = dbData.companies.findIndex(
          (c: any) =>
            (subscriptionId && c.stripe_subscription_id === subscriptionId) ||
            (customerId && c.stripe_customer_id === customerId)
        );

        if (compIdx !== -1) {
          const comp = dbData.companies[compIdx];
          comp.subscription_status = "active";
          comp.status = "Ativo"; // AUTOMATIC RE-ACTIVATION UPON RECOVERY
          comp.grace_period_ends_at = null;
          comp.suspension_reason = null;

          if (periodStart) comp.subscription_current_period_start = new Date(periodStart * 1000).toISOString();
          if (periodEnd) comp.subscription_current_period_end = new Date(periodEnd * 1000).toISOString();
          if (customerId) comp.stripe_customer_id = customerId;
          if (subscriptionId) comp.stripe_subscription_id = subscriptionId;

          dbData.companies[compIdx] = comp;

          recordFinancialAuditLog(
            dbData,
            comp.id,
            comp.tradeName || comp.corporateName,
            eventType,
            "INVOICE_PAID_ACCESS_RESTORED",
            `Fatura paga com sucesso no Stripe. Acesso mantido/restaurado (ACTIVE). Período: ${comp.subscription_current_period_start} a ${comp.subscription_current_period_end}`
          );
        }
      }

      // Also ensure purchase order is marked paid if matching
      if (Array.isArray(dbData.purchase_orders)) {
        const orderIdx = dbData.purchase_orders.findIndex(
          (o: PurchaseOrder) =>
            (subscriptionId && o.stripe_subscription_id === subscriptionId) ||
            (customerId && o.stripe_customer_id === customerId)
        );
        if (orderIdx !== -1 && dbData.purchase_orders[orderIdx].status === "PENDENTE_PAGAMENTO") {
          dbData.purchase_orders[orderIdx].status = "PAGAMENTO_CONFIRMADO";
          dbData.purchase_orders[orderIdx].paid_at = new Date().toISOString();
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

      if (Array.isArray(dbData.companies)) {
        const compIdx = dbData.companies.findIndex(
          (c: any) =>
            (subscriptionId && c.stripe_subscription_id === subscriptionId) ||
            (customerId && c.stripe_customer_id === customerId)
        );

        if (compIdx !== -1) {
          const comp = dbData.companies[compIdx];
          comp.subscription_status = "past_due";

          // Calculate Grace Period if not set
          if (!comp.grace_period_ends_at) {
            const graceDate = new Date();
            graceDate.setDate(graceDate.getDate() + defaultGracePeriodDays);
            comp.grace_period_ends_at = graceDate.toISOString();
          }

          // Evaluate if Grace Period has expired
          const graceEndMs = new Date(comp.grace_period_ends_at).getTime();
          if (Date.now() > graceEndMs) {
            comp.status = "Suspenso";
            comp.suspension_reason = "Inadimplência — Pagamento recusado após período de tolerância";
          } else {
            // Keep operational access ACTIVE during Grace Period
            comp.status = "Ativo";
          }

          dbData.companies[compIdx] = comp;

          recordFinancialAuditLog(
            dbData,
            comp.id,
            comp.tradeName || comp.corporateName,
            eventType,
            "INVOICE_PAYMENT_FAILED",
            `Falha no pagamento da fatura Stripe. Status financeiro: PAST_DUE. Tolerância até: ${comp.grace_period_ends_at}. Status operacional: ${comp.status}`
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

      if (Array.isArray(dbData.companies)) {
        const compIdx = dbData.companies.findIndex(
          (c: any) =>
            (subscriptionId && c.stripe_subscription_id === subscriptionId) ||
            (customerId && c.stripe_customer_id === customerId)
        );

        if (compIdx !== -1) {
          const comp = dbData.companies[compIdx];
          comp.subscription_status = subStatus;

          if (subStatus === "active") {
            comp.status = "Ativo";
            comp.grace_period_ends_at = null;
            comp.suspension_reason = null;
          } else if (subStatus === "unpaid" || subStatus === "canceled") {
            comp.status = "Suspenso";
            comp.suspension_reason = subStatus === "canceled" ? "Assinatura cancelada no Stripe" : "Inadimplência não regularizada";
          } else if (subStatus === "past_due") {
            if (!comp.grace_period_ends_at) {
              const graceDate = new Date();
              graceDate.setDate(graceDate.getDate() + defaultGracePeriodDays);
              comp.grace_period_ends_at = graceDate.toISOString();
            }
            if (Date.now() > new Date(comp.grace_period_ends_at).getTime()) {
              comp.status = "Suspenso";
            }
          }

          if (subscription.current_period_start) {
            comp.subscription_current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
          }
          if (subscription.current_period_end) {
            comp.subscription_current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
          }

          dbData.companies[compIdx] = comp;

          recordFinancialAuditLog(
            dbData,
            comp.id,
            comp.tradeName || comp.corporateName,
            eventType,
            "SUBSCRIPTION_UPDATED",
            `Assinatura atualizada no Stripe. Novo status financeiro: ${subStatus}. Status operacional: ${comp.status}`
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

      if (Array.isArray(dbData.companies)) {
        const compIdx = dbData.companies.findIndex(
          (c: any) => subscriptionId && c.stripe_subscription_id === subscriptionId
        );

        if (compIdx !== -1) {
          const comp = dbData.companies[compIdx];
          comp.subscription_status = "canceled";
          comp.status = "Suspenso";
          comp.suspension_reason = "Assinatura cancelada no Stripe";

          dbData.companies[compIdx] = comp;

          recordFinancialAuditLog(
            dbData,
            comp.id,
            comp.tradeName || comp.corporateName,
            eventType,
            "SUBSCRIPTION_DELETED",
            `Assinatura cancelada/deletada no Stripe. Acesso suspenso. Todos os dados mantidos preservados.`
          );
        }
      }
    }

    // Save updated database file
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2), "utf-8");

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
