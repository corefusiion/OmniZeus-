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
    tokens = { ...(tokensArg || {}) };
  } else {
    companyId = 'comp_zenitus';
    tokens = { ...(tokensOrCompanyId || {}) };
  }

  // Proteção contra sobrescrita com string já criptografada
  if (tokens.accessToken && (tokens.accessToken.startsWith("enc.v1:") || tokens.accessToken.startsWith("cyjr"))) {
    delete tokens.accessToken;
  }
  if (tokens.refreshToken && (tokens.refreshToken.startsWith("enc.v1:") || tokens.refreshToken.startsWith("cyjr"))) {
    delete tokens.refreshToken;
  }

  try {
    const current = await getContaAzulTokens(companyId);
    const updated: ContaAzulTokenData = {
      ...current,
      ...tokens,
      updatedAt: new Date().toISOString()
    };

    const encrypted = await encryptContaAzulFields(updated);

    const { data: existingRow } = await supabase.from('contaazul_config').select('id').eq('company_id', companyId).maybeSingle();

    const cfgEntry = {
      id: existingRow?.id || crypto.randomUUID(),
      company_id: companyId,
      client_id: encrypted.clientId,
      client_secret: encrypted.clientSecret,
      access_token: encrypted.accessToken,
      refresh_token: encrypted.refreshToken,
      is_connected: !!(updated.accessToken && updated.refreshToken),
      updated_at: updated.updatedAt
    };

    // Since company_id doesn't have a unique constraint, upsert will fail.
    // We check if the row exists and then do an UPDATE or INSERT.
    if (existingRow) {
      await supabase
        .from('contaazul_config')
        .update(cfgEntry)
        .eq('company_id', companyId);
    } else {
      await supabase
        .from('contaazul_config')
        .insert(cfgEntry);
    }

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
  companyId: string = 'comp_techcontabil_01'
): Promise<{ res: Response; newAccessToken?: string; newRefreshToken?: string }> {
  let stored = await getContaAzulTokens(companyId);

  // Filtrar tokens criptografados enviados por engano
  let cleanPassedAccess = passedTokens?.accessToken;
  let cleanPassedRefresh = passedTokens?.refreshToken;
  if (cleanPassedAccess && (cleanPassedAccess.startsWith("enc.v1:") || cleanPassedAccess.startsWith("cyjr"))) {
    cleanPassedAccess = undefined;
  }
  if (cleanPassedRefresh && (cleanPassedRefresh.startsWith("enc.v1:") || cleanPassedRefresh.startsWith("cyjr"))) {
    cleanPassedRefresh = undefined;
  }

  // Se o frontend ou chamador enviou tokens válidos explicitamente, salva no BD
  if (cleanPassedAccess) {
    stored = await saveContaAzulTokens(companyId, {
      accessToken: cleanPassedAccess,
      refreshToken: cleanPassedRefresh || stored.refreshToken,
      clientId: passedTokens?.clientId || stored.clientId,
      clientSecret: passedTokens?.clientSecret || stored.clientSecret
    });
  }

  let activeAccessToken = cleanPassedAccess || stored.accessToken;
  let activeRefreshToken = cleanPassedRefresh || stored.refreshToken;
  let activeClientId = passedTokens?.clientId || stored.clientId || "";
  let activeClientSecret = passedTokens?.clientSecret || stored.clientSecret || "";


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
    
    const credentials = btoa(`${activeClientId.trim()}:${activeClientSecret.trim()}`);
    
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


