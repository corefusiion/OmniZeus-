export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { fetchWithAutoRefresh } from "@/lib/contaazul/store";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accessToken, refreshToken, clientId, clientSecret, supplier, companyId } = body;

    if (!supplier || !supplier.name || !supplier.document) {
      return NextResponse.json(
        { success: false, error: "Nome/Razão Social e CPF/CNPJ são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanDoc = supplier.document.replace(/\D/g, "");
    const isCnpj = cleanDoc.length > 11;
    const pTypePt = supplier.personType === "Física" ? "Física" : (supplier.personType === "Estrangeira" ? "Estrangeira" : "Jurídica");

    // Construção dos papéis no formato ContaAzul v2 pessoas: [{ tipo_perfil: "Fornecedor" }]
    const perfisArr: { tipo_perfil: string }[] = [{ tipo_perfil: "Fornecedor" }];
    if (supplier.roleIsClient) perfisArr.push({ tipo_perfil: "Cliente" });
    if (supplier.roleIsCarrier) perfisArr.push({ tipo_perfil: "Transportadora" });

    // Payload completo v2 pessoas
    const payloadV2 = {
      nome: supplier.name.trim(),
      fantasia: (supplier.tradeName || supplier.name).trim(),
      tipo_pessoa: pTypePt,
      cpf_cnpj: cleanDoc,
      codigo: supplier.code ? supplier.code.trim() : undefined,
      email: supplier.email ? supplier.email.trim() : undefined,
      telefone_celular: supplier.phone ? supplier.phone.trim() : undefined,
      telefone_comercial: supplier.phone ? supplier.phone.trim() : undefined,
      inscricao_estadual: supplier.stateRegistration ? supplier.stateRegistration.trim() : undefined,
      inscricao_municipal: supplier.cityRegistration ? supplier.cityRegistration.trim() : undefined,
      optante_simples: supplier.isSimples ?? false,
      observacoes: supplier.notes ? supplier.notes.trim() : undefined,
      perfis: perfisArr,
      endereco: supplier.zipCode ? {
        cep: supplier.zipCode.replace(/\D/g, ""),
        logradouro: supplier.street ? supplier.street.trim() : undefined,
        numero: supplier.number ? supplier.number.trim() : undefined,
        bairro: supplier.neighborhood ? supplier.neighborhood.trim() : undefined,
        cidade: supplier.city ? supplier.city.trim() : undefined,
        estado: supplier.state ? supplier.state.trim() : undefined,
        complemento: supplier.complement ? supplier.complement.trim() : undefined
      } : undefined
    };

    const passedTokens = { accessToken, refreshToken, clientId, clientSecret };

    // 1. Tentar Endpoint V2 /v1/pessoas (Padrão Unificado ContaAzul)
    let { res, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh(
      "https://api-v2.contaazul.com/v1/pessoas",
      {
        method: "POST",
        body: JSON.stringify(payloadV2)
      },
      passedTokens
    );

    // 2. Fallback v1/fornecedores
    if (!res.ok) {
      console.warn("[ContaAzul] V2 /v1/pessoas falhou com status:", res.status, ". Tentando fallback v1/fornecedores...");
      
      const payloadV1 = {
        name: supplier.name.trim(),
        company_name: supplier.name.trim(),
        trade_name: (supplier.tradeName || supplier.name).trim(),
        email: supplier.email ? supplier.email.trim() : undefined,
        business_phone: supplier.phone ? supplier.phone.trim() : undefined,
        document: cleanDoc,
        person_type: isCnpj ? "LEGAL" : "PHYSICAL"
      };

      const fallbackResult = await fetchWithAutoRefresh(
        "https://api.contaazul.com/v1/fornecedores",
        {
          method: "POST",
          body: JSON.stringify(payloadV1)
        },
        passedTokens
      );

      if (fallbackResult.res.ok) {
        res = fallbackResult.res;
        if (fallbackResult.newAccessToken) newAccessToken = fallbackResult.newAccessToken;
        if (fallbackResult.newRefreshToken) newRefreshToken = fallbackResult.newRefreshToken;
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const rawError = data.message || data.error_description || data.error || (Array.isArray(data) ? data[0]?.message : null);
      const cleanError = rawError || `A API da ContaAzul recusou o cadastro de fornecedor (HTTP ${res.status}). Verifique os dados.`;

      console.error("[ContaAzul POST Supplier Error]:", res.status, data);

      return NextResponse.json(
        { success: false, error: cleanError, raw: data },
        { status: res.status }
      );
    }

    // Persistir no supabase
    await supabase.from("contaazul_suppliers").insert({
      id: data.id || `fornecedor_${Date.now()}`,
      company_id: companyId || "comp_zenitus",
      nome: supplier.name.trim(),
      name: supplier.name.trim(),
      cpf_cnpj: cleanDoc,
      document: cleanDoc,
      email: supplier.email ? supplier.email.trim() : "",
      telefone: supplier.phone ? supplier.phone.trim() : "",
      synced_at: new Date().toISOString(),
      ativo: true
    });

    return NextResponse.json({
      success: true,
      supplier: data,
      new_access_token: newAccessToken,
      new_refresh_token: newRefreshToken,
      message: `Fornecedor '${supplier.name}' cadastrado com sucesso no ERP ContaAzul!`
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Erro interno ao processar a criação de fornecedor." },
      { status: 500 }
    );
  }
}



