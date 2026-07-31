import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { company_id, return_url } = body;

    if (!fs.existsSync(DB_FILE_PATH)) {
      return NextResponse.json({ error: "Banco de dados local não encontrado." }, { status: 500 });
    }

    let rawDb = fs.readFileSync(DB_FILE_PATH, "utf-8");
    if (rawDb.charCodeAt(0) === 0xFEFF) rawDb = rawDb.slice(1);
    const dbData = JSON.parse(rawDb);

    const stripeSecretKey = (dbData.settings?.stripe_secret_key || "").trim();
    if (!stripeSecretKey || stripeSecretKey.includes("***")) {
      return NextResponse.json(
        { error: "Chave Secreta do Stripe não configurada no Super Admin." },
        { status: 400 }
      );
    }

    let customerId: string | null = null;

    // Find company profile
    if (company_id && Array.isArray(dbData.companies)) {
      const company = dbData.companies.find((c: any) => c.id === company_id);
      if (company) {
        customerId = company.stripe_customer_id || company.stripeCustomerId || null;
      }
    }

    // Fallback: search purchase orders for matching customer ID
    if (!customerId && Array.isArray(dbData.purchase_orders)) {
      const matchingOrder = dbData.purchase_orders.find(
        (o: any) => o.provisioned_company_id === company_id && o.stripe_customer_id
      );
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
