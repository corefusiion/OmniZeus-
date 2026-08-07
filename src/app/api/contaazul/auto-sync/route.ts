export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRefresh, getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";
import { decryptContaAzulFields, encryptContaAzulFields } from "@/lib/crypto/atRest";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

/** Lê JSON da resposta de forma segura — retorna {} se o corpo for HTML ou inválido */
async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    if (!text || text.trimStart().startsWith("<")) {
      console.warn("[Auto-Sync] Resposta HTML recebida (esperado JSON):", text.substring(0, 200));
      return {};
    }
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** Extrai array de um payload que pode usar diferentes estruturas.
 * Suporta padrões: array direto, items, itens (PT-BR), content (Spring),
 * data, results, e quaisquer chaves extras passadas. */
function extractList(data: any, ...extraKeys: string[]): any[] {
  if (Array.isArray(data)) return data;
  // "itens" = plural português usado pela Conta Azul API v2
  const keys = ["items", "itens", "content", "data", "results", "registros", "lista", ...extraKeys];
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

/** Retorna preview seguro da estrutura de um payload para diagnóstico */
function previewPayload(data: any): string {
  if (data === null || data === undefined) return "null/undefined";
  if (Array.isArray(data)) return `Array(${data.length}) [${JSON.stringify(data[0]).substring(0, 60)}...]`;
  if (typeof data === "object") {
    const keys = Object.keys(data);
    const arrayKey = keys.find(k => Array.isArray(data[k]));
    if (arrayKey) return `Object{keys:[${keys.join(",")}]} → ${arrayKey}: Array(${data[arrayKey].length})`;
    return `Object{keys:[${keys.join(",")}]}`;
  }
  return String(data).substring(0, 80);
}

/** Upsert resiliente: tenta onConflict composto, depois simples, depois insert individual */
async function resilientUpsert(
  tableName: string,
  records: any[],
  conflictColumn = "id"
): Promise<{ count: number; errors: number }> {
  if (records.length === 0) return { count: 0, errors: 0 };

  // Tentativa 1: onConflict composto id,company_id (PK composta do novo script SQL)
  const { data: d1, error: e1 } = await supabase
    .from(tableName)
    .upsert(records, { onConflict: "id,company_id" })
    .select("id");

  if (!e1) {
    return { count: d1?.length ?? records.length, errors: 0 };
  }

  console.warn(`[Auto-Sync] onConflict composto falhou em ${tableName}:`, e1.message, "— tentando onConflict simples...");

  // Tentativa 2: onConflict simples (PK simples em id)
  const { data: d2, error: e2 } = await supabase
    .from(tableName)
    .upsert(records, { onConflict: conflictColumn })
    .select("id");

  if (!e2) {
    return { count: d2?.length ?? records.length, errors: 0 };
  }

  console.warn(`[Auto-Sync] onConflict simples também falhou em ${tableName}:`, e2.message, "— tentando upsert sem onConflict...");

  // Tentativa 3: upsert sem onConflict (deixa o Supabase resolver)
  const { data: d3, error: e3 } = await supabase.from(tableName).upsert(records).select("id");

  if (!e3) {
    return { count: d3?.length ?? records.length, errors: 0 };
  }

  console.error(`[Auto-Sync] ERRO FINAL em ${tableName}:`, e3.message);
  return { count: 0, errors: 1 };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const targetCompanyId = body.company_id || body.companyId || "comp_techcontabil_01";
    const passedAccessToken = body.accessToken || body.access_token;
    const passedRefreshToken = body.refreshToken || body.refresh_token;
    const passedClientId = body.clientId || body.client_id;
    const passedClientSecret = body.clientSecret || body.client_secret;

    if (passedAccessToken && targetCompanyId) {
      await saveContaAzulTokens(targetCompanyId, {
        accessToken: passedAccessToken,
        refreshToken: passedRefreshToken,
        clientId: passedClientId,
        clientSecret: passedClientSecret
      });
    }

    const { data: dbDataConfigs } = await supabase.from("contaazul_config").select("*");
    let configData = dbDataConfigs || [];

    let decryptedConfigs = await Promise.all(
      configData.map(async (cfg: any) => await decryptContaAzulFields(cfg))
    );

    let connectedConfigs = decryptedConfigs.filter((cfg: any) => {
      const hasToken = !!(cfg.access_token || cfg.accessToken);
      if (!hasToken) return false;
      if (targetCompanyId && targetCompanyId !== "global") {
        if (cfg.company_id && cfg.company_id !== targetCompanyId && cfg.company_id !== "global") {
          return false;
        }
      }
      return true;
    });

    // Fallback 1: qualquer config conectada
    if (connectedConfigs.length === 0 && decryptedConfigs.length > 0) {
      connectedConfigs = decryptedConfigs.filter((cfg: any) => !!(cfg.access_token || cfg.accessToken));
    }

    // Fallback 2: tokens via getContaAzulTokens
    if (connectedConfigs.length === 0 && targetCompanyId) {
      const fileTokens = await getContaAzulTokens(targetCompanyId);
      const fallbackTokens = fileTokens.accessToken
        ? fileTokens
        : await getContaAzulTokens("comp_techcontabil_01");
      if (fallbackTokens.accessToken) {
        connectedConfigs.push({
          company_id: targetCompanyId,
          client_id: fallbackTokens.clientId,
          client_secret: fallbackTokens.clientSecret,
          access_token: fallbackTokens.accessToken,
          refresh_token: fallbackTokens.refreshToken,
          is_connected: true
        });
      }
    }

    if (connectedConfigs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Nenhuma integração Conta Azul ativa encontrada. Acesse a aba 'Credenciais & OAuth 2.0' e clique em 'Autorizar via Navegador' para conectar.",
          results: [],
          synced_at: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const { data: companiesData } = await supabase.from("companies").select("*");
    const companies = companiesData || [];

    const syncResults: any[] = [];

    for (const cfg of connectedConfigs) {
      const companyId =
        targetCompanyId && targetCompanyId !== "global"
          ? targetCompanyId
          : cfg.company_id || "comp_techcontabil_01";
      const companyProfile = companies.find((c: any) => c.id === companyId);
      const companyName =
        companyProfile?.tradeName || companyProfile?.corporateName || companyId;

      let customersCount = 0;
      let suppliersCount = 0;
      let entriesCount = 0;
      let categoriesCount = 0;
      let errorsCount = 0;
      // Rastreamento de cada chamada para diagnóstico em produção
      const apiDebug: Record<string, string> = {};

      try {
        const passedTokens = {
          accessToken: cfg.access_token,
          refreshToken: cfg.refresh_token,
          clientId: cfg.client_id,
          clientSecret: cfg.client_secret
        };

        let activeToken = cfg.access_token as string;
        let activeRefresh = cfg.refresh_token as string;

        // ─── 1. Fetch Pessoas (Clientes + Fornecedores) ────────────────────────
        // Busca 1a: lista geral de pessoas (clientes e fornecedores misturados)
        let rawPessoas: any[] = [];

        const { res: pessoasRes, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh(
          `https://api-v2.contaazul.com/v1/pessoas?pagina=1&tamanho_pagina=100&size=100`,
          { method: "GET" },
          passedTokens,
          companyId
        );
        if (newAccessToken) activeToken = newAccessToken;
        if (newRefreshToken) activeRefresh = newRefreshToken;

        if (pessoasRes.ok) {
          const data = await safeJson(pessoasRes);
          rawPessoas.push(...extractList(data, "pessoas", "customers"));
          apiDebug["pessoas_v2"] = `HTTP 200 → ${previewPayload(data)} → ${rawPessoas.length} extraídos`;
          console.log(`[Auto-Sync][${companyId}] /v1/pessoas → ${rawPessoas.length} registros`);
        } else {
          const errBody = await safeJson(pessoasRes);
          apiDebug["pessoas_v2"] = `HTTP ${pessoasRes.status} → ${JSON.stringify(errBody).substring(0, 200)}`;
          console.warn(`[Auto-Sync][${companyId}] /v1/pessoas HTTP ${pessoasRes.status}:`, JSON.stringify(errBody).substring(0, 300));
        }

        // Busca 1b: tentativa de buscar especificamente fornecedores via /v1/pessoas?perfis=FORNECEDOR
        // Apenas se a lista principal não trouxe fornecedores identificados
        const hasSuppliersInMain = rawPessoas.some((item: any) => {
          const perfisRaw = item.perfis || item.profiles || item.perfil || item.roles || item.tipos_perfil || [];
          const perfisArr = Array.isArray(perfisRaw) ? perfisRaw : [perfisRaw];
          return (
            perfisArr.some((p: any) => {
              const str = (
                typeof p === "string"
                  ? p
                  : p?.tipo_perfil || p?.tipo || p?.name || p?.nome || p?.type || ""
              ).toUpperCase();
              return str.includes("FORNECEDOR") || str.includes("SUPPLIER");
            }) ||
            item.is_supplier === true ||
            item.tipo_perfil === "Fornecedor" ||
            item.tipo_perfil === "FORNECEDOR" ||
            item.perfil === "FORNECEDOR"
          );
        });

        if (!hasSuppliersInMain && activeToken) {
          // Tentativa via endpoint /v1/compras/fornecedores
          const suppRes = await fetchWithAutoRefresh(
            `https://api.contaazul.com/v1/compras/fornecedores?pagina=1&tamanho_pagina=100&size=100`,
            { method: "GET" },
            { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
            companyId
          );
          if (suppRes.newAccessToken) activeToken = suppRes.newAccessToken;
          if (suppRes.newRefreshToken) activeRefresh = suppRes.newRefreshToken;

          if (suppRes.res.ok) {
            const data = await safeJson(suppRes.res);
            const list = extractList(data, "fornecedores", "suppliers");
            apiDebug["fornecedores_v1"] = `HTTP 200 → ${previewPayload(data)} → ${list.length} extraídos`;
            console.log(`[Auto-Sync][${companyId}] /v1/compras/fornecedores → ${list.length} registros`);
            for (const suppItem of list) {
              rawPessoas.push({ ...suppItem, is_supplier: true, tipo_perfil: "FORNECEDOR" });
            }
          } else {
            const errBody = await safeJson(suppRes.res);
            apiDebug["fornecedores_v1"] = `HTTP ${suppRes.res.status} → ${JSON.stringify(errBody).substring(0, 150)}`;
            console.warn(
              `[Auto-Sync][${companyId}] /v1/compras/fornecedores HTTP ${suppRes.res.status}:`,
              JSON.stringify(errBody).substring(0, 200)
            );

            // Fallback: tentar endpoint v2 com filtro de perfil
            const suppRes2 = await fetchWithAutoRefresh(
              `https://api-v2.contaazul.com/v1/pessoas?pagina=1&tamanho_pagina=100&perfis=FORNECEDOR`,
              { method: "GET" },
              { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
              companyId
            );
            if (suppRes2.newAccessToken) activeToken = suppRes2.newAccessToken;
            if (suppRes2.newRefreshToken) activeRefresh = suppRes2.newRefreshToken;

            if (suppRes2.res.ok) {
              const data2 = await safeJson(suppRes2.res);
              const list2 = extractList(data2, "pessoas", "fornecedores");
              apiDebug["fornecedores_v2_perfil"] = `HTTP 200 → ${previewPayload(data2)} → ${list2.length} extraídos`;
              console.log(`[Auto-Sync][${companyId}] /v1/pessoas?perfis=FORNECEDOR → ${list2.length} registros`);
              for (const item of list2) {
                rawPessoas.push({ ...item, is_supplier: true });
              }
            } else {
              apiDebug["fornecedores_v2_perfil"] = `HTTP ${suppRes2.res.status}`;
            }
          }
        }

        // ─── 2. Fetch Eventos Financeiros ──────────────────────────────────────
        let entriesData: any[] = [];
        if (activeToken) {
          // Tentativa principal: /v1/financeiro/eventos-financeiros
          const entriesRes = await fetchWithAutoRefresh(
            `https://api.contaazul.com/v1/financeiro/eventos-financeiros?pagina=1&tamanho_pagina=100&size=100`,
            { method: "GET" },
            { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
            companyId
          );
          if (entriesRes.newAccessToken) activeToken = entriesRes.newAccessToken;
          if (entriesRes.newRefreshToken) activeRefresh = entriesRes.newRefreshToken;

          if (entriesRes.res.ok) {
            const eData = await safeJson(entriesRes.res);
            entriesData = extractList(eData, "eventos", "lancamentos", "financeiro");
            apiDebug["eventos_financeiros"] = `HTTP 200 → ${previewPayload(eData)} → ${entriesData.length} extraídos`;
            console.log(`[Auto-Sync][${companyId}] /v1/financeiro/eventos-financeiros → ${entriesData.length} registros`);
          } else {
            const errBody = await safeJson(entriesRes.res);
            apiDebug["eventos_financeiros"] = `HTTP ${entriesRes.res.status} → ${JSON.stringify(errBody).substring(0, 200)}`;
            console.warn(
              `[Auto-Sync][${companyId}] /v1/financeiro/eventos-financeiros HTTP ${entriesRes.res.status}:`,
              JSON.stringify(errBody).substring(0, 300)
            );

            // Fallback A: /v1/financeiro/lancamentos
            if (activeToken) {
              const lancRes = await fetchWithAutoRefresh(
                `https://api.contaazul.com/v1/financeiro/lancamentos?pagina=1&tamanho_pagina=100`,
                { method: "GET" },
                { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
                companyId
              );
              if (lancRes.newAccessToken) activeToken = lancRes.newAccessToken;
              if (lancRes.newRefreshToken) activeRefresh = lancRes.newRefreshToken;

              if (lancRes.res.ok) {
                const lData = await safeJson(lancRes.res);
                entriesData = extractList(lData, "lancamentos", "eventos");
                apiDebug["lancamentos_fallback"] = `HTTP 200 → ${previewPayload(lData)} → ${entriesData.length} extraídos`;
                console.log(`[Auto-Sync][${companyId}] /v1/financeiro/lancamentos → ${entriesData.length} registros`);
              } else {
                apiDebug["lancamentos_fallback"] = `HTTP ${lancRes.res.status}`;
                console.warn(
                  `[Auto-Sync][${companyId}] /v1/financeiro/lancamentos HTTP ${lancRes.res.status} — ambos endpoints financeiros falharam.`,
                  "Verifique se o token tem scope 'financeiro:read'."
                );
              }
            }
          }
        }

        // ─── 3. Fetch Categorias (Plano de Contas) ────────────────────────────
        let categoriesData: any[] = [];
        if (activeToken) {
          const catsRes = await fetchWithAutoRefresh(
            "https://api.contaazul.com/v1/financeiro/categorias",
            { method: "GET" },
            { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
            companyId
          );
          if (catsRes.newAccessToken) activeToken = catsRes.newAccessToken;
          if (catsRes.newRefreshToken) activeRefresh = catsRes.newRefreshToken;

          if (catsRes.res.ok) {
            const cData = await safeJson(catsRes.res);
            categoriesData = extractList(cData, "categorias", "plano_contas", "planoContas");
            apiDebug["categorias_v1"] = `HTTP 200 → ${previewPayload(cData)} → ${categoriesData.length} extraídas`;
            console.log(`[Auto-Sync][${companyId}] /v1/financeiro/categorias → ${categoriesData.length} registros`);
          } else {
            const errBody = await safeJson(catsRes.res);
            apiDebug["categorias_v1"] = `HTTP ${catsRes.res.status} → ${JSON.stringify(errBody).substring(0, 150)}`;
            console.warn(
              `[Auto-Sync][${companyId}] /v1/financeiro/categorias HTTP ${catsRes.res.status}:`,
              JSON.stringify(errBody).substring(0, 200)
            );

            // Fallback: /v2/financeiro/categorias
            if (activeToken) {
              const cats2Res = await fetchWithAutoRefresh(
                "https://api-v2.contaazul.com/v1/financeiro/categorias",
                { method: "GET" },
                { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
                companyId
              );
              if (cats2Res.res.ok) {
                const c2Data = await safeJson(cats2Res.res);
                categoriesData = extractList(c2Data, "categorias", "plano_contas");
                apiDebug["categorias_v2"] = `HTTP 200 → ${previewPayload(c2Data)} → ${categoriesData.length} extraídas`;
                console.log(`[Auto-Sync][${companyId}] /v2/financeiro/categorias → ${categoriesData.length} registros`);
              } else {
                apiDebug["categorias_v2"] = `HTTP ${cats2Res.res.status}`;
              }
            }
          }
        }

        // ─── 4. Classificar e Salvar Clientes + Fornecedores ──────────────────
        const scopedCustomers: any[] = [];
        const scopedSuppliers: any[] = [];

        for (const item of rawPessoas) {
          const nome = item.nome || item.name || item.fantasia || item.razao_social || "Sem nome";
          const docRaw = item.cpf_cnpj || item.cpf || item.cnpj || item.document || item.documento || "";
          const doc = String(docRaw).replace(/\D/g, "");
          const email = item.email || item.email_principal || "";
          const tel = item.telefone_celular || item.telefone || item.phone || item.celular || "";

          // Classificação de fornecedor — múltiplas formas da API Conta Azul
          const perfisRaw =
            item.perfis || item.profiles || item.perfil || item.roles || item.tipos_perfil || [];
          const perfisArr = Array.isArray(perfisRaw) ? perfisRaw : [perfisRaw];

          let isSupp =
            item.is_supplier === true ||
            item.tipo_perfil === "Fornecedor" ||
            item.tipo_perfil === "FORNECEDOR" ||
            item.perfil === "FORNECEDOR" ||
            perfisArr.some((p: any) => {
              const str = (
                typeof p === "string"
                  ? p
                  : p?.tipo_perfil || p?.tipo || p?.name || p?.nome || p?.type || ""
              ).toUpperCase();
              return str.includes("FORNECEDOR") || str.includes("SUPPLIER");
            });

          // Fallback por nome (heurística)
          if (!isSupp) {
            const nameUpper = String(nome).toUpperCase();
            if (nameUpper.includes("FORNECEDOR") || nameUpper.includes("SUPPLIER")) {
              isSupp = true;
            }
          }

          const itemId = String(
            item.id || `${isSupp ? "supp" : "cli"}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
          );

          const itemSanitized = {
            id: itemId,
            company_id: companyId,
            nome,
            name: nome,
            fantasia: item.fantasia || nome,
            email,
            cpf_cnpj: doc,
            document: doc,
            telefone: tel,
            phone: tel,
            telefone_celular: tel,
            tipo_pessoa:
              item.tipo_pessoa || item.person_type || (doc.length > 11 ? "Jurídica" : "Física"),
            person_type:
              item.tipo_pessoa || item.person_type || (doc.length > 11 ? "LEGAL_PERSON" : "NATURAL_PERSON"),
            codigo: item.codigo ? String(item.codigo) : null,
            observacoes: item.observacoes ? String(item.observacoes) : null,
            ativo: item.ativo ?? true,
            status: "Ativo",
            synced_at: new Date().toISOString()
          };

          if (isSupp) scopedSuppliers.push(itemSanitized);
          else scopedCustomers.push(itemSanitized);
        }

        console.log(
          `[Auto-Sync][${companyId}] Classificação: ${scopedCustomers.length} clientes, ${scopedSuppliers.length} fornecedores`
        );

        // Salvar clientes
        if (scopedCustomers.length > 0) {
          const { count, errors } = await resilientUpsert("contaazul_clients", scopedCustomers);
          customersCount = count;
          errorsCount += errors;
        }

        // Salvar fornecedores
        if (scopedSuppliers.length > 0) {
          const { count, errors } = await resilientUpsert("contaazul_suppliers", scopedSuppliers);
          suppliersCount = count;
          errorsCount += errors;
        }

        // ─── 5. Salvar Lançamentos Financeiros ────────────────────────────────
        const entriesToUpsert: any[] = [];

        for (const entry of entriesData) {
          const entryId = String(
            entry.id || entry.id_evento || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
          );
          const entryVal = Number(entry.valor || entry.value || entry.val || entry.amount || 0);
          const entryStatus = String(entry.situacao || entry.status || "PENDENTE");
          const entryDesc = String(
            entry.description || entry.desc || entry.descricao || entry.titulo || "Lançamento Conta Azul"
          );
          const entryDueDate = String(
            entry.due_date ||
              entry.vencimento ||
              entry.data_vencimento ||
              entry.data_lancamento ||
              new Date().toISOString().split("T")[0]
          );

          entriesToUpsert.push({
            id: entryId,
            company_id: companyId,
            description: entryDesc,
            desc: entryDesc,
            value: entryVal,
            val: entryVal,
            valor: entryVal,
            due_date: entryDueDate,
            vencimento: entryDueDate,
            status: entryStatus,
            situacao: entryStatus,
            category:
              entry.category ||
              (typeof entry.categoria === "object" ? entry.categoria?.nome : entry.categoria) ||
              entry.plano_conta?.nome ||
              "Geral",
            tipo: entry.tipo || entry.type || (entryVal >= 0 ? "CREDIT" : "DEBIT"),
            type: entry.tipo || entry.type || (entryVal >= 0 ? "CREDIT" : "DEBIT"),
            id_evento: entry.id_evento || entryId,
            nome_pessoa:
              entry.nome_pessoa ||
              entry.cliente ||
              entry.fornecedor ||
              (typeof entry.pessoa === "object" ? entry.pessoa?.nome : null) ||
              entry.contato?.nome ||
              null,
            cliente: entry.cliente || entry.nome_pessoa || null,
            fornecedor: entry.fornecedor || entry.nome_pessoa || null,
            data_pagamento: entry.data_pagamento || entry.paid_at || entry.data_liquidacao || null,
            synced_at: new Date().toISOString()
          });
        }

        if (entriesToUpsert.length > 0) {
          const { count, errors } = await resilientUpsert("contaazul_entries", entriesToUpsert);
          entriesCount = count;
          errorsCount += errors;
          console.log(`[Auto-Sync][${companyId}] contaazul_entries: ${count} gravados`);
        }

        // ─── 6. Salvar Categorias ─────────────────────────────────────────────
        if (categoriesData.length > 0) {
          const sanitizedCategories = categoriesData.map((cat: any) => ({
            id: String(
              cat.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
            ),
            name: cat.name || cat.nome || cat.descricao || "Categoria",
            nome: cat.name || cat.nome || cat.descricao || "Categoria",
            type: cat.type || cat.tipo || cat.natureza || "CREDIT",
            tipo: cat.type || cat.tipo || cat.natureza || "CREDIT"
          }));

          // Categorias usam PK simples (sem company_id) — onConflict: 'id'
          const { error: catErr } = await supabase
            .from("contaazul_categories")
            .upsert(sanitizedCategories, { onConflict: "id" });

          if (catErr) {
            console.warn("[Auto-Sync] Erro em contaazul_categories:", catErr.message);
            // Fallback sem onConflict
            const { error: catErr2 } = await supabase
              .from("contaazul_categories")
              .upsert(sanitizedCategories);
            if (catErr2) {
              console.error("[Auto-Sync] ERRO FINAL em contaazul_categories:", catErr2.message);
              errorsCount++;
            } else {
              categoriesCount = sanitizedCategories.length;
            }
          } else {
            categoriesCount = sanitizedCategories.length;
          }

          console.log(`[Auto-Sync][${companyId}] contaazul_categories: ${categoriesCount} gravados`);
        }

        // ─── 7. Atualizar tokens e config ─────────────────────────────────────
        if (activeToken && activeRefresh) {
          await saveContaAzulTokens(companyId, {
            accessToken: activeToken,
            refreshToken: activeRefresh,
            clientId: cfg.client_id,
            clientSecret: cfg.client_secret
          });
        }

        const now = new Date();
        const nextSync = new Date(now.getTime() + 10 * 60 * 1000);

        const encryptedCfg = await encryptContaAzulFields({
          access_token: activeToken,
          refresh_token: activeRefresh
        });

        await supabase
          .from("contaazul_config")
          .update({
            last_sync_at: now.toISOString(),
            next_sync_at: nextSync.toISOString(),
            access_token: encryptedCfg.access_token,
            refresh_token: encryptedCfg.refresh_token
          })
          .eq("company_id", companyId);

        const totalFetched = rawPessoas.length + entriesData.length + categoriesData.length;
        const totalSaved = customersCount + suppliersCount + entriesCount + categoriesCount;

        const syncLog = {
          id: `log_sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          company_id: companyId,
          company_name: companyName,
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          total_fetched: totalFetched,
          new_count: totalSaved,
          updated_count: 0,
          matched_count: 0,
          errors_count: errorsCount,
          status: errorsCount === 0 ? "success" : "partial",
          message: `Sync: ${customersCount} clientes, ${suppliersCount} fornecedores, ${entriesCount} lançamentos, ${categoriesCount} categorias${errorsCount > 0 ? ` (${errorsCount} erros)` : ""}`,
          api_debug: apiDebug
        };

        await supabase.from("contaazul_sync_logs").insert(syncLog);
        syncResults.push(syncLog);
      } catch (err: any) {
        errorsCount++;
        console.error(`Error syncing company ${companyId}:`, err);
        const errLog = {
          id: `log_sync_err_${Date.now()}`,
          company_id: companyId,
          company_name: companyName,
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          total_fetched: 0,
          new_count: 0,
          updated_count: 0,
          matched_count: 0,
          errors_count: 1,
          status: "error",
          message: `Falha na sincronização Conta Azul: ${err.message || "Erro de conexão"}`
        };
        await supabase.from("contaazul_sync_logs").insert(errLog);
        syncResults.push(errLog);
      }
    }

    return NextResponse.json({
      success: true,
      results: syncResults,
      synced_at: new Date().toISOString(),
      next_sync_in_minutes: 10
    });
  } catch (err: any) {
    console.error("Error in Conta Azul Auto-Sync:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erro no motor de sincronização automática Conta Azul." },
      { status: 500 }
    );
  }
}
