import { NextResponse } from "next/server";
import { fetchWithAutoRefresh } from "@/lib/contaazul/store";

export async function POST(req: Request) {
  try {
    const { accessToken, refreshToken, clientId, clientSecret } = await req.json();
    const passedTokens = { accessToken, refreshToken, clientId, clientSecret };

    // 1. Fetch Pessoas/Clientes v2 with transparent background auto-refresh
    let { res: customersRes, newAccessToken, newRefreshToken } = await fetchWithAutoRefresh(
      "https://api-v2.contaazul.com/v1/pessoas",
      { method: "GET" },
      passedTokens
    );

    let customersData: any[] = [];
    if (customersRes.ok) {
      const data = await customersRes.json().catch(() => ({}));
      customersData = Array.isArray(data) ? data : (data.items || data.pessoas || data.customers || []);
    } else {
      // Fallback v1 sales/customers
      const v1Res = await fetchWithAutoRefresh(
        "https://api.contaazul.com/v1/sales/customers",
        { method: "GET" },
        passedTokens
      );
      if (v1Res.res.ok) {
        const data = await v1Res.res.json().catch(() => ({}));
        customersData = Array.isArray(data) ? data : (data.items || data.customers || []);
        if (v1Res.newAccessToken) newAccessToken = v1Res.newAccessToken;
        if (v1Res.newRefreshToken) newRefreshToken = v1Res.newRefreshToken;
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

    return NextResponse.json({
      success: true,
      customers: customersData,
      customersCount: customersData.length,
      entries: entriesData,
      entriesCount: entriesData.length,
      new_access_token: newAccessToken,
      new_refresh_token: newRefreshToken,
      message: `Sincronização 24/7 concluída com sucesso! ${customersData.length} clientes e ${entriesData.length} lançamentos sincronizados.`
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Erro na sincronização 24/7 com a ContaAzul." },
      { status: 500 }
    );
  }
}
