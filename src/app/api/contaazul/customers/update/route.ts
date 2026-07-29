import { NextResponse } from "next/server";
import { fetchWithAutoRefresh } from "@/lib/contaazul/store";

export async function PUT(req: Request) {
  try {
    const {
      accessToken, refreshToken, clientId, clientSecret,
      id, name, tradeName, document, email, phone, whatsapp, personType,
      roleIsClient, roleIsSupplier, roleIsCarrier,
      isSimples, stateRegistration, cityRegistration,
      zipCode, street, number, neighborhood, city, state, notes
    } = await req.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nome/Razão Social é obrigatório." },
        { status: 400 }
      );
    }

    const cleanDoc = document ? document.replace(/\D/g, "") : "";
    const isCnpj = cleanDoc.length > 11;
    const pTypePt = personType === "ESTRANGEIRA" ? "Estrangeira" : (isCnpj ? "Jurídica" : "Física");

    // Build perfis array - format: [{tipo_perfil: 'Cliente'}] (ContaAzul PersonProfilesCreate model)
    const perfisArr: { tipo_perfil: string }[] = [];
    if (roleIsClient) perfisArr.push({ tipo_perfil: "Cliente" });
    if (roleIsSupplier) perfisArr.push({ tipo_perfil: "Fornecedor" });
    if (roleIsCarrier) perfisArr.push({ tipo_perfil: "Transportadora" });
    const perfis = perfisArr.length > 0 ? perfisArr : [{ tipo_perfil: "Cliente" }];

    const passedTokens = { accessToken, refreshToken, clientId, clientSecret };

    if (id) {
      // ===== EDIT EXISTING: Use PATCH =====
      const patchPayload: Record<string, any> = {
        nome: name.trim(),
        fantasia: tradeName ? tradeName.trim() : name.trim(),
        tipo_pessoa: pTypePt,
        perfis,
        optante_simples_nacional: isSimples ?? false,
      };
      
      if (cleanDoc) {
        if (isCnpj) patchPayload.cnpj = cleanDoc;
        else patchPayload.cpf = cleanDoc;
      }

      if (email) patchPayload.email = email.trim();
      if (whatsapp || phone) patchPayload.telefone_celular = (whatsapp || phone).trim();
      
      if (stateRegistration || cityRegistration) {
        patchPayload.inscricoes = [{
          inscricao_estadual: stateRegistration ? stateRegistration.trim() : undefined,
          inscricao_municipal: cityRegistration ? cityRegistration.trim() : undefined,
        }];
      }
      
      if (notes) patchPayload.observacao = notes.trim();
      if (zipCode) {
        patchPayload.enderecos = [{
          cep: zipCode.replace(/\D/g, ""),
          logradouro: street ? street.trim() : undefined,
          numero: number ? number.trim() : undefined,
          complemento: "", 
          bairro: neighborhood ? neighborhood.trim() : undefined,
          cidade: city ? city.trim() : undefined,
          estado: state ? state.trim() : undefined
        }];
      }

      const { res, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh(
        `https://api-v2.contaazul.com/v1/pessoas/${id}`,
        { method: "PATCH", body: JSON.stringify(patchPayload) },
        passedTokens
      );

      // PATCH returns 204 No Content on success
      if (res.status === 204 || res.ok) {
        return NextResponse.json({
          success: true,
          customer: { id, nome: name, tipo_pessoa: pTypePt, perfis },
          new_access_token: newAccessToken,
          new_refresh_token: newRefreshToken,
          message: `Dados de '${name}' atualizados e sincronizados com sucesso na ContaAzul!`
        });
      }

      const errData = await res.json().catch(() => ({}));
      let rawError = errData.message || errData.error_description || errData.error || `Erro HTTP ${res.status}`;
      if (res.status === 401) {
        rawError = "Sua sessão da ContaAzul expirou. Feche esta janela, acesse a aba 'Credenciais & OAuth 2.0' e clique em 'Autorizar via Navegador' para renovar.";
      }
      return NextResponse.json(
        { success: false, error: rawError },
        { status: res.status }
      );

    } else {
      // ===== CREATE NEW via this route (no ID) =====
      if (!document) {
        return NextResponse.json(
          { success: false, error: "CPF/CNPJ é obrigatório para novo cadastro." },
          { status: 400 }
        );
      }

      const createPayload: Record<string, any> = {
        nome: name.trim(),
        fantasia: tradeName ? tradeName.trim() : name.trim(),
        tipo_pessoa: pTypePt,
        perfis,
        optante_simples_nacional: isSimples ?? false,
        email: email ? email.trim() : undefined,
        telefone_celular: (whatsapp || phone) ? (whatsapp || phone).trim() : undefined,
        observacao: notes ? notes.trim() : undefined,
        enderecos: zipCode ? [{
          cep: zipCode.replace(/\D/g, ""),
          logradouro: street ? street.trim() : undefined,
          numero: number ? number.trim() : undefined,
          complemento: "",
          bairro: neighborhood ? neighborhood.trim() : undefined,
          cidade: city ? city.trim() : undefined,
          estado: state ? state.trim() : undefined
        }] : undefined,
        inscricoes: (stateRegistration || cityRegistration) ? [{
          inscricao_estadual: stateRegistration ? stateRegistration.trim() : undefined,
          inscricao_municipal: cityRegistration ? cityRegistration.trim() : undefined,
        }] : undefined
      };
      
      if (isCnpj) createPayload.cnpj = cleanDoc;
      else createPayload.cpf = cleanDoc;

      const { res, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh(
        "https://api-v2.contaazul.com/v1/pessoas",
        { method: "POST", body: JSON.stringify(createPayload) },
        passedTokens
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const rawError = data.message || data.error_description || data.error || `Erro HTTP ${res.status}`;
        return NextResponse.json({ success: false, error: rawError }, { status: res.status });
      }

      return NextResponse.json({
        success: true,
        customer: data,
        new_access_token: newAccessToken,
        new_refresh_token: newRefreshToken,
        message: `Cliente '${name}' cadastrado com sucesso na ContaAzul!`
      });
    }

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Falha ao atualizar cliente na ContaAzul." },
      { status: 500 }
    );
  }
}
