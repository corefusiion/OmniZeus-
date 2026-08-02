export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { fetchWithAutoRefresh } from "@/lib/contaazul/store";
import { supabase } from "@/lib/db/supabaseClient";

export async function POST(req: Request) {
  try {
    const { accessToken, refreshToken, clientId, clientSecret } = await req.json();
    const passedTokens = { accessToken, refreshToken, clientId, clientSecret };

    // 1. Fetch Pessoas v2 com renovação silenciosa em segundo plano
    let { res: customersRes, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh(
      "https://api-v2.contaazul.com/v1/pessoas",
      { method: "GET" },
      passedTokens
    );

    let rawPessoas: any[] = [];
    if (customersRes.ok) {
      const data = await customersRes.json().catch(() => ({}));
      rawPessoas = Array.isArray(data) ? data : (data.items || data.pessoas || data.customers || []);
    } else {
      // Fallback v1 sales/customers
      const v1Res = await fetchWithAutoRefresh(
        "https://api.contaazul.com/v1/sales/customers",
        { method: "GET" },
        passedTokens
      );
      if (v1Res.res.ok) {
        const data = await v1Res.res.json().catch(() => ({}));
        rawPessoas = Array.isArray(data) ? data : (data.items || data.customers || []);
        if (v1Res.newAccessToken) newAccessToken = v1Res.newAccessToken;
        if (v1Res.newRefreshToken) newRefreshToken = v1Res.newRefreshToken;
      }
    }

    // Segregar Pessoas entre Clientes e Fornecedores
    let customersData: any[] = [];
    let suppliersData: any[] = [];

    for (const item of rawPessoas) {
      const perfisList = item.perfis || item.profiles || [];
      const rolesList = item.roles || [];
      
      const isSupp = perfisList.some((p: any) => 
        p === "Fornecedor" || p === "FORNECEDOR" || 
        p?.tipo_perfil === "Fornecedor" || p?.tipo_perfil === "FORNECEDOR"
      ) || rolesList.includes("SUPPLIER") || rolesList.includes("FORNECEDOR") || item.is_supplier === true;
                     
      const isCli = perfisList.some((p: any) => 
        p === "Cliente" || p === "CLIENTE" || 
        p?.tipo_perfil === "Cliente" || p?.tipo_perfil === "CLIENTE"
      ) || rolesList.includes("CUSTOMER") || rolesList.includes("CLIENTE") || item.is_client === true;

      if (isSupp) {
        suppliersData.push(item);
      }
      if (isCli || (!isSupp && !isCli)) {
        customersData.push(item);
      }
    }

    // 2. Fetch Eventos Financeiros (Lancamentos)
    let entriesData: any[] = [];
    if (newAccessToken) {
      const entriesRes = await fetchWithAutoRefresh(
        "https://api.contaazul.com/v1/financeiro/eventos-financeiros",
        { method: "GET" },
        { accessToken: newAccessToken, refreshToken: newRefreshToken, clientId, clientSecret }
      );
      if (entriesRes.res.ok) {
        const eData = await entriesRes.res.json().catch(() => ({}));
        entriesData = Array.isArray(eData) ? eData : (eData.items || eData.eventos || []);
      }
    }

    // 3. Complemento via v1/fornecedores
    if (newAccessToken) {
      const suppRes = await fetchWithAutoRefresh(
        "https://api.contaazul.com/v1/fornecedores",
        { method: "GET" },
        { accessToken: newAccessToken, refreshToken: newRefreshToken, clientId, clientSecret }
      );
      if (suppRes.res.ok) {
        const sData = await suppRes.res.json().catch(() => ({}));
        const v1Suppliers = Array.isArray(sData) ? sData : (sData.items || sData.fornecedores || []);
        for (const s of v1Suppliers) {
          if (!suppliersData.some(existing => existing.id === s.id)) {
            suppliersData.push(s);
          }
        }
      }
    }

    // 4. Fetch Categorias (Plano de Contas)
    let categoriesData: any[] = [];
    if (newAccessToken) {
      const catsRes = await fetchWithAutoRefresh(
        "https://api.contaazul.com/v1/financeiro/categorias",
        { method: "GET" },
        { accessToken: newAccessToken, refreshToken: newRefreshToken, clientId, clientSecret }
      );
      if (catsRes.res.ok) {
        const cData = await catsRes.res.json().catch(() => ({}));
        categoriesData = Array.isArray(cData) ? cData : (cData.items || cData.categorias || []);
      }
    }

    // SALVAMENTO PERSISTENTE NO BACK-END (Supabase)
    if (customersData.length > 0) {
      await supabase.from('contaazul_clients').upsert(customersData, { onConflict: 'id' });
    }
    if (suppliersData.length > 0) {
      await supabase.from('contaazul_suppliers').upsert(suppliersData, { onConflict: 'id' });
    }
    if (entriesData && entriesData.length > 0) {
      await supabase.from('contaazul_entries').upsert(entriesData, { onConflict: 'id' });
    }
    if (categoriesData && categoriesData.length > 0) {
      await supabase.from('contaazul_categories').upsert(categoriesData, { onConflict: 'id' });
    }

    return NextResponse.json({
      success: true,
      customers: customersData,
      customersCount: customersData.length,
      entries: entriesData,
      entriesCount: entriesData.length,
      suppliers: suppliersData,
      suppliersCount: suppliersData.length,
      categories: categoriesData,
      categoriesCount: categoriesData.length,
      new_access_token: newAccessToken,
      new_refresh_token: newRefreshToken,
      message: `Sincronização 24/7 concluída com sucesso! ${customersData.length} clientes, ${suppliersData.length} fornecedores, ${categoriesData.length} categorias e ${entriesData.length} lançamentos sincronizados.`
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Erro na sincronização 24/7 com a ContaAzul." },
      { status: 500 }
    );
  }
}

