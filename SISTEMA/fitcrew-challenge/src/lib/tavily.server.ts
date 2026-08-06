/**
 * Tavily search helper. Server-only.
 * A chave vem do ai_settings.tavily_api_key (Admin → IA) com fallback para env TAVILY_API_KEY.
 */
import { getAiConfig } from "@/lib/ai-provider.server";

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
};

export type TavilyResponse = {
  answer: string | null;
  results: TavilySearchResult[];
};

export async function tavilySearch(
  query: string,
  opts?: { maxResults?: number; topic?: "general" | "news" },
): Promise<TavilyResponse> {
  const cfg = await getAiConfig();
  const key = cfg.tavilyApiKey;
  if (!key) {
    throw new Error(
      "Tavily API Key não configurada. Adicione em Admin → Configurações de IA.",
    );
  }
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      include_answer: "basic",
      max_results: opts?.maxResults ?? 5,
      topic: opts?.topic ?? "general",
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = (await res.json()) as any;
  return {
    answer: (j?.answer as string) ?? null,
    results: Array.isArray(j?.results)
      ? j.results.map((r: any) => ({
          title: String(r?.title ?? ""),
          url: String(r?.url ?? ""),
          content: String(r?.content ?? ""),
        }))
      : [],
  };
}
