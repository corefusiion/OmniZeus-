export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session && session.role !== "super_adm") {
      return NextResponse.json(
        { error: "Acesso negado. Apenas o Super Admin pode excluir pedidos de compra." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ error: "ID do pedido nÃ£o informado." }, { status: 400 });
    }

    const { data: order, error: findError } = await supabase.from('pedidos_saas')
      .select('*')
      .or(`id.eq.${order_id},order_number.eq.${order_id}`)
      .maybeSingle();

    if (findError || !order) {
      return NextResponse.json({ error: "Pedido de compra nÃ£o encontrado." }, { status: 404 });
    }

    if (order.status === "PROVISIONADO" || order.provisioned_company_id) {
      return NextResponse.json(
        {
          error: "NÃ£o Ã© possÃ­vel excluir um pedido jÃ¡ provisionado. Ele possui empresa e gestor vinculados."
        },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase.from('pedidos_saas').delete().eq('id', order.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // Audit Log
    await supabase.from('audit_logs').insert([{
      id: `log_${Date.now()}`,
      company_id: "global",
      user_id: session?.userId || "super_adm",
      user_name: session?.name || "Super Admin",
      action: "EXCLUSAO_PEDIDO_COMPRA",
      resource: "pedidos_saas",
      details: `Pedido ${order.order_number || order.id} (${order.empresa_nome || ""}) excluÃ­do antes do provisionamento. Origem: ${order.origin_source || "landing_page"}.`,
      created_at: new Date().toISOString()
    }]);

    return NextResponse.json({
      success: true,
      message: `Pedido "${order.order_number || order.id}" excluÃ­do com sucesso.`
    });
  } catch (err: any) {
    console.error("Error deleting purchase order:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao excluir pedido." },
      { status: 500 }
    );
  }
}



