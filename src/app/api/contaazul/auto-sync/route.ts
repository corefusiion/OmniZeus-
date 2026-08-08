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
        let activeToken = cfg.access_token as string;
        let activeRefresh = cfg.refresh_token as string;

        // ─── 1. Fetch Pessoas via API v2 & v1 ──────────────────────────────────
        let rawPessoas: any[] = [];

        const makeTokens = () => ({
          accessToken: activeToken,
          refreshToken: activeRefresh,
          clientId: cfg.client_id,
          clientSecret: cfg.client_secret
        });

        // Endpoints candidatos para busca de Pessoas / Clientes / Fornecedores
        const pessoasEndpoints = [
          { name: "v2_pessoas", url: `https://api-v2.contaazul.com/v1/pessoas` },
          { name: "v2_pessoas_pag", url: `https://api-v2.contaazul.com/v1/pessoas?pagina=1&tamanho_pagina=100` },
          { name: "v1_customers", url: `https://api.contaazul.com/v1/customers` },
          { name: "v1_sales_customers", url: `https://api.contaazul.com/v1/sales/customers` }
        ];

        for (const ep of pessoasEndpoints) {
          const { res, newAccessToken: nat, newRefreshToken: nrt } = await fetchWithAutoRefresh(
            ep.url,
            { method: "GET" },
            makeTokens(),
            companyId
          );
          if (nat) activeToken = nat;
          if (nrt) activeRefresh = nrt;

          if (res.ok) {
            const data = await safeJson(res);
            const list = extractList(data, "pessoas", "clientes", "customers");
            if (list.length > 0) {
              const existingIds = new Set(rawPessoas.map((p: any) => String(p.id)));
              const novos = list.filter((p: any) => !existingIds.has(String(p.id)));
              rawPessoas.push(...novos);
              apiDebug[ep.name] = `HTTP 200 → ${list.length} obtidos (${novos.length} novos)`;
              break;
            } else {
              apiDebug[ep.name] = `HTTP 200 → 0 registros (payload: ${previewPayload(data)})`;
            }
          } else {
            apiDebug[ep.name] = `HTTP ${res.status}`;
          }
        }

        // 1b. Busca específica de Fornecedores via endpoints dedicados
        const suppEndpoints = [
          { name: "v1_suppliers", url: `https://api.contaazul.com/v1/suppliers` },
          { name: "v1_compras_fornecedores", url: `https://api.contaazul.com/v1/compras/fornecedores` }
        ];

        for (const ep of suppEndpoints) {
          const { res, newAccessToken: nat, newRefreshToken: nrt } = await fetchWithAutoRefresh(
            ep.url,
            { method: "GET" },
            makeTokens(),
            companyId
          );
          if (nat) activeToken = nat;
          if (nrt) activeRefresh = nrt;

          if (res.ok) {
            const data = await safeJson(res);
            const list = extractList(data, "pessoas", "fornecedores", "suppliers");
            if (list.length > 0) {
              const existingIds = new Set(rawPessoas.map((p: any) => String(p.id)));
              const novos = list.filter((p: any) => !existingIds.has(String(p.id)));
              novos.forEach((p: any) => { p._force_supplier = true; });
              rawPessoas.push(...novos);
              apiDebug[ep.name] = `HTTP 200 → ${list.length} obtidos (${novos.length} novos fornecedores)`;
              break;
            }
          } else {
            apiDebug[ep.name] = `HTTP ${res.status}`;
          }
        }

        console.log(`[Auto-Sync][${companyId}] Total rawPessoas: ${rawPessoas.length}`);

        // ─── 2. Fetch Financeiro via API v2 & v1 ───────────────────────────────
        let entriesData: any[] = [];
        const financeEndpoints = [
          { name: "v2_eventos_financeiros", url: `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros` },
          { name: "v2_eventos_pag", url: `https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros?pagina=1&tamanho_pagina=100` },
          { name: "v1_vendas", url: `https://api.contaazul.com/v1/sales` },
          { name: "v1_compras", url: `https://api.contaazul.com/v1/purchases` },
          { name: "v1_eventos_financeiros", url: `https://api.contaazul.com/v1/financeiro/eventos-financeiros` },
          { name: "v1_lancamentos", url: `https://api.contaazul.com/v1/financeiro/lancamentos` }
        ];

        for (const ep of financeEndpoints) {
          const { res, newAccessToken: nat, newRefreshToken: nrt } = await fetchWithAutoRefresh(
            ep.url,
            { method: "GET" },
            makeTokens(),
            companyId
          );
          if (nat) activeToken = nat;
          if (nrt) activeRefresh = nrt;

          if (res.ok) {
            const data = await safeJson(res);
            const list = extractList(data, "eventos", "lancamentos", "parcelas", "financeiro", "vendas", "compras", "sales", "purchases");
            if (list.length > 0) {
              entriesData = list;
              apiDebug[ep.name] = `HTTP 200 → ${list.length} lançamentos extraídos`;
              break;
            } else {
              apiDebug[ep.name] = `HTTP 200 → 0 registros`;
            }
          } else {
            apiDebug[ep.name] = `HTTP ${res.status}`;
          }
        }

        // ─── 3. Fetch Categorias (Plano de Contas) ────────────────────────────
        let categoriesData: any[] = [];
        const categoryEndpoints = [
          { name: "v1_categorias", url: `https://api.contaazul.com/v1/financeiro/categorias` },
          { name: "v2_categorias", url: `https://api-v2.contaazul.com/v1/financeiro/categorias` },
          { name: "v1_categories", url: `https://api.contaazul.com/v1/categories` }
        ];

        for (const ep of categoryEndpoints) {
          const { res, newAccessToken: nat, newRefreshToken: nrt } = await fetchWithAutoRefresh(
            ep.url,
            { method: "GET" },
            makeTokens(),
            companyId
          );
          if (nat) activeToken = nat;
          if (nrt) activeRefresh = nrt;

          if (res.ok) {
            const data = await safeJson(res);
            const list = extractList(data, "categorias", "content", "items", "categories");
            if (list.length > 0) {
              categoriesData = list;
              apiDebug[ep.name] = `HTTP 200 → ${list.length} categorias extraídas`;
              break;
            }
          } else {
            apiDebug[ep.name] = `HTTP ${res.status}`;
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
          // _force_supplier = marcado na busca com filtro perfis=FORNECEDOR
          const perfisRaw =
            item.perfis || item.profiles || item.perfil || item.roles || item.tipos_perfil || [];
          const perfisArr = Array.isArray(perfisRaw) ? perfisRaw : [perfisRaw];

          let isSupp =
            item._force_supplier === true ||
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

          let isCli =
            item.is_customer === true ||
            item.tipo_perfil === "Cliente" ||
            item.tipo_perfil === "CLIENTE" ||
            item.perfil === "CLIENTE" ||
            perfisArr.some((p: any) => {
              const str = (
                typeof p === "string"
                  ? p
                  : p?.tipo_perfil || p?.tipo || p?.name || p?.nome || p?.type || ""
              ).toUpperCase();
              return str.includes("CLIENTE") || str.includes("CUSTOMER");
            });

          // Fallback por nome (heurística)
          const nameUpper = String(nome).toUpperCase();
          if (nameUpper.includes("FORNECEDOR") || nameUpper.includes("SUPPLIER")) {
            isSupp = true;
          }

          const itemId = String(
            item.id || `pessoa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
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

          if (isSupp) {
            scopedSuppliers.push(itemSanitized);
          }
          if (isCli || !isSupp) {
            scopedCustomers.push(itemSanitized);
          }
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

        // Verifica se todas as chamadas retornaram erro HTTP 401/403/400
        const debugValues = Object.values(apiDebug);
        const hasAuthError = debugValues.some(v => v.includes("HTTP 401") || v.includes("HTTP 403"));
        const allFailed = debugValues.length > 0 && debugValues.every(v => v.includes("HTTP 4") || v.includes("HTTP 5"));

        let statusText = errorsCount === 0 ? "success" : "partial";
        let messageText = `Sync: ${customersCount} clientes, ${suppliersCount} fornecedores, ${entriesCount} lançamentos, ${categoriesCount} categorias${errorsCount > 0 ? ` (${errorsCount} erros)` : ""}`;

        if (totalSaved === 0) {
          if (hasAuthError || allFailed) {
            statusText = "error";
            errorsCount++;
            messageText = "Atenção: Conexão com Conta Azul precisa de autorização (Token expirado ou HTTP 401/403). Acesse a aba 'Credenciais & OAuth 2.0' e clique em 'Autorizar via Navegador'.";
          } else if (debugValues.length > 0) {
            messageText = `Sync concluído. 0 novos registros encontrados no Conta Azul (status: ${debugValues.join(" | ")})`;
          }
        }

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
          status: statusText,
          message: messageText,
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
