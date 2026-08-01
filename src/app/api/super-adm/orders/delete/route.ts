import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth/session";
import { PurchaseOrder } from "@/lib/db/serverDb";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (session && session.role !== "super_adm") {
      return NextResponse.json(
        { error: "Acesso negado. Apenas o Super Admin pode excluir pedidos de compra." },
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

    // Segurança: pedido provisionado já gerou empresa + gestor. Excluir deixaria
    // a empresa órfã (sem referência de pedido) e corromperia a contabilização.
    if (order.status === "PROVISIONADO" || order.provisioned_company_id) {
      return NextResponse.json(
        {
          error: "Não é possível excluir um pedido já provisionado. Ele possui empresa e gestor vinculados."
        },
        { status: 400 }
      );
    }

    const [removedOrder] = dbData.purchase_orders.splice(orderIndex, 1);

    // Audit Log
    if (!Array.isArray(dbData.audit_logs)) dbData.audit_logs = [];
    dbData.audit_logs.push({
      id: `log_${Date.now()}`,
      company_id: "global",
      user_id: session?.userId || "super_adm",
      user_name: session?.name || "Super Admin",
      action: "EXCLUSAO_PEDIDO_COMPRA",
      resource: "purchase_orders",
      details: `Pedido ${removedOrder.order_number || removedOrder.id} (${removedOrder.empresa_nome || ""}) excluído antes do provisionamento. Origem: ${removedOrder.origin_source || "landing_page"}.`,
      created_at: new Date().toISOString()
    });

    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: `Pedido "${removedOrder.order_number || removedOrder.id}" excluído com sucesso.`
    });
  } catch (err: any) {
    console.error("Error deleting purchase order:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao excluir pedido." },
      { status: 500 }
    );
  }
}
