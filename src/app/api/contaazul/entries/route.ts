import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { accessToken, refreshToken, clientId, clientSecret, description, value, dueDate, type, customerId } = await req.json();

    if (!accessToken && !refreshToken) {
      return NextResponse.json(
        { success: false, error: "Sessão OAuth ausente." },
        { status: 401 }
      );
    }

    if (!description || !value || !dueDate) {
      return NextResponse.json(
        { success: false, error: "Descrição, valor e data de vencimento são obrigatórios." },
        { status: 400 }
      );
    }

    let activeToken = accessToken ? accessToken.trim() : "";
    const payload = {
      description: description.trim(),
      value: Number(value),
      due_date: dueDate,
      type: type || "RECEBIMENTO",
      customer_id: customerId || undefined
    };

    const makeRequest = async (token: string) => {
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      let res = await fetch("https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        res = await fetch("https://api.contaazul.com/v1/financial-events", {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
      }
      return res;
    };

    let res = await makeRequest(activeToken);

    let newAccessToken = activeToken;
    let newRefreshToken = refreshToken;

    if (res.status === 401 && refreshToken) {
      const refreshRes = await fetch(`${req.headers.get("origin") || "http://localhost:3000"}/api/contaazul/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken, clientId, clientSecret })
      });

      const refreshData = await refreshRes.json().catch(() => ({}));
      if (refreshRes.ok && refreshData.access_token) {
        newAccessToken = refreshData.access_token;
        newRefreshToken = refreshData.refresh_token || refreshToken;
        res = await makeRequest(newAccessToken);
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.message || data.error || `Erro da API ContaAzul (HTTP ${res.status}).` },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      entry: data,
      new_access_token: newAccessToken !== activeToken ? newAccessToken : undefined,
      new_refresh_token: newRefreshToken !== refreshToken ? newRefreshToken : undefined,
      message: `Lançamento '${description}' registrado com sucesso!`
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Falha ao registrar lançamento na ContaAzul." },
      { status: 500 }
    );
  }
}
