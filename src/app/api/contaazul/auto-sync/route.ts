import { NextRequest, NextResponse } from "next/server";
import { fetchWithAutoRefresh, getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getLocalDb() {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) return {};
    let raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveLocalDb(db: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {}
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const targetCompanyId = body.company_id || null;

    const dbData = getLocalDb();

    if (!Array.isArray(dbData.contaazul_config)) {
      // Migração: objeto legado → array preservando dados existentes
      const existing = dbData.contaazul_config || {};
      if (existing.access_token || existing.client_id) {
        dbData.contaazul_config = [{ ...existing, company_id: existing.company_id || targetCompanyId || "comp_zenitus" }];
      } else {
        dbData.contaazul_config = [];
      }
    }

    if (!Array.isArray(dbData.companies)) {
      dbData.companies = [];
    }

    if (!Array.isArray(dbData.contaazul_sync_logs)) {
      dbData.contaazul_sync_logs = [];
    }

    // Filter companies to sync: if targetCompanyId is provided, sync only that company; otherwise sync all connected companies
    const connectedConfigs = dbData.contaazul_config.filter((cfg: any) => {
      if (!cfg.is_connected || !cfg.access_token) return false;
      if (targetCompanyId && targetCompanyId !== "global" && cfg.company_id !== targetCompanyId) return false;
      return true;
    });

    // Buscar tokens no arquivo per-company como fallback se nenhuma config conectada no DB
    if (connectedConfigs.length === 0 && targetCompanyId) {
      const fileTokens = getContaAzulTokens(targetCompanyId);
      if (fileTokens.accessToken) {
        connectedConfigs.push({
          company_id: targetCompanyId,
          client_id: fileTokens.clientId,
          client_secret: fileTokens.clientSecret,
          access_token: fileTokens.accessToken,
          refresh_token: fileTokens.refreshToken,
          is_connected: true
        });
      }
    }

    // Aviso explícito: nenhuma empresa com integração ativa encontrada
    if (connectedConfigs.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Nenhuma integração Conta Azul ativa encontrada. Acesse a aba 'Credenciais & OAuth 2.0' e clique em 'Autorizar via Navegador' para conectar.",
        results: [],
        synced_at: new Date().toISOString()
      }, { status: 400 });
    }

    const syncResults: any[] = [];

    for (const cfg of connectedConfigs) {
      const companyId = cfg.company_id || "comp_zenitus";
      const companyProfile = dbData.companies.find((c: any) => c.id === companyId);
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

        // Separate Customers vs Suppliers with company_id scoping
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

        // Incremental Update for `contaazul_clients` and `contaazul_suppliers`
        if (!Array.isArray(dbData.contaazul_clients)) dbData.contaazul_clients = [];
        if (!Array.isArray(dbData.contaazul_suppliers)) dbData.contaazul_suppliers = [];
        if (!Array.isArray(dbData.contaazul_entries)) dbData.contaazul_entries = [];
        if (!Array.isArray(dbData.contaazul_categories)) dbData.contaazul_categories = [];
        if (!Array.isArray(dbData.payables)) dbData.payables = [];

        for (const cust of scopedCustomers) {
          const idx = dbData.contaazul_clients.findIndex((c: any) => c.id === cust.id && c.company_id === companyId);
          if (idx !== -1) {
            dbData.contaazul_clients[idx] = { ...dbData.contaazul_clients[idx], ...cust };
            updatedCount++;
          } else {
            dbData.contaazul_clients.push(cust);
            newCount++;
          }
        }

        for (const supp of scopedSuppliers) {
          const idx = dbData.contaazul_suppliers.findIndex((s: any) => s.id === supp.id && s.company_id === companyId);
          if (idx !== -1) {
            dbData.contaazul_suppliers[idx] = { ...dbData.contaazul_suppliers[idx], ...supp };
            updatedCount++;
          } else {
            dbData.contaazul_suppliers.push(supp);
            newCount++;
          }
        }

        // 4. PROCESS FINANCIAL ENTRIES & DETECT STATUS CHANGES (PENDENTE -> PAGO)
        for (const entry of entriesData) {
          const entryId = entry.id || entry.id_evento;
          const entryScoped = {
            ...entry,
            company_id: companyId,
            synced_at: new Date().toISOString()
          };

          const existingIdx = dbData.contaazul_entries.findIndex(
            (e: any) => (e.id === entryId || e.id_evento === entryId) && e.company_id === companyId
          );

          let previousStatus = "";
          if (existingIdx !== -1) {
            previousStatus = dbData.contaazul_entries[existingIdx].situacao || dbData.contaazul_entries[existingIdx].status || "";
            dbData.contaazul_entries[existingIdx] = { ...dbData.contaazul_entries[existingIdx], ...entryScoped };
            updatedCount++;
          } else {
            dbData.contaazul_entries.push(entryScoped);
            newCount++;
          }

          // Detect Status Change to PAID and update internal BPO Payables automatically!
          const currentStatus = (entry.situacao || entry.status || "").toUpperCase();
          const isPaidInContaAzul = currentStatus === "PAGO" || currentStatus === "QUITADO" || currentStatus === "PAID";

          if (isPaidInContaAzul && previousStatus && previousStatus.toUpperCase() !== "PAGO") {
            // Find matching payable in internal BPO payables
            const matchingPayable = dbData.payables.find((p: any) => {
              if (p.company_id && p.company_id !== companyId) return false;
              if (p.conta_azul_id === entryId) return true;
              // CNPJ/Vendor + Value + Date Matching
              const sameVendor = (p.creditor || p.fornecedor || "").toLowerCase().includes((entry.nome_pessoa || entry.cliente || "").toLowerCase());
              const sameValue = Math.abs(Number(p.valor || p.value_brl || 0) - Number(entry.valor || 0)) < 0.5;
              return sameVendor && sameValue;
            });

            if (matchingPayable) {
              matchingPayable.status = "Pago";
              matchingPayable.paid_at = entry.data_pagamento || new Date().toISOString();
              matchingPayable.conta_azul_id = entryId;
              matchingPayable.reconciliation_status = "MATCHED_PAID";
              matchedCount++;
            }
          }

          // 5. MATCHING BETWEEN INTERNAL PAYABLES AND CONTA AZUL ENTRIES
          const unlinkedPayables = dbData.payables.filter(
            (p: any) => (!p.company_id || p.company_id === companyId) && !p.conta_azul_id
          );

          for (const pay of unlinkedPayables) {
            const payVal = Number(pay.valor || pay.value_brl || 0);
            const payVendor = (pay.creditor || pay.fornecedor || "").toLowerCase();

            const entryVal = Number(entry.valor || 0);
            const entryVendor = (entry.nome_pessoa || entry.cliente || entry.fornecedor || "").toLowerCase();

            if (payVal > 0 && Math.abs(payVal - entryVal) < 0.5) {
              if (payVendor.length > 2 && entryVendor.length > 2 && (payVendor.includes(entryVendor) || entryVendor.includes(payVendor))) {
                pay.conta_azul_id = entryId;
                pay.reconciliation_status = "MATCHED";
                if (isPaidInContaAzul && pay.status !== "Pago") {
                  pay.status = "Pago";
                  pay.paid_at = entry.data_pagamento || new Date().toISOString();
                }
                matchedCount++;
              }
            }
          }
        }

        // Save updated tokens
        if (activeToken && activeRefresh) {
          saveContaAzulTokens(companyId, {
            accessToken: activeToken,
            refreshToken: activeRefresh,
            clientId: cfg.client_id,
            clientSecret: cfg.client_secret
          });
        }

        // Update company config last_sync_at & next_sync_at
        const now = new Date();
        const nextSync = new Date(now.getTime() + 10 * 60 * 1000); // Next automatic sync in 10 minutes

        const cfgIdx = dbData.contaazul_config.findIndex((c: any) => c.company_id === companyId);
        if (cfgIdx !== -1) {
          dbData.contaazul_config[cfgIdx].last_sync_at = now.toISOString();
          dbData.contaazul_config[cfgIdx].next_sync_at = nextSync.toISOString();
          dbData.contaazul_config[cfgIdx].access_token = activeToken;
          dbData.contaazul_config[cfgIdx].refresh_token = activeRefresh;
        }

        // Log Sync Execution
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

        dbData.contaazul_sync_logs.unshift(syncLog);
        if (dbData.contaazul_sync_logs.length > 200) {
          dbData.contaazul_sync_logs = dbData.contaazul_sync_logs.slice(0, 200);
        }

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
        dbData.contaazul_sync_logs.unshift(errLog);
        syncResults.push(errLog);
      }
    }

    saveLocalDb(dbData);

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
