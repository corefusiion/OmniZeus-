export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

/**
 * GET /api/contaazul/ia-workspace/history
 * Lista conversas do workspace IA
 */
export async function GET(req: NextRequest) {
  try {
    const { data: conversations, error } = await supabase
      .from("contaazul_ia_conversations")
      .select("*")
      .order("updatedAt", { ascending: false });

    if (error) throw error;
    
    return NextResponse.json({ success: true, data: conversations || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/contaazul/ia-workspace/history
 * Cria ou atualiza uma conversa
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, conversation } = body;

    if (action === "create") {
      const newConv = {
        id: conversation?.id || `conv_${Date.now()}`,
        title: conversation?.title || "Nova Consulta",
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
      };
      const { error } = await supabase.from("contaazul_ia_conversations").insert(newConv);
      if (error) throw error;
      return NextResponse.json({ success: true, conversation: newConv });
    }

    if (action === "update" && conversation?.id) {
      const { error } = await supabase
        .from("contaazul_ia_conversations")
        .update({ ...conversation, updatedAt: new Date().toISOString() })
        .eq("id", conversation.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "delete" && conversation?.id) {
      const { error: err1 } = await supabase
        .from("contaazul_ia_conversations")
        .delete()
        .eq("id", conversation.id);
      if (err1) throw err1;

      // Também remover mensagens da conversa
      const { error: err2 } = await supabase
        .from("contaazul_ia_messages")
        .delete()
        .eq("conversation_id", conversation.id);
      if (err2) throw err2;

      return NextResponse.json({ success: true });
    }

    if (action === "pin" && conversation?.id) {
      const { data: currentConv } = await supabase
        .from("contaazul_ia_conversations")
        .select("isPinned")
        .eq("id", conversation.id)
        .single();
      
      if (currentConv) {
        const { error } = await supabase
          .from("contaazul_ia_conversations")
          .update({ isPinned: !currentConv.isPinned })
          .eq("id", conversation.id);
        if (error) throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === "get_messages" && conversation?.id) {
      const { data: messages, error } = await supabase
        .from("contaazul_ia_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, data: messages || [] });
    }

    return NextResponse.json({ success: false, error: "Ação inválida." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}



