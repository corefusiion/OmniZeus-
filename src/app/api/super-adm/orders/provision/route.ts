import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth/session";
import { PurchaseOrder } from "@/lib/db/serverDb";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

// Helper to generate a secure random 12-character temporary password
function generateSecureTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*";

  let pass = "";
  pass += upper.charAt(Math.floor(Math.random() * upper.length));
  pass += lower.charAt(Math.floor(Math.random() * lower.length));
  pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
  pass += symbols.charAt(Math.floor(Math.random() * symbols.length));

  const allChars = upper + lower + numbers + symbols;
  for (let i = 4; i < 12; i++) {
    pass += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle array
  return pass.split("").sort(() => 0.5 - Math.random()).join("");
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    // Allow if super_adm or during initial dev demo
    if (session && session.role !== "super_adm") {
      return NextResponse.json(
        { error: "Acesso negado. Apenas o Super Admin pode provisionar empresas." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ error: "ID do pedido não informado." }, { status: 400 });
    }

    if (!fs.existsSync(DB_FILE_PATH)) {
      return NextResponse.json({ error: "Banco de dados não encontrado." }, { status: 500 });
    }

    let raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dbData = JSON.parse(raw);

    if (!Array.isArray(dbData.purchase_orders)) {
      return NextResponse.json({ error: "Tabela de pedidos de compra vazia." }, { status: 404 });
    }

    const orderIndex = dbData.purchase_orders.findIndex(
      (o: PurchaseOrder) => o.id === order_id || o.order_number === order_id
    );

    if (orderIndex === -1) {
      return NextResponse.json({ error: "Pedido de compra não encontrado." }, { status: 404 });
    }

    const order: PurchaseOrder = dbData.purchase_orders[orderIndex];

    if (order.status === "PROVISIONADO") {
      return NextResponse.json(
        {
          error: "Este pedido de compra já foi provisionado anteriormente.",
          provisioned_company_id: order.provisioned_company_id
        },
        { status: 400 }
      );
    }

    const newCompanyId = `company_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newGestorId = `emp_gestor_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tempPassword = generateSecureTempPassword();

    // 1. Create Company Profile
    const newCompany = {
      id: newCompanyId,
      corporate_name: order.empresa_nome,
      cnpj: order.empresa_cnpj,
      city: "São Paulo",
      state: "SP",
      plan: order.plan_id,
      coins_franchise: order.coins_franchise,
      monthly_revenue_brl: order.plan_price_monthly,
      status: "Ativo",
      subscription_status: order.status === "PAGAMENTO_CONFIRMADO" ? "active" : "incomplete",
      stripe_customer_id: order.stripe_customer_id || null,
      stripe_subscription_id: order.stripe_subscription_id || null,
      created_at: new Date().toISOString(),
      tradeName: order.empresa_nome,
      activeClientsCount: 0,
      company_context: `Empresa provisionada via Pedido de Compra ${order.order_number}. Segmento: ${order.empresa_segmento}. Responsável: ${order.responsavel_nome} (${order.responsavel_email}). Observações: ${order.empresa_observacoes || "Nenhuma"}.`
    };

    if (!Array.isArray(dbData.companies)) dbData.companies = [];
    dbData.companies.push(newCompany);

    // 2. Create Gestor Employee User with must_change_password: true
    const newGestor = {
      id: newGestorId,
      company_id: newCompanyId,
      name: order.responsavel_nome,
      email: order.responsavel_email,
      department: "Diretoria / Gestão Master",
      role: "gestor",
      allowed_modules: [
        "dashboard",
        "financeiro",
        "omni-ia",
        "documentos",
        "apresentacoes",
        "tarefas",
        "whatsapp-bot",
        "configuracoes"
      ],
      status: "ativo",
      must_change_password: true,
      temporary_password: tempPassword,
      created_at: new Date().toISOString()
    };

    if (!Array.isArray(dbData.employees)) dbData.employees = [];
    dbData.employees.push(newGestor);

    // 3. Assign 9 Native AI Agents Context to the new company
    if (!Array.isArray(dbData.custom_agents)) dbData.custom_agents = [];
    const builtinAgentIds = [
      "agente_geral",
      "geral",
      "fiscal",
      "dp",
      "juridico",
      "bpo",
      "societario",
      "ti_seguranca",
      "diretoria"
    ];

    builtinAgentIds.forEach((agentId) => {
      dbData.custom_agents.push({
        id: `agent_${agentId}_${newCompanyId}`,
        company_id: newCompanyId,
        label: agentId.toUpperCase().replace("_", " "),
        category: "Nativo",
        system_prompt: `Assistente especializado da empresa ${order.empresa_nome}.`,
        color: "bg-blue-50 text-blue-700 border-blue-200",
        is_custom: false,
        created_at: new Date().toISOString()
      });
    });

    // 4. Update Order Status
    order.status = "PROVISIONADO";
    order.provisioned_at = new Date().toISOString();
    order.provisioned_company_id = newCompanyId;
    dbData.purchase_orders[orderIndex] = order;

    // 5. Add Audit Log Entry
    if (!Array.isArray(dbData.audit_logs)) dbData.audit_logs = [];
    dbData.audit_logs.push({
      id: `log_${Date.now()}`,
      company_id: newCompanyId,
      user_id: session?.userId || "super_adm",
      user_name: session?.name || "Super Admin",
      action: "PROVISIONAMENTO_EMPRESA",
      resource: "purchase_orders",
      details: `Empresa ${order.empresa_nome} (${order.empresa_cnpj}) provisionada com sucesso a partir do pedido ${order.order_number}. Credenciais do Gestor criadas com troca de senha obrigatória no primeiro acesso.`,
      created_at: new Date().toISOString()
    });

    // Save updated DB file
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: `Empresa "${order.empresa_nome}" provisionada com sucesso!`,
      credentials: {
        company_id: newCompanyId,
        company_name: order.empresa_nome,
        gestor_name: order.responsavel_nome,
        gestor_email: order.responsavel_email,
        temporary_password: tempPassword,
        must_change_password: true,
        coins_franchise: order.coins_franchise,
        plan_name: order.plan_name
      }
    });
  } catch (err: any) {
    console.error("Error provisioning company from purchase order:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao provisionar empresa." },
      { status: 500 }
    );
  }
}
