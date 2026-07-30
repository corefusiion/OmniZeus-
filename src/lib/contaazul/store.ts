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

const DEFAULT_TOKENS: ContaAzulTokenData = {
  clientId: "1mbtg7ok5lp46p0j9oir48fda0",
  clientSecret: "m3mgshckslvubnraqf0d50hcggm4tn6mnlpa7ancvo3m8t5f93l",
  accessToken: "",
  refreshToken: "",
  updatedAt: new Date().toISOString()
};

export function getContaAzulTokens(): ContaAzulTokenData {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    
    let tokens: ContaAzulTokenData = { ...DEFAULT_TOKENS };
    if (fs.existsSync(TOKENS_FILE)) {
      const raw = fs.readFileSync(TOKENS_FILE, "utf-8");
      tokens = { ...DEFAULT_TOKENS, ...JSON.parse(raw) };
    }

    // Fallback de segurança: se os tokens em TOKENS_FILE estiverem vazios, lê do banco local SQL
    if ((!tokens.accessToken || !tokens.refreshToken) && fs.existsSync(DB_FILE)) {
      try {
        const dbRaw = fs.readFileSync(DB_FILE, "utf-8");
        const dbJson = JSON.parse(dbRaw);
        const cfg = dbJson.contaazul_config;
        if (cfg) {
          if (cfg.access_token) tokens.accessToken = cfg.access_token;
          if (cfg.refresh_token) tokens.refreshToken = cfg.refresh_token;
          if (cfg.client_id) tokens.clientId = cfg.client_id;
          if (cfg.client_secret) tokens.clientSecret = cfg.client_secret;
        }
      } catch (e) {}
    }

    return tokens;
  } catch (e) {
    return DEFAULT_TOKENS;
  }
}

export function saveContaAzulTokens(tokens: Partial<ContaAzulTokenData>): ContaAzulTokenData {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const current = getContaAzulTokens();
    const updated = {
      ...current,
      ...tokens,
      updatedAt: new Date().toISOString()
    };
    
    // 1. Salva em omnizeus_contaazul_tokens.json
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(updated, null, 2), "utf-8");

    // 2. Sincroniza em segundo plano com omnizeus_local_sql_database.json (contaazul_config)
    if (fs.existsSync(DB_FILE)) {
      try {
        const dbRaw = fs.readFileSync(DB_FILE, "utf-8");
        const dbJson = JSON.parse(dbRaw);
        dbJson.contaazul_config = {
          client_id: updated.clientId,
          client_secret: updated.clientSecret,
          access_token: updated.accessToken,
          refresh_token: updated.refreshToken,
          is_connected: !!(updated.accessToken && updated.refreshToken),
          updated_at: updated.updatedAt
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(dbJson, null, 2), "utf-8");
      } catch (e) {}
    }

    return updated;
  } catch (e) {
    return DEFAULT_TOKENS;
  }
}

/**
 * Executes a fetch request to ContaAzul API v2 with automatic silent background token renewal.
 * If HTTP 401 is received, it transparently refreshes the OAuth token and retries the request.
 */
export async function fetchWithAutoRefresh(
  url: string,
  options: RequestInit = {},
  passedTokens?: { accessToken?: string; refreshToken?: string; clientId?: string; clientSecret?: string }
): Promise<{ res: Response; newAccessToken?: string; newRefreshToken?: string }> {
  let stored = getContaAzulTokens();

  // Se o disco não possuir accessToken mas o frontend enviou, atualiza
  if (!stored.accessToken && passedTokens?.accessToken) {
    stored = saveContaAzulTokens({
      accessToken: passedTokens.accessToken,
      refreshToken: passedTokens.refreshToken || stored.refreshToken,
      clientId: passedTokens.clientId || stored.clientId,
      clientSecret: passedTokens.clientSecret || stored.clientSecret
    });
  }

  // Prioriza SEMPRE os tokens mais recentes gerenciados no disco
  let activeAccessToken = stored.accessToken || passedTokens?.accessToken;
  let activeRefreshToken = stored.refreshToken || passedTokens?.refreshToken;
  let activeClientId = stored.clientId || passedTokens?.clientId || "1mbtg7ok5lp46p0j9oir48fda0";
  let activeClientSecret = stored.clientSecret || passedTokens?.clientSecret || "m3mgshckslvubnraqf0d50hcggm4tn6mnlpa7ancvo3m8t5f93l";

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
      saveContaAzulTokens({
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
