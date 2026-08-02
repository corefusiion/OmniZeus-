export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { fetchWithAutoRefresh, getContaAzulTokens } from "@/lib/contaazul/store";
import { supabase } from "@/lib/db/supabaseClient";

export async function POST(req: Request) {
  try {
    const { 
      accessToken, refreshToken, clientId, clientSecret, 
      description, value, dueDate, competenceDate, type, 
      customerId, supplierId, categoryId, notes 
    } = await req.json();

    if (!description || !value || !dueDate) {
      return NextResponse.json(
        { success: false, error: "Descrição, valor e data de vencimento são obrigatórios." },
        { status: 400 }
      );
    }

    const storedTokens = await getContaAzulTokens();
    const passedTokens = { 
      accessToken: accessToken || storedTokens.accessToken, 
      refreshToken: refreshToken || storedTokens.refreshToken, 
      clientId: clientId || storedTokens.clientId, 
      clientSecret: clientSecret || storedTokens.clientSecret 
    };

    const numValue = Number(value);
    const isoDueDate = new Date(dueDate).toISOString();
    const isReceita = (type || "").includes("RECEITA") || type === "RECEBIMENTO";

    let res: Response | undefined;
    let newAccessToken: string | undefined;
    let newRefreshToken: string | undefined;
    let data: any = {};

    if (isReceita) {
      // 1. Endpoint v1 para Vendas / Receitas
      const salesPayload = {
        number: Math.floor(Date.now() / 1000) % 100000,
        emission: new Date().toISOString(),
        status: "COMMITTED",
        customer_id: customerId || undefined,
        services: [
          {
            name: description.trim(),
            quantity: 1,
            value: numValue
          }
        ],
        payment: {
          type: "CASH",
          installments: [
            {
              number: 1,
              value: numValue,
              due_date: isoDueDate,
              status: "PENDING"
            }
          ]
        },
        notes: notes || undefined
      };

      const salesRes = await fetchWithAutoRefresh(
        "https://api.contaazul.com/v1/sales",
        {
          method: "POST",
          body: JSON.stringify(salesPayload)
        },
        passedTokens
      );

      res = salesRes.res;
      newAccessToken = salesRes.newAccessToken;
      newRefreshToken = salesRes.newRefreshToken;
    } else {
      // 2. Endpoint v1 para Despesas / Compras (Contas a Pagar)
      const expensePayload = {
        description: description.trim(),
        value: numValue,
        due_date: dueDate,
        competence_date: competenceDate || dueDate,
        type: "PAGAMENTO",
        supplier_id: supplierId || undefined,
        category_id: categoryId || undefined,
        notes: notes || undefined
      };

      const expRes = await fetchWithAutoRefresh(
        "https://api.contaazul.com/v1/financial-events",
        {
          method: "POST",
          body: JSON.stringify(expensePayload)
        },
        passedTokens
      );

      res = expRes.res;
      newAccessToken = expRes.newAccessToken;
      newRefreshToken = expRes.newRefreshToken;
    }

    if (res && res.ok) {
      data = await res.json().catch(() => ({}));
    } else {
      // Fallback para API v2 lancamentos (se v1 falhar com qualquer erro)
      console.log("[ContaAzul Entries] Tentando fallback para API-v2 lancamentos...");
      const fallbackPayload = {
        descricao: description.trim(),
        valor: numValue,
        data_vencimento: dueDate,
        data_competencia: competenceDate || dueDate,
        tipo: isReceita ? "RECEBIMENTO" : "PAGAMENTO",
        cliente_id: customerId || undefined,
        fornecedor_id: supplierId || undefined,
        categoria_id: categoryId || undefined
      };

      const v2Res = await fetchWithAutoRefresh(
        "https://api-v2.contaazul.com/v1/financeiro/lancamentos",
        {
          method: "POST",
          body: JSON.stringify(fallbackPayload)
        },
        passedTokens
      );

      if (v2Res.res.ok) {
        res = v2Res.res;
        data = await v2Res.res.json().catch(() => ({}));
        if (v2Res.newAccessToken) newAccessToken = v2Res.newAccessToken;
        if (v2Res.newRefreshToken) newRefreshToken = v2Res.newRefreshToken;
      } else {
        const v2Err = await v2Res.res.json().catch(() => ({}));
        console.error("[ContaAzul Entries Fallback Error]:", v2Err);
        if (!res || !res.ok) {
          res = v2Res.res;
          data = v2Err;
        }
      }
    }

    // Se as APIs da ContaAzul falharem, reporta o erro limpo ao usuário sem salvar entrada falsa
    if (res && !res.ok) {
      const rawErr = data?.message || data?.error_description || data?.error || (Array.isArray(data) ? data[0]?.message : undefined);
      let cleanError = rawErr;
      if (res.status === 401 || rawErr === "invalid_token") {
        cleanError = "Sua sessão OAuth da ContaAzul expirou. Acesse a aba 'Credenciais & OAuth 2.0' e clique no botão 'Autorizar via Navegador' para reativar o acesso.";
      } else if (!cleanError) {
        cleanError = `ContaAzul HTTP ${res.status}: Rejeitado. Verifique as credenciais ou dados digitados.`;
      }
      
      return NextResponse.json(
        { success: false, error: cleanError, raw: data },
        { status: res.status }
      );
    }

    // Grava no banco local OmniZeus se a ContaAzul aceitou o lançamento real!
    const newEntryObj = {
      id: data?.id || `ent_${Date.now()}`,
      desc: description,
      description,
      val: numValue,
      value: numValue,
      dueDate,
      vencimento: dueDate,
      type,
      status: "Em Aberto",
      created_at: new Date().toISOString()
    };

    await supabase.from("contaazul_entries").insert(newEntryObj);

    return NextResponse.json({
      success: true,
      entry: newEntryObj,
      new_access_token: newAccessToken,
      new_refresh_token: newRefreshToken,
      message: `Lançamento '${description}' registrado com sucesso na ContaAzul!`
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Falha ao registrar lançamento." },
      { status: 500 }
    );
  }
}



