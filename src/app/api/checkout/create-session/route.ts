export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { PurchaseOrder } from "@/lib/db/serverDb";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

// Backend Official Plans (Security: Price & Coins are strictly determined on server)
const PLANS: Record<string, { name: string; price: number; coins: number; is_test?: boolean }> = {
  test_1_real: {
    name: "Plano Teste — R$ 1,00 (Temporário)",
    price: 1,
    coins: 100,
    is_test: true
  },
  profissional: {
    name: "Plano Profissional",
    price: 490,
    coins: 5000
  },
  premium: {
    name: "Plano Premium",
    price: 890,
    coins: 15000
  },
  business: {
    name: "Plano Business",
    price: 1990,
    coins: 50000
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      responsavel_nome,
      responsavel_email,
      responsavel_telefone,
      empresa_nome,
      empresa_cnpj,
      empresa_segmento,
      empresa_observacoes,
      plan_id = "premium",
      incluir_conta_azul = false,
      origin_source = "landing_page",
      created_by_user_id,
      created_by_user_name
    } = body;

    // Strict Input Validation
    if (!responsavel_nome || !responsavel_email || !empresa_nome || !empresa_cnpj) {
      return NextResponse.json(
        { error: "Por favor, preencha todos os campos obrigatórios (*)." },
        { status: 400 }
      );
    }

    // Secure backend price resolution (Frontend price is NEVER trusted)
    const selectedPlan = PLANS[plan_id] || PLANS.premium;
    const contaAzulFee = incluir_conta_azul ? 39.90 : 0;
    const totalInitialPayment = selectedPlan.price + contaAzulFee;

    const orderId = `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const newOrder: PurchaseOrder = {
      id: orderId,
      order_number: orderId,
      responsavel_nome: responsavel_nome.trim(),
      responsavel_email: responsavel_email.trim().toLowerCase(),
      responsavel_telefone: (responsavel_telefone || "").trim(),
      empresa_nome: empresa_nome.trim(),
      empresa_cnpj: empresa_cnpj.trim(),
      empresa_segmento: (empresa_segmento || "Escritório Contábil").trim(),
      empresa_observacoes: (empresa_observacoes || "").trim(),
      plan_id: plan_id as any,
      plan_name: selectedPlan.name,
      plan_price_monthly: selectedPlan.price,
      coins_franchise: selectedPlan.coins,
      incluir_conta_azul: !!incluir_conta_azul,
      conta_azul_setup_fee: contaAzulFee,
      total_initial_payment: totalInitialPayment,
      status: "PENDENTE_PAGAMENTO",
      origin_source: origin_source as any,
      created_by_user_id: created_by_user_id || (origin_source === "manual_super_admin" ? "super_adm" : undefined),
      created_by_user_name: created_by_user_name || (origin_source === "manual_super_admin" ? "Super Admin" : undefined),
      created_at: new Date().toISOString()
    };

    // Save order to Supabase
    const { error: insertError } = await supabase.from('purchase_orders').insert([newOrder]);
    if (insertError) {
      console.error("Error inserting order:", insertError);
      return NextResponse.json({ error: "Erro ao salvar pedido." }, { status: 500 });
    }

    // Fetch Master Stripe Key
    const { data: settingsData } = await supabase.from('settings').select('stripe_secret_key').limit(1).maybeSingle();
    const stripeSecretKey = (settingsData?.stripe_secret_key || "").trim();

    if (!stripeSecretKey || stripeSecretKey.includes("***")) {
      return NextResponse.json(
        {
          error: "Chave Secreta do Stripe não configurada no Super Admin. Por favor, acesse a aba 'Infraestrutura & APIs Master' e preencha a Secret Key (sk_test_... ou sk_live_...)."
        },
        { status: 400 }
      );
    }

    // Build Stripe Checkout Session parameters
    const params = new URLSearchParams();
    const isOneTimePayment = selectedPlan.is_test === true;

    params.append("mode", isOneTimePayment ? "payment" : "subscription");
    params.append("payment_method_types[0]", "card");
    params.append("client_reference_id", orderId);
    params.append("customer_email", responsavel_email.trim());
    params.append("success_url", `${req.nextUrl.origin}/checkout/sucesso?order_id=${orderId}`);
    params.append("cancel_url", `${req.nextUrl.origin}/?checkout_canceled=true`);

    // Line Item 1: Plan
    params.append("line_items[0][price_data][currency]", "brl");
    params.append("line_items[0][price_data][product_data][name]", `OmniZeus — ${selectedPlan.name}`);
    params.append("line_items[0][price_data][product_data][description]", `Franquia de ${selectedPlan.coins.toLocaleString("pt-BR")} OmniCoins/mês`);
    params.append("line_items[0][price_data][unit_amount]", Math.round(selectedPlan.price * 100).toString());
    params.append("line_items[0][quantity]", "1");

    if (!isOneTimePayment) {
      params.append("line_items[0][price_data][recurring][interval]", "month");
    }

    // Line Item 2: Optional Conta Azul setup fee
    if (incluir_conta_azul) {
      params.append("line_items[1][price_data][currency]", "brl");
      params.append("line_items[1][price_data][product_data][name]", "Setup & Integração Guiada Conta Azul");
      params.append("line_items[1][price_data][product_data][description]", "Assistência técnica para sincronização OAuth2 de clientes e vendas");
      params.append("line_items[1][price_data][unit_amount]", "3990"); // R$ 39,90
      params.append("line_items[1][quantity]", "1");
    }

    // Dispatch request to Stripe REST API
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const stripeJson = await stripeRes.json();

    if (!stripeRes.ok || !stripeJson.url) {
      console.error("Stripe API error:", stripeJson);
      return NextResponse.json(
        {
          error: stripeJson.error?.message || "Erro na API do Stripe ao criar sessão de checkout. Verifique suas chaves no Painel Master."
        },
        { status: 500 }
      );
    }

    // Update order with stripe session id
    newOrder.stripe_session_id = stripeJson.id;
    await supabase.from('purchase_orders').update({ stripe_session_id: stripeJson.id }).eq('id', orderId);

    return NextResponse.json({
      success: true,
      order: newOrder,
      checkout_url: stripeJson.url,
      mode: "stripe"
    });
  } catch (err: any) {
    console.error("Error creating Stripe checkout session:", err);
    return NextResponse.json(
      { error: err.message || "Falha ao processar pedido de compra." },
      { status: 500 }
    );
  }
}



