export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRefresh, getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";
import { decryptContaAzulFields, encryptContaAzulFields } from "@/lib/crypto/atRest";
import { supabase } from "@/lib/db/supabaseClient";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const targetCompanyId = body.company_id || null;

    const { data: dbDataConfigs } = await supabase.from('contaazul_config').select('*');
    let configData = dbDataConfigs || [];

    if (configData.length === 0 && targetCompanyId) {
      const fileTokens = await getContaAzulTokens(targetCompanyId);
      if (fileTokens.accessToken) {
        configData.push({
          company_id: targetCompanyId,
          client_id: fileTokens.clientId,
          client_secret: fileTokens.clientSecret,
          access_token: fileTokens.accessToken,
          refresh_token: fileTokens.refreshToken,
          is_connected: true
        });
      }
    }

    const connectedConfigs = configData
      .map((cfg: any) => decryptContaAzulFields(cfg))
      .filter((cfg: any) => {
        if (!cfg.is_connected || !cfg.access_token) return false;
        if (targetCompanyId && targetCompanyId !== "global" && cfg.company_id !== targetCompanyId) return false;
        return true;
      });

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
      const companyId = cfg.company_id || "comp_zenitus";
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
        };

        // 1. Fetch Pessoas (Clientes e Fornecedores)
        let { res: customersRes, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh(
          "https://api-v2.contaazul.com/v1/pessoas",
          { method: "GET" },
          passedTokens,
          companyId
        );

        let rawPessoas: any[] = [];
        if (customersRes.ok) {
          const data = await customersRes.json().catch(() => ({}));
          rawPessoas = Array.isArray(data) ? data : (data.items || data.pessoas || data.customers || []);
        }

        const activeToken = newAccessToken || cfg.access_token;
        const activeRefresh = newRefreshToken || cfg.refresh_token;

        // 2. Fetch Eventos Financeiros / Contas a Pagar e Receber
        let entriesData: any[] = [];
        if (activeToken) {
          const entriesRes = await fetchWithAutoRefresh(
            "https://api.contaazul.com/v1/financeiro/eventos-financeiros",
            { method: "GET" },
            { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
            companyId
          );
          if (entriesRes.res.ok) {
            const eData = await entriesRes.res.json().catch(() => ({}));
            entriesData = Array.isArray(eData) ? eData : (eData.items || eData.eventos || []);
          }
        }

        // 3. Fetch Categorias
        let categoriesData: any[] = [];
        if (activeToken) {
          const catsRes = await fetchWithAutoRefresh(
            "https://api.contaazul.com/v1/financeiro/categorias",
            { method: "GET" },
            { accessToken: activeToken, refreshToken: activeRefresh, clientId: cfg.client_id, clientSecret: cfg.client_secret },
            companyId
          );
          if (catsRes.res.ok) {
            const cData = await catsRes.res.json().catch(() => ({}));
            categoriesData = Array.isArray(cData) ? cData : (cData.items || cData.categorias || []);
          }
        }

        totalFetched = rawPessoas.length + entriesData.length + categoriesData.length;

        const scopedCustomers: any[] = [];
        const scopedSuppliers: any[] = [];

        for (const item of rawPessoas) {
          const itemScoped = { ...item, company_id: companyId, synced_at: new Date().toISOString() };
          const perfisList = item.perfis || item.profiles || [];
          const isSupp = perfisList.some((p: any) =>
            p === "Fornecedor" || p === "FORNECEDOR" || p?.tipo_perfil === "Fornecedor"
          ) || item.roles?.includes("SUPPLIER") || item.is_supplier === true;

          if (isSupp) scopedSuppliers.push(itemScoped);
          else scopedCustomers.push(itemScoped);
        }

        if (scopedCustomers.length > 0) {
          const { data: upsertDataC } = await supabase.from('contaazul_clients').upsert(scopedCustomers, { onConflict: 'id,company_id' }).select();
          newCount += upsertDataC?.length || scopedCustomers.length;
        }
        
        if (scopedSuppliers.length > 0) {
          const { data: upsertDataS } = await supabase.from('contaazul_suppliers').upsert(scopedSuppliers, { onConflict: 'id,company_id' }).select();
          newCount += upsertDataS?.length || scopedSuppliers.length;
        }

        const { data: existingEntriesRows } = await supabase.from('contaazul_entries').select('id, id_evento, situacao, status').eq('company_id', companyId);
        const existingEntries = existingEntriesRows || [];

        const { data: payablesRows } = await supabase.from('payables').select('*').or(`company_id.eq.${companyId},company_id.is.null`);
        const payables = payablesRows || [];

        const entriesToUpsert = [];

        for (const entry of entriesData) {
          const entryId = entry.id || entry.id_evento;
          const entryScoped = {
            ...entry,
            company_id: companyId,
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

          const currentStatus = (entry.situacao || entry.status || "").toUpperCase();
          const isPaidInContaAzul = currentStatus === "PAGO" || currentStatus === "QUITADO" || currentStatus === "PAID";

          if (isPaidInContaAzul && previousStatus && previousStatus.toUpperCase() !== "PAGO") {
            const matchingPayable = payables.find((p: any) => {
              if (p.company_id && p.company_id !== companyId) return false;
              if (p.conta_azul_id === entryId) return true;
              const sameVendor = (p.creditor || p.fornecedor || "").toLowerCase().includes((entry.nome_pessoa || entry.cliente || "").toLowerCase());
              const sameValue = Math.abs(Number(p.valor || p.value_brl || 0) - Number(entry.valor || 0)) < 0.5;
              return sameVendor && sameValue;
            });

            if (matchingPayable) {
              await supabase.from('payables').update({
                status: "Pago",
                paid_at: entry.data_pagamento || new Date().toISOString(),
                conta_azul_id: entryId,
                reconciliation_status: "MATCHED_PAID"
              }).eq('id', matchingPayable.id);
              matchedCount++;
            }
          }

          const unlinkedPayables = payables.filter(
            (p: any) => (!p.company_id || p.company_id === companyId) && !p.conta_azul_id
          );

          for (const pay of unlinkedPayables) {
            const payVal = Number(pay.valor || pay.value_brl || 0);
            const payVendor = (pay.creditor || pay.fornecedor || "").toLowerCase();

            const entryVal = Number(entry.valor || 0);
            const entryVendor = (entry.nome_pessoa || entry.cliente || entry.fornecedor || "").toLowerCase();

            if (payVal > 0 && Math.abs(payVal - entryVal) < 0.5) {
              if (payVendor.length > 2 && entryVendor.length > 2 && (payVendor.includes(entryVendor) || entryVendor.includes(payVendor))) {
                const updateData: any = {
                  conta_azul_id: entryId,
                  reconciliation_status: "MATCHED"
                };
                if (isPaidInContaAzul && pay.status !== "Pago") {
                  updateData.status = "Pago";
                  updateData.paid_at = entry.data_pagamento || new Date().toISOString();
                }
                await supabase.from('payables').update(updateData).eq('id', pay.id);
                pay.conta_azul_id = entryId;
                pay.reconciliation_status = updateData.reconciliation_status;
                matchedCount++;
              }
            }
          }
        }
        
        if (entriesToUpsert.length > 0) {
          await supabase.from('contaazul_entries').upsert(entriesToUpsert, { onConflict: 'id,company_id' });
        }
        
        if (categoriesData.length > 0) {
          await supabase.from('contaazul_categories').upsert(categoriesData, { onConflict: 'id' });
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

        const encryptedCfg = encryptContaAzulFields({
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

