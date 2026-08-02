export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { company_id, return_url } = body;

    const { data: settingsData } = await supabase.from('settings').select('stripe_secret_key').limit(1).maybeSingle();
    const stripeSecretKey = (settingsData?.stripe_secret_key || "").trim();

    if (!stripeSecretKey || stripeSecretKey.includes("***")) {
      return NextResponse.json(
        { error: "Chave Secreta do Stripe não configurada no Super Admin." },
        { status: 400 }
      );
    }

    let customerId: string | null = null;

    // Find company profile
    if (company_id) {
      const { data: company } = await supabase.from('companies').select('stripe_customer_id, stripeCustomerId').eq('id', company_id).maybeSingle();
      if (company) {
        customerId = company.stripe_customer_id || company.stripeCustomerId || null;
      }
    }

    // Fallback: search purchase orders for matching customer ID
    if (!customerId) {
      const { data: matchingOrder } = await supabase.from('purchase_orders')
        .select('stripe_customer_id')
        .eq('provisioned_company_id', company_id)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (matchingOrder) {
        customerId = matchingOrder.stripe_customer_id;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        {
          error: "ID de cliente no Stripe (Customer ID) não localizado para esta empresa. Verifique se o primeiro pagamento foi realizado via Stripe Checkout."
        },
        { status: 404 }
      );
    }

    const defaultReturnUrl = return_url || `${req.nextUrl.origin}/configuracoes`;

    const params = new URLSearchParams();
    params.append("customer", customerId);
    params.append("return_url", defaultReturnUrl);

    const stripeRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const stripeJson = await stripeRes.json();

    if (!stripeRes.ok || !stripeJson.url) {
      console.error("Stripe Customer Portal API error:", stripeJson);
      return NextResponse.json(
        {
          error: stripeJson.error?.message || "Erro ao gerar portal do cliente no Stripe."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: stripeJson.url
    });
  } catch (err: any) {
    console.error("Error creating Stripe customer portal session:", err);
    return NextResponse.json(
      { error: err.message || "Falha interna ao gerar portal do cliente." },
      { status: 500 }
    );
  }
}

