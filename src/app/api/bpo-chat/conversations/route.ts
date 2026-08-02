import { NextResponse, NextRequest } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    const { searchParams } = new URL(req.url);
    const superAdminOverride = searchParams.get("companyId") || req.headers.get("x-company-id");

    const userId = session?.userId || searchParams.get("userId") || "super_adm";
    const companyId = (session?.role === "super_adm" && superAdminOverride)
      ? superAdminOverride
      : (session?.companyId || superAdminOverride || "comp_zenitus");

    let query = supabase.from("conversations").select("*").eq("deleted", 0);
    
    // Sort by pinned desc, last_message_at desc
    const { data: dbConversations, error } = await query
      .order("pinned", { ascending: false })
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    const filtered = (dbConversations || []).filter((c: any) => 
      (c.user_id === userId || session?.role === "super_adm") && 
      (c.company_id === companyId || !c.company_id)
    );

    return NextResponse.json({ success: true, conversations: filtered });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    const body = await req.json();
    const { title, model, provider } = body;
    
    const userId = session?.userId || body.userId || "super_adm";
    const companyId = session?.companyId || body.companyId || "comp_zenitus";
    const tenantId = body.tenantId || companyId;

    const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newConv = {
      id: convId,
      tenant_id: tenantId,
      company_id: companyId,
      user_id: userId,
      title: title || "Nova Conversa BPO",
      model: model || "google/gemini-2.5-pro",
      provider: provider || "openrouter",
      created_at: now,
      updated_at: now,
      last_message_at: now,
      pinned: 0,
      archived: 0,
      deleted: 0
    };

    const { error } = await supabase.from("conversations").insert(newConv);
    if (error) throw error;

    return NextResponse.json({ success: true, conversation: newConv });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, pinned } = await req.json();
    
    const { error } = await supabase.from("conversations").update({ pinned: pinned ? 1 : 0 }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: "Status fixado atualizado." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    const { searchParams } = new URL(req.url);
    const convId = searchParams.get("id");

    if (!convId) {
      return NextResponse.json({ success: false, error: "ID da conversa ausente." }, { status: 400 });
    }

    const { data: conv } = await supabase.from("conversations").select("*").eq("id", convId).single();
    if (conv) {
      // Only allow delete if owner or super_adm
      if (session && session.role !== "super_adm" && conv.company_id && conv.company_id !== session.companyId) {
        return NextResponse.json({ success: false, error: "Não autorizado a excluir." }, { status: 403 });
      }
      
      await supabase.from("conversations").update({ deleted: 1 }).eq("id", convId);
      await supabase.from("messages").delete().eq("conversation_id", convId);
    }

    return NextResponse.json({ success: true, message: "Conversa excluída com sucesso." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}


