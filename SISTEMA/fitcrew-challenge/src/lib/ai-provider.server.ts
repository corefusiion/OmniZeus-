/**
 * AI provider abstraction.
 *
 * Reads the singleton config from `public.ai_settings` (fed by the Super Admin UI)
 * and dispatches chat completion calls to the configured provider using ONLY the
 * standard Web `fetch` API — Cloudflare-Worker safe.
 *
 * Fallback: if the DB row has no api_key, we look at env vars
 * (CUSTOM_AI_API_KEY / <PROVIDER>_API_KEY) so you can still ship via Cloudflare
 * secrets if you prefer.
 *
 * Server-only. Never import from client code.
 */

import { createClient } from "@supabase/supabase-js";

export type AiProvider = "openai" | "gemini" | "openrouter" | "anthropic" | "grok";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatCompletionResult = {
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  usage?: { total_tokens?: number };
  finish_reason?: string;
};

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  imageModel: string | null;
  tavilyApiKey: string | null;
};


const PROVIDER_ENDPOINTS: Record<AiProvider, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  grok: "https://api.x.ai/v1/chat/completions",
  gemini:
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
};

function envKeyFor(provider: AiProvider): string | undefined {
  const map: Record<AiProvider, string> = {
    openai: "OPENAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    grok: "GROK_API_KEY",
    gemini: "GEMINI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
  };
  return (
    process.env[map[provider]] ||
    process.env.CUSTOM_AI_API_KEY ||
    undefined
  );
}

/**
 * Loads the configured AI provider/key/model.
 *
 * Reads via the `public.get_active_ai_config()` SECURITY DEFINER RPC, using the
 * publishable key — no service_role required (Lovable Cloud não expõe service_role).
 * Fallback para variáveis de ambiente do Cloudflare se o banco não tiver key.
 */
export async function getAiConfig(): Promise<AiConfig> {
  const url = process.env.SUPABASE_URL;
  const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !pubKey) {
    throw new Error(
      "Supabase server env missing (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).",
    );
  }
  const client = createClient(url, pubKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.rpc("get_active_ai_config");
  if (error) throw new Error(`Falha ao ler ai_settings: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  const provider = ((row?.provider as AiProvider) ?? "openai") as AiProvider;
  const model = (row?.model_name as string) ?? "gpt-4o-mini";
  const imageModel = (row?.image_model_name as string | null) ?? null;
  const dbKey = (row?.api_key as string | null) ?? null;
  const apiKey = dbKey || envKeyFor(provider) || "";
  const tavilyApiKey =
    ((row?.tavily_api_key as string | null) ?? null) ||
    process.env.TAVILY_API_KEY ||
    null;

  if (!apiKey) {
    throw new Error(
      `Nenhuma API Key configurada para o provedor "${provider}". Configure em Admin → IA.`,
    );
  }
  return { provider, apiKey, model, imageModel, tavilyApiKey };
}



/** OpenAI-compatible providers accept the exact same body/headers pattern. */
async function callOpenAiCompatible(
  cfg: AiConfig,
  body: Record<string, unknown>,
): Promise<ChatCompletionResult> {
  const endpoint = PROVIDER_ENDPOINTS[cfg.provider];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://fitcrew.app";
    headers["X-Title"] = "FitCrew";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, model: cfg.model }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("API Key inválida para o provedor de IA.");
    if (res.status === 429) throw new Error("Limite temporário da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no provedor configurado.");
    throw new Error(`Falha na IA (${cfg.provider} ${res.status}): ${txt.slice(0, 200)}`);
  }
  const j = (await res.json()) as any;
  const choice = j?.choices?.[0];
  return {
    content: choice?.message?.content ?? null,
    tool_calls: choice?.message?.tool_calls,
    finish_reason: choice?.finish_reason,
    usage: { total_tokens: j?.usage?.total_tokens },
  };
}

/** Anthropic Messages API — light adapter (text-only, sem tools por enquanto). */
async function callAnthropic(
  cfg: AiConfig,
  messages: ChatMessage[],
): Promise<ChatCompletionResult> {
  // Separa system prompts do resto
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system" && typeof m.content === "string") {
      systemParts.push(m.content);
    } else if (m.role === "user" || m.role === "assistant") {
      rest.push(m);
    }
  }
  const body = {
    model: cfg.model,
    max_tokens: 1024,
    system: systemParts.join("\n\n"),
    messages: rest.map((m) => {
      if (typeof m.content === "string") {
        return { role: m.role, content: m.content };
      }
      return {
        role: m.role,
        content: m.content.map((c) =>
          c.type === "text"
            ? { type: "text", text: c.text }
            : { type: "image", source: { type: "url", url: c.image_url.url } },
        ),
      };
    }),
  };
  const res = await fetch(PROVIDER_ENDPOINTS.anthropic, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha na IA (anthropic ${res.status}): ${txt.slice(0, 200)}`);
  }
  const j = (await res.json()) as any;
  const text =
    (j?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n") || null;
  return {
    content: text,
    usage: {
      total_tokens: (j?.usage?.input_tokens ?? 0) + (j?.usage?.output_tokens ?? 0),
    },
  };
}

/**
 * Dispatcher: aceita mensagens no formato OpenAI e roteia pro provedor certo.
 * `tools` funciona em openai / openrouter / grok / gemini. Em anthropic tools
 * são ignoradas por enquanto (só resposta em texto).
 */
export async function chatCompletion(opts: {
  messages: ChatMessage[];
  tools?: ToolDef[];
  toolChoice?: "auto" | "none";
  temperature?: number;
  responseFormat?: { type: "json_object" };
}): Promise<ChatCompletionResult & { provider: AiProvider; model: string }> {
  const cfg = await getAiConfig();

  if (cfg.provider === "anthropic") {
    const out = await callAnthropic(cfg, opts.messages);
    return { ...out, provider: cfg.provider, model: cfg.model };
  }

  const body: Record<string, unknown> = { messages: opts.messages };
  if (opts.tools && opts.tools.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? "auto";
  }
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (opts.responseFormat) body.response_format = opts.responseFormat;

  const out = await callOpenAiCompatible(cfg, body);
  return { ...out, provider: cfg.provider, model: cfg.model };
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

const IMAGE_MODEL_BY_PROVIDER: Record<AiProvider, string | null> = {
  openai: "gpt-image-1",
  openrouter: "google/gemini-2.5-flash-image",
  gemini: "gemini-2.5-flash-image-preview",
  grok: null,
  anthropic: null,
};

/**
 * Gera uma imagem a partir de um prompt de texto, usando o provider/key
 * configurado em ai_settings. Retorna base64 (sem prefixo data:).
 */
export async function generateImage(prompt: string): Promise<string> {
  const cfg = await getAiConfig();
  const imageModel = cfg.imageModel?.trim() || IMAGE_MODEL_BY_PROVIDER[cfg.provider];
  if (!imageModel) {
    throw new Error(
      `O provedor "${cfg.provider}" não suporta geração de imagens. Configure um "Modelo de imagem" em Admin → IA (ex.: google/gemini-2.5-flash-image no OpenRouter).`,
    );
  }


  // OpenAI: endpoint dedicado /v1/images/generations
  if (cfg.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: imageModel,
        prompt,
        size: "1536x1024",
        n: 1,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Muitas gerações — aguarde alguns segundos.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na geração (openai ${res.status}): ${txt.slice(0, 200)}`);
    }
    const j = (await res.json()) as any;
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) throw new Error("A IA não retornou imagem.");
    return b64;
  }

  // OpenRouter / Gemini: chat completions com modalities=["image","text"]
  const endpoint =
    cfg.provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://fitcrew.app";
    headers["X-Title"] = "FitCrew";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: imageModel,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Muitas gerações — aguarde alguns segundos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    throw new Error(`Falha na geração (${cfg.provider} ${res.status}): ${txt.slice(0, 200)}`);
  }
  const j = (await res.json()) as any;
  // OpenRouter retorna imagens em choices[0].message.images[0].image_url.url (data URL)
  const images = j?.choices?.[0]?.message?.images;
  if (Array.isArray(images) && images.length) {
    const url: string | undefined = images[0]?.image_url?.url ?? images[0]?.url;
    if (url && url.startsWith("data:")) {
      const comma = url.indexOf(",");
      if (comma > -1) return url.slice(comma + 1);
    }
  }
  // fallback: alguns provedores devolvem em data[0].b64_json
  const b64 = j?.data?.[0]?.b64_json;
  if (b64) return b64;
  throw new Error("A IA não retornou imagem.");
}

/**
 * Helper de conveniência: chamada de texto simples. Retorna a string ou null se falhar.
 */
export async function textChat(
  messages: ChatMessage[],
  opts?: { temperature?: number; responseFormat?: { type: "json_object" } },
): Promise<string | null> {
  try {
    const out = await chatCompletion({ messages, ...opts });
    return out.content?.trim() ?? null;
  } catch {
    return null;
  }
}

