import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const TOKENS_FILE = path.join(DATA_DIR, "omnizeus_contaazul_tokens.json");
const DB_FILE = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

export interface ContaAzulTokenData {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  accessToken: string;
  refreshToken: string;
  updatedAt: string;
}

// Structure in omnizeus_contaazul_tokens.json:
// { "comp_zenitus": { ...ContaAzulTokenData }, "comp_other": { ... } }

const DEFAULT_TOKENS: ContaAzulTokenData = {
  clientId: "",
  clientSecret: "",
  accessToken: "",
  refreshToken: "",
  updatedAt: new Date().toISOString()
};

// ─── Read tokens for a specific company ──────────────────────────────────────

export function getContaAzulTokens(companyId: string = 'comp_zenitus'): ContaAzulTokenData {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // New per-company format
    if (fs.existsSync(TOKENS_FILE)) {
      const raw = fs.readFileSync(TOKENS_FILE, "utf-8");
      const parsed = JSON.parse(raw);

      // If it's the old flat format (has clientId at root), migrate on the fly
      if (parsed && typeof parsed.clientId === 'string') {
        const migrated: Record<string, ContaAzulTokenData> = { 'comp_zenitus': { ...DEFAULT_TOKENS, ...parsed } };
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(migrated, null, 2), "utf-8");
        return companyId === 'comp_zenitus' ? migrated['comp_zenitus'] : { ...DEFAULT_TOKENS };
      }

      // New format: object keyed by companyId
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_TOKENS, ...(parsed[companyId] || {}) };
      }
    }

    // Fallback: read from main DB contaazul_config (only for backward compat)
    if (fs.existsSync(DB_FILE)) {
      const dbRaw = fs.readFileSync(DB_FILE, "utf-8");
      const dbJson = JSON.parse(dbRaw);
      const cfg = Array.isArray(dbJson.contaazul_config)
        ? dbJson.contaazul_config.find((c: any) => c.company_id === companyId)
        : (companyId === 'comp_zenitus' ? dbJson.contaazul_config : null);
      if (cfg) {
        return {
          ...DEFAULT_TOKENS,
          clientId: cfg.client_id || '',
          clientSecret: cfg.client_secret || '',
          accessToken: cfg.access_token || '',
          refreshToken: cfg.refresh_token || '',
          updatedAt: cfg.updated_at || new Date().toISOString()
        };
      }
    }

    return { ...DEFAULT_TOKENS };
  } catch (e) {
    return { ...DEFAULT_TOKENS };
  }
}

// ─── Save tokens for a specific company ──────────────────────────────────────

export function saveContaAzulTokens(
  tokensOrCompanyId: Partial<ContaAzulTokenData> | string,
  tokensArg?: Partial<ContaAzulTokenData>
): ContaAzulTokenData {
  // Overloaded: saveContaAzulTokens(companyId, tokens) OR saveContaAzulTokens(tokens) [legacy]
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
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // Read current per-company map
    let tokenMap: Record<string, ContaAzulTokenData> = {};
    if (fs.existsSync(TOKENS_FILE)) {
      const raw = fs.readFileSync(TOKENS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      // Handle old flat format
      if (parsed && typeof parsed.clientId === 'string') {
        tokenMap = { 'comp_zenitus': { ...DEFAULT_TOKENS, ...parsed } };
      } else {
        tokenMap = parsed || {};
      }
    }

    const current = tokenMap[companyId] || { ...DEFAULT_TOKENS };
    const updated: ContaAzulTokenData = {
      ...current,
      ...tokens,
      updatedAt: new Date().toISOString()
    };

    tokenMap[companyId] = updated;
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokenMap, null, 2), "utf-8");

    // Sync to main DB contaazul_config array
    if (fs.existsSync(DB_FILE)) {
      try {
        const dbRaw = fs.readFileSync(DB_FILE, "utf-8");
        const dbJson = JSON.parse(dbRaw);

        // Migrate contaazul_config to array format if needed
        if (!Array.isArray(dbJson.contaazul_config)) {
          dbJson.contaazul_config = dbJson.contaazul_config
            ? [{ company_id: 'comp_zenitus', ...dbJson.contaazul_config }]
            : [];
        }

        const cfgIndex = dbJson.contaazul_config.findIndex((c: any) => c.company_id === companyId);
        const cfgEntry = {
          company_id: companyId,
          client_id: updated.clientId,
          client_secret: updated.clientSecret,
          access_token: updated.accessToken,
          refresh_token: updated.refreshToken,
          is_connected: !!(updated.accessToken && updated.refreshToken),
          updated_at: updated.updatedAt
        };

        if (cfgIndex >= 0) {
          dbJson.contaazul_config[cfgIndex] = cfgEntry;
        } else {
          dbJson.contaazul_config.push(cfgEntry);
        }

        fs.writeFileSync(DB_FILE, JSON.stringify(dbJson, null, 2), "utf-8");
      } catch (e) {}
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
  companyId: string = 'comp_zenitus'
): Promise<{ res: Response; newAccessToken?: string; newRefreshToken?: string }> {
  let stored = getContaAzulTokens(companyId);

  // Se o disco não possuir accessToken mas o frontend enviou, atualiza
  if (!stored.accessToken && passedTokens?.accessToken) {
    stored = saveContaAzulTokens(companyId, {
      accessToken: passedTokens.accessToken,
      refreshToken: passedTokens.refreshToken || stored.refreshToken,
      clientId: passedTokens.clientId || stored.clientId,
      clientSecret: passedTokens.clientSecret || stored.clientSecret
    });
  }

  // Prioriza SEMPRE os tokens mais recentes gerenciados no disco
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

  // Primeira tentativa com o token ativo
  let res = await fetch(url, {
    ...options,
    headers: buildHeaders(activeAccessToken || "")
  });

  // Se receber HTTP 401, executa renovação silenciosa em segundo plano via refresh_token
  if (res.status === 401 && activeRefreshToken) {
    console.log("[ContaAzul Auto-Refresh] Token 401 detectado. Executando renovação silenciosa em segundo plano...");
    
    const credentials = Buffer.from(`${activeClientId.trim()}:${activeClientSecret.trim()}`).toString("base64");
    
    // Attempt 1: auth.contaazul.com
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

    // Attempt 2: api.contaazul.com fallback
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

      // Grava permanentemente as novas chaves renovadas
      saveContaAzulTokens(companyId, {
        accessToken: activeAccessToken,
        refreshToken: activeRefreshToken,
        clientId: activeClientId,
        clientSecret: activeClientSecret
      });

      console.log("[ContaAzul Auto-Refresh] Token renovado com sucesso! Repetindo requisição original com o novo token...");

      // REPETE A REQUISIÇÃO COM O NOVO TOKEN RENOVAOD!
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
