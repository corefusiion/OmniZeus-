import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const TOKENS_FILE = path.join(DATA_DIR, "omnizeus_contaazul_tokens.json");

export interface ContaAzulTokenData {
  clientId: string;
  clientSecret: string;
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
    if (!fs.existsSync(TOKENS_FILE)) {
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(DEFAULT_TOKENS, null, 2), "utf-8");
      return DEFAULT_TOKENS;
    }
    const raw = fs.readFileSync(TOKENS_FILE, "utf-8");
    return JSON.parse(raw);
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
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(updated, null, 2), "utf-8");
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

  // Update stored tokens if fresh tokens were passed from request body
  if (passedTokens?.accessToken && passedTokens.accessToken !== stored.accessToken) {
    stored = saveContaAzulTokens({
      accessToken: passedTokens.accessToken,
      refreshToken: passedTokens.refreshToken || stored.refreshToken,
      clientId: passedTokens.clientId || stored.clientId,
      clientSecret: passedTokens.clientSecret || stored.clientSecret
    });
  }

  let activeAccessToken = stored.accessToken || passedTokens?.accessToken;
  let activeRefreshToken = stored.refreshToken || passedTokens?.refreshToken;
  let activeClientId = stored.clientId || passedTokens?.clientId || "1mbtg7ok5lp46p0j9oir48fda0";
  let activeClientSecret = stored.clientSecret || passedTokens?.clientSecret || "m3mgshckslvubnraqf0d50hcggm4tn6mnlpa7ancvo3m8t5f93l";

  const buildHeaders = (token: string) => {
    const origHeaders = (options.headers as Record<string, string>) || {};
    return {
      ...origHeaders,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  };

  // First Attempt
  let res = await fetch(url, {
    ...options,
    headers: buildHeaders(activeAccessToken || "")
  });

  // If HTTP 401, perform transparent silent auto-refresh in background and RETRY!
  if (res.status === 401 && activeRefreshToken) {
    console.log("[ContaAzul Auto-Refresh] Token 401 detectado. Executando renovação silenciosa em segundo plano...");
    
    const credentials = Buffer.from(`${activeClientId.trim()}:${activeClientSecret.trim()}`).toString("base64");
    const refreshRes = await fetch("https://auth.contaazul.com/oauth2/token", {
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

    const refreshData = await refreshRes.json().catch(() => ({}));

    if (refreshRes.ok && refreshData.access_token) {
      activeAccessToken = refreshData.access_token;
      if (refreshData.refresh_token) activeRefreshToken = refreshData.refresh_token;

      // Save new tokens to central store
      saveContaAzulTokens({
        accessToken: activeAccessToken,
        refreshToken: activeRefreshToken,
        clientId: activeClientId,
        clientSecret: activeClientSecret
      });

      console.log("[ContaAzul Auto-Refresh] Token renovado com sucesso! Repetindo requisição original...");

      // RETRY ORIGINAL REQUEST TRANSPARENTLY!
      res = await fetch(url, {
        ...options,
        headers: buildHeaders(activeAccessToken || "")
      });
    }
  }

  return {
    res,
    newAccessToken: activeAccessToken,
    newRefreshToken: activeRefreshToken
  };
}
