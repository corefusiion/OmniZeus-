import { supabase } from "@/lib/db/supabaseClient";
import { decryptContaAzulFields, encryptContaAzulFields, decryptSecret } from "@/lib/crypto/atRest";

export interface ContaAzulTokenData {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  accessToken: string;
  refreshToken: string;
  updatedAt: string;
}

const DEFAULT_TOKENS: ContaAzulTokenData = {
  clientId: "",
  clientSecret: "",
  accessToken: "",
  refreshToken: "",
  updatedAt: new Date().toISOString()
};

// ─── Read tokens for a specific company ──────────────────────────────────────

export async function getContaAzulTokens(companyId: string = 'comp_zenitus'): Promise<ContaAzulTokenData> {
  try {
    const { data: cfg } = await supabase
      .from('contaazul_config')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (cfg) {
      return await decryptContaAzulFields({
        ...DEFAULT_TOKENS,
        clientId: cfg.client_id || '',
        clientSecret: cfg.client_secret || '',
        accessToken: cfg.access_token || '',
        refreshToken: cfg.refresh_token || '',
        updatedAt: cfg.updated_at || new Date().toISOString()
      });
    }

    return { ...DEFAULT_TOKENS };
  } catch (e) {
    return { ...DEFAULT_TOKENS };
  }
}

// ─── Save tokens for a specific company ──────────────────────────────────────

export async function saveContaAzulTokens(
  tokensOrCompanyId: Partial<ContaAzulTokenData> | string,
  tokensArg?: Partial<ContaAzulTokenData>
): Promise<ContaAzulTokenData> {
  let companyId: string;
  let tokens: Partial<ContaAzulTokenData>;

  if (typeof tokensOrCompanyId === 'string') {
    companyId = tokensOrCompanyId;
    tokens = tokensArg || {};
  } else {
    companyId = 'comp_zenitus';
    tokens = tokensOrCompanyId;
  }

  try {
    const current = await getContaAzulTokens(companyId);
    const updated: ContaAzulTokenData = {
      ...current,
      ...tokens,
      updatedAt: new Date().toISOString()
    };

    const encrypted = await encryptContaAzulFields(updated);

    const cfgEntry = {
      company_id: companyId,
      client_id: encrypted.clientId,
      client_secret: encrypted.clientSecret,
      access_token: encrypted.accessToken,
      refresh_token: encrypted.refreshToken,
      is_connected: !!(updated.accessToken && updated.refreshToken),
      updated_at: updated.updatedAt
    };

    // Upsert into Supabase
    await supabase
      .from('contaazul_config')
      .upsert(cfgEntry, { onConflict: 'company_id' });

    return updated;
  } catch (e) {
    return { ...DEFAULT_TOKENS };
  }
}


/**
 * Executes a fetch request to ContaAzul API v2 with automatic silent background token renewal.
 * If HTTP 401 is received, it transparently refreshes the OAuth token and retries the request.
 * companyId scopes the token lookup to the correct tenant.
 */
export async function fetchWithAutoRefresh(
  url: string,
  options: RequestInit = {},
  passedTokens?: { accessToken?: string; refreshToken?: string; clientId?: string; clientSecret?: string },
  companyId: string = 'comp_zenitus'
): Promise<{ res: Response; newAccessToken?: string; newRefreshToken?: string }> {
  let stored = await getContaAzulTokens(companyId);

  // Se o banco não possuir accessToken mas o frontend enviou, atualiza
  if (!stored.accessToken && passedTokens?.accessToken) {
    stored = await saveContaAzulTokens(companyId, {
      accessToken: passedTokens.accessToken,
      refreshToken: passedTokens.refreshToken || stored.refreshToken,
      clientId: passedTokens.clientId || stored.clientId,
      clientSecret: passedTokens.clientSecret || stored.clientSecret
    });
  }

  let activeAccessToken = stored.accessToken || passedTokens?.accessToken;
  let activeRefreshToken = stored.refreshToken || passedTokens?.refreshToken;
  let activeClientId = stored.clientId || passedTokens?.clientId || "";
  let activeClientSecret = stored.clientSecret || passedTokens?.clientSecret || "";


  const buildHeaders = (token: string) => {
    const origHeaders = { ...((options.headers as Record<string, string>) || {}) };
    delete origHeaders["Authorization"];
    delete origHeaders["authorization"];
    return {
      ...origHeaders,
      "Authorization": `Bearer ${token.trim()}`,
      "Content-Type": "application/json"
    };
  };

  let res = await fetch(url, {
    ...options,
    headers: buildHeaders(activeAccessToken || "")
  });

  if (res.status === 401 && activeRefreshToken) {
    console.log("[ContaAzul Auto-Refresh] Token 401 detectado. Executando renovação silenciosa em segundo plano...");
    
    const credentials = Buffer.from(`${activeClientId.trim()}:${activeClientSecret.trim()}`).toString("base64");
    
    let refreshRes = await fetch("https://auth.contaazul.com/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: activeRefreshToken.trim()
      })
    });

    let refreshData = await refreshRes.json().catch(() => ({}));

    if (!refreshRes.ok || !refreshData.access_token) {
      refreshRes = await fetch("https://api.contaazul.com/oauth2/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: activeRefreshToken.trim(),
          client_id: activeClientId.trim(),
          client_secret: activeClientSecret.trim()
        })
      });
      refreshData = await refreshRes.json().catch(() => ({}));
    }

    if (refreshRes.ok && refreshData.access_token) {
      activeAccessToken = refreshData.access_token;
      if (refreshData.refresh_token) activeRefreshToken = refreshData.refresh_token;

      await saveContaAzulTokens(companyId, {
        accessToken: activeAccessToken,
        refreshToken: activeRefreshToken,
        clientId: activeClientId,
        clientSecret: activeClientSecret
      });

      console.log("[ContaAzul Auto-Refresh] Token renovado com sucesso! Repetindo requisição original com o novo token...");

      res = await fetch(url, {
        ...options,
        headers: buildHeaders(activeAccessToken || "")
      });
    } else {
      console.error("[ContaAzul Auto-Refresh Error]: Falha ao renovar via refresh_token.", refreshData);
    }
  }

  return {
    res,
    newAccessToken: activeAccessToken,
    newRefreshToken: activeRefreshToken
  };
}


