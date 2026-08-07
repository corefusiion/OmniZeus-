export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRefresh, getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";
import { decryptContaAzulFields, encryptContaAzulFields } from "@/lib/crypto/atRest";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

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

    const { data: dbDataConfigs } = await supabase.from('contaazul_config').select('*');
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

    // Fallback 1: Se não houver config exata para este company_id, mas existir qualquer config conectada no banco, aproveita-a
    if (connectedConfigs.length === 0 && decryptedConfigs.length > 0) {
      connectedConfigs = decryptedConfigs.filter((cfg: any) => !!(cfg.access_token || cfg.accessToken));
    }

    // Fallback 2: Buscar via getContaAzulTokens
    if (connectedConfigs.length === 0 && targetCompanyId) {
      const fileTokens = await getContaAzulTokens(targetCompanyId);
      const fallbackTokens = fileTokens.accessToken ? fileTokens : await getContaAzulTokens('comp_techcontabil_01');
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
      return NextResponse.json({
        success: false,
        error: "Nenhuma integração Conta Azul ativa encontrada. Acesse a aba 'Credenciais & OAuth 2.0' e clique em 'Autorizar via Navegador' para conectar.",
        results: [],
        synced_at: new Date().toISOString()
      }, { status: 400 });
    }

    const { data: companiesData } = await supabase.from('companies').select('*');
    const companies = companiesData || [];

    const syncResults: any[] = [];

    for (const cfg of connectedConfigs) {
      const companyId = (targetCompanyId && targetCompanyId !== "global") ? targetCompanyId : (cfg.company_id || "comp_techcontabil_01");
      const companyProfile = companies.find((c: any) => c.id === companyId);
      const companyName = companyProfile?.tradeName || companyProfile?.corporateName || companyId;

      let newCount = 0;
      let updatedCount = 0;
      let matchedCount = 0;
      let errorsCount = 0;
      let totalFetched = 0;

      try {
        const passedTokens = {
          accessToken: cfg.access_token,
          refreshToken: cfg.refresh_token,
          clientId: cfg.client_id,
          clientSecret: cfg.client_secret
        };        // 1. Fetch Pessoas (Clientes e Fornecedores) - 1 requisição principal de 100 itens
        let rawPessoas: any[] = [];
        let activeToken = cfg.access_token;
        let activeRefresh = cfg.refresh_token;

        const { res: customersRes, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh(
          `https://api-v2.contaazul.com/v1/pessoas?pagina=1&tamanho_pagina=100&size=100`,
          { method: "GET" },
          { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
          companyId
        );

        if (newAccessToken) activeToken = newAccessToken;
        if (newRefreshToken) activeRefresh = newRefreshToken;

        if (customersRes.ok) {
          const data = await customersRes.json().catch(() => ({}));
          const list = Array.isArray(data) ? data : (data.items || data.pessoas || data.customers || []);
          rawPessoas.push(...list);
        }

        // Tenta buscar no endpoint V1 de fornecedores se não encontrou fornecedores na busca principal
        const hasSuppliersInMain = rawPessoas.some((item: any) => {
          const perfisRaw = item.perfis || item.profiles || item.perfil || item.roles || [];
          const perfisArr = Array.isArray(perfisRaw) ? perfisRaw : [perfisRaw];
          return perfisArr.some((p: any) => {
            const str = (typeof p === 'string' ? p : (p?.tipo_perfil || p?.tipo || p?.name || p?.nome || '')).toUpperCase();
            return str.includes("FORNECEDOR") || str.includes("SUPPLIER");
          }) || item.is_supplier === true;
        });

        if (!hasSuppliersInMain && activeToken) {
          const suppRes = await fetchWithAutoRefresh(
            `https://api.contaazul.com/v1/compras/fornecedores?pagina=1&tamanho_pagina=100&size=100`,
            { method: "GET" },
            { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
            companyId
          );
          if (suppRes.newAccessToken) activeToken = suppRes.newAccessToken;
          if (suppRes.newRefreshToken) activeRefresh = suppRes.newRefreshToken;

          if (suppRes.res.ok) {
            const data = await suppRes.res.json().catch(() => ({}));
            const list = Array.isArray(data) ? data : (data.items || data.fornecedores || data.suppliers || []);
            for (const suppItem of list) {
              rawPessoas.push({ ...suppItem, is_supplier: true, tipo_perfil: "FORNECEDOR" });
            }
          }
        }

        // 2. Fetch Eventos Financeiros (1 requisição única de até 100 lançamentos)
        let entriesData: any[] = [];
        if (activeToken) {
          const entriesRes = await fetchWithAutoRefresh(
            `https://api.contaazul.com/v1/financeiro/eventos-financeiros?pagina=1&tamanho_pagina=100&size=100`,
            { method: "GET" },
            { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
            companyId
          );
          if (entriesRes.newAccessToken) activeToken = entriesRes.newAccessToken;
          if (entriesRes.newRefreshToken) activeRefresh = entriesRes.newRefreshToken;

          if (entriesRes.res.ok) {
            const eData = await entriesRes.res.json().catch(() => ({}));
            entriesData = Array.isArray(eData) ? eData : (eData.items || eData.eventos || []);
          }
        }

        // 3. Fetch Categorias (1 requisição única de Plano de Contas)
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
            const cData = await catsRes.res.json().catch(() => ({}));
            categoriesData = Array.isArray(cData) ? cData : (cData.items || cData.categorias || []);
          }
        }

        totalFetched = rawPessoas.length + entriesData.length + categoriesData.length;

        const scopedCustomers: any[] = [];
        const scopedSuppliers: any[] = [];

        for (const item of rawPessoas) {
          const nome = item.nome || item.name || item.fantasia || item.razao_social || "Sem nome";
          const docRaw = item.cpf_cnpj || item.cpf || item.cnpj || item.document || item.documento || "";
          const doc = String(docRaw).replace(/\D/g, "");
          const email = item.email || item.email_principal || "";
          const tel = item.telefone_celular || item.telefone || item.phone || item.celular || "";

          const perfisRaw = item.perfis || item.profiles || item.perfil || item.roles || [];
          const perfisArr = Array.isArray(perfisRaw) ? perfisRaw : [perfisRaw];
          
          let isSupp = perfisArr.some((p: any) => {
            const str = (typeof p === 'string' ? p : (p?.tipo_perfil || p?.tipo || p?.name || p?.nome || '')).toUpperCase();
            return str.includes("FORNECEDOR") || str.includes("SUPPLIER");
          }) || item.is_supplier === true || item.tipo_perfil === "Fornecedor" || item.tipo_perfil === "FORNECEDOR";

          const nameUpper = String(nome).toUpperCase();
          if (!isSupp && (nameUpper.includes("FORNECEDOR") || nameUpper.includes("SUPPLIER"))) {
            isSupp = true;
          }

          const itemId = String(item.id || `${isSupp ? 'supp' : 'cli'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);

          const itemSanitized = {
            id: itemId,
            company_id: companyId,
            nome: nome,
            name: nome,
            fantasia: item.fantasia || nome,
            email: email,
            cpf_cnpj: doc,
            document: doc,
            telefone: tel,
            phone: tel,
            telefone_celular: tel,
            tipo_pessoa: item.tipo_pessoa || item.person_type || (doc.length > 11 ? "Jurídica" : "Física"),
            person_type: item.tipo_pessoa || item.person_type || (doc.length > 11 ? "LEGAL_PERSON" : "NATURAL_PERSON"),
            codigo: item.codigo ? String(item.codigo) : null,
            observacoes: item.observacoes ? String(item.observacoes) : null,
            ativo: item.ativo ?? true,
            status: "Ativo",
            synced_at: new Date().toISOString()
          };

          if (isSupp) scopedSuppliers.push(itemSanitized);
          else scopedCustomers.push(itemSanitized);
        }

        if (scopedCustomers.length > 0) {
          let { data: upsertDataC, error: errC } = await supabase.from('contaazul_clients').upsert(scopedCustomers, { onConflict: 'id' }).select();
          if (errC) {
            console.error("[Auto-Sync] Error on upsert (onConflict: id), retrying standard upsert:", errC);
            const retry = await supabase.from('contaazul_clients').upsert(scopedCustomers).select();
            upsertDataC = retry.data;
            errC = retry.error;
          }
          if (errC) {
            console.error("[Auto-Sync] Final Error upserting contaazul_clients:", errC);
            errorsCount++;
          } else {
            newCount += upsertDataC?.length || scopedCustomers.length;
          }
        }
        
        if (scopedSuppliers.length > 0) {
          let { data: upsertDataS, error: errS } = await supabase.from('contaazul_suppliers').upsert(scopedSuppliers, { onConflict: 'id' }).select();
          if (errS) {
            const retry = await supabase.from('contaazul_suppliers').upsert(scopedSuppliers).select();
            upsertDataS = retry.data;
            errS = retry.error;
          }
          if (errS) {
            console.error("[Auto-Sync] Final Error upserting contaazul_suppliers:", errS);
            errorsCount++;
          } else {
            newCount += upsertDataS?.length || scopedSuppliers.length;
          }
        }

        const { data: existingEntriesRows } = await supabase.from('contaazul_entries').select('id, id_evento, situacao, status').eq('company_id', companyId);
        const existingEntries = existingEntriesRows || [];

        const { data: payablesRows } = await supabase.from('payables').select('*').or(`company_id.eq.${companyId},company_id.is.null`);
        const payables = payablesRows || [];

        const entriesToUpsert: any[] = [];

        for (const entry of entriesData) {
          const entryId = String(entry.id || entry.id_evento || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
          const entryVal = Number(entry.valor || entry.value || entry.val || entry.amount || 0);
          const entryStatus = String(entry.situacao || entry.status || "PENDENTE");
          const entryDesc = String(entry.description || entry.desc || entry.descricao || "Lançamento Conta Azul");
          const entryDueDate = String(entry.due_date || entry.vencimento || entry.data_vencimento || new Date().toISOString().split("T")[0]);

          const entryScoped = {
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
            category: entry.category || (typeof entry.categoria === 'object' ? entry.categoria?.nome : entry.categoria) || "Geral",
            tipo: entry.tipo || entry.type || (entryVal >= 0 ? "CREDIT" : "DEBIT"),
            type: entry.tipo || entry.type || (entryVal >= 0 ? "CREDIT" : "DEBIT"),
            id_evento: entry.id_evento || entryId,
            nome_pessoa: entry.nome_pessoa || entry.cliente || entry.fornecedor || (typeof entry.pessoa === 'object' ? entry.pessoa?.nome : null),
            cliente: entry.cliente || entry.nome_pessoa || null,
            fornecedor: entry.fornecedor || entry.nome_pessoa || null,
            data_pagamento: entry.data_pagamento || entry.paid_at || null,
            synced_at: new Date().toISOString()
          };

          const existingEntry = existingEntries.find((e: any) => (e.id === entryId || e.id_evento === entryId));

          let previousStatus = "";
          if (existingEntry) {
            previousStatus = existingEntry.situacao || existingEntry.status || "";
            updatedCount++;
          } else {
            newCount++;
          }
          
          entriesToUpsert.push(entryScoped);
        }

        if (entriesToUpsert.length > 0) {
          let { error: errE } = await supabase.from('contaazul_entries').upsert(entriesToUpsert, { onConflict: 'id' });
          if (errE) {
            await supabase.from('contaazul_entries').upsert(entriesToUpsert);
          }
        }
        
        if (categoriesData.length > 0) {
          const sanitizedCategories = categoriesData.map((cat: any) => ({
            id: String(cat.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
            name: cat.name || cat.nome || "Categoria",
            nome: cat.name || cat.nome || "Categoria",
            type: cat.type || cat.tipo || "CREDIT",
            tipo: cat.type || cat.tipo || "CREDIT"
          }));
          await supabase.from('contaazul_categories').upsert(sanitizedCategories, { onConflict: 'id' });
        }

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
        
        await supabase.from('contaazul_config').update({
          last_sync_at: now.toISOString(),
          next_sync_at: nextSync.toISOString(),
          access_token: encryptedCfg.access_token,
          refresh_token: encryptedCfg.refresh_token
        }).eq('company_id', companyId);

        const syncLog = {
          id: `log_sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          company_id: companyId,
          company_name: companyName,
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          total_fetched: totalFetched,
          new_count: newCount,
          updated_count: updatedCount,
          matched_count: matchedCount,
          errors_count: errorsCount,
          status: "success",
          message: `Sincronização concluída: ${newCount} novos, ${updatedCount} atualizados, ${matchedCount} reconciliados.`
        };

        await supabase.from('contaazul_sync_logs').insert(syncLog);
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
          message: `Falha na sincronização Conta Azul: ${err.message || 'Erro de conexão'}`
        };
        await supabase.from('contaazul_sync_logs').insert(errLog);
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



