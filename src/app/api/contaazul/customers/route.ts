import { NextResponse } from "next/server";
import { fetchWithAutoRefresh } from "@/lib/contaazul/store";

export async function POST(req: Request) {
  try {
    const { 
      accessToken, refreshToken, clientId, clientSecret, 
      name, tradeName, document, email, phone, whatsapp, personType,
      code, roles, roleIsClient, roleIsSupplier, roleIsCarrier,
      isSimples, isPublicOrg, stateRegistration, cityRegistration, suframa,
      zipCode, street, number, neighborhood, city, state, complement, notes
    } = await req.json();

    if (!name || !document) {
      return NextResponse.json(
        { success: false, error: "Nome/Razão Social e CPF/CNPJ são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanDoc = document.replace(/\D/g, "");
    const isCnpj = cleanDoc.length > 11;
    // Explicit accented person type
    const pTypePt = personType === "ESTRANGEIRA" ? "Estrangeira" : (isCnpj ? "Jurídica" : "Física");

    // Build perfis array - format: [{tipo_perfil: 'Cliente'}] (ContaAzul PersonProfilesCreate model)
    const perfisArr: { tipo_perfil: string }[] = [];
    if (roleIsClient) perfisArr.push({ tipo_perfil: "Cliente" });
    if (roleIsSupplier) perfisArr.push({ tipo_perfil: "Fornecedor" });
    if (roleIsCarrier) perfisArr.push({ tipo_perfil: "Transportadora" });
    const perfis = perfisArr.length > 0 ? perfisArr : [{ tipo_perfil: "Cliente" }];

    const payloadPtFull = {
      nome: name.trim(),
      fantasia: tradeName ? tradeName.trim() : name.trim(),
      tipo_pessoa: pTypePt,
      cpf_cnpj: cleanDoc,
      codigo: code ? code.trim() : undefined,
      email: email ? email.trim() : undefined,
      telefone_celular: (whatsapp || phone) ? (whatsapp || phone).trim() : undefined,
      inscricao_estadual: stateRegistration ? stateRegistration.trim() : undefined,
      inscricao_municipal: cityRegistration ? cityRegistration.trim() : undefined,
      optante_simples: isSimples ?? false,
      observacoes: notes ? notes.trim() : undefined,
      perfis,
      endereco: zipCode ? {
        cep: zipCode.replace(/\D/g, ""),
        logradouro: street ? street.trim() : undefined,
        numero: number ? number.trim() : undefined,
        bairro: neighborhood ? neighborhood.trim() : undefined,
        cidade: city ? city.trim() : undefined,
        estado: state ? state.trim() : undefined,
        complemento: complement ? complement.trim() : undefined
      } : undefined
    };

    const db = getLocalDbFile();
    const config = db.contaazul_config || {};

    const finalAccessToken = accessToken || config.access_token;
    const finalRefreshToken = refreshToken || config.refresh_token;
    const finalClientId = clientId || config.client_id;
    const finalClientSecret = clientSecret || config.client_secret;

    if (!finalAccessToken || !finalClientId) {
      return NextResponse.json(
        { success: false, error: "Credenciais da ContaAzul não configuradas. Acesse a aba 'Credenciais & OAuth 2.0' e conecte sua conta oficial." },
        { status: 401 }
      );
    }

    const passedTokens = { 
      accessToken: finalAccessToken, 
      refreshToken: finalRefreshToken, 
      clientId: finalClientId, 
      clientSecret: finalClientSecret 
    };

    // 1. Try v2 pessoas
    let { res, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh("https://api-v2.contaazul.com/v1/pessoas", {
      method: "POST",
      body: JSON.stringify(payloadPtFull)
    }, passedTokens);

    if (!res.ok) {
      // 2. Try v1 sales/customers fallback
      const fallbackResult = await fetchWithAutoRefresh("https://api.contaazul.com/v1/sales/customers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          company_name: name.trim(),
          trade_name: tradeName ? tradeName.trim() : name.trim(),
          person_type: isCnpj ? "LEGAL" : "NATURAL",
          document: cleanDoc,
          email: email ? email.trim() : undefined,
          phone: phone ? phone.trim() : undefined,
          mobile_phone: whatsapp ? whatsapp.trim() : undefined
        })
      }, passedTokens);
      
      if (fallbackResult.res.ok) {
        res = fallbackResult.res;
        if (fallbackResult.newAccessToken) newAccessToken = fallbackResult.newAccessToken;
        if (fallbackResult.newRefreshToken) newRefreshToken = fallbackResult.newRefreshToken;
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const rawError = data.message || data.error_description || data.error || (Array.isArray(data) ? data[0]?.message : null);
      const cleanError = rawError || `A API da ContaAzul recusou o cadastro (HTTP ${res.status}). Verifique o documento.`;

      console.error("[ContaAzul POST Customer Error]:", res.status, data);

      return NextResponse.json(
        { success: false, error: cleanError, raw: data },
        { status: res.status }
      );
    }

    // Se a chamada oficial tiver sucesso real na API externa, salvamos no cache local
    if (!Array.isArray(db.contaazul_clients)) db.contaazul_clients = [];
    db.contaazul_clients.push({
      id: data.id || `cliente_${Date.now()}`,
      nome: name.trim(),
      cpf_cnpj: cleanDoc,
      email: email ? email.trim() : "",
      telefone: (whatsapp || phone) ? (whatsapp || phone).trim() : "",
      ativo: true
    });
    
    // Atualiza os tokens caso tenham sido renovados no auto-refresh
    if (newAccessToken && newRefreshToken) {
      db.contaazul_config = {
        ...db.contaazul_config,
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        updated_at: new Date().toISOString()
      };
    }
    
    saveLocalDbFile(db);

    return NextResponse.json({
      success: true,
      customer: data,
      new_access_token: newAccessToken,
      new_refresh_token: newRefreshToken,
      message: `Cliente '${name}' cadastrado com sucesso no ERP ContaAzul Oficial!`
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Falha ao comunicar com a ContaAzul externa." },
      { status: 500 }
    );
  }
}
