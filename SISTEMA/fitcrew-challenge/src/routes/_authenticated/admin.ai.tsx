import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Zap, Save, KeyRound, Globe, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app-shell";
import {
  getAiSettings,
  saveAiSettings,
  testAiSettings,
} from "@/lib/ai-settings.functions";
import { getPlatformSettings, setAccessMode } from "@/lib/platform-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  beforeLoad: ({ context }) => {
    const ctx = context as { isSuperAdmin?: boolean };
    if (!ctx.isSuperAdmin) throw redirect({ to: "/admin" });
  },
  component: AdminAiPage,
});

const PROVIDER_OPTIONS: Array<{
  value: "openai" | "gemini" | "openrouter" | "anthropic" | "grok";
  label: string;
  hint: string;
  defaultModel: string;
  defaultImageModel: string;
}> = [
  { value: "openai", label: "OpenAI", hint: "api.openai.com", defaultModel: "gpt-4o-mini", defaultImageModel: "gpt-image-1" },
  { value: "gemini", label: "Google Gemini", hint: "generativelanguage.googleapis.com (OpenAI-compat)", defaultModel: "gemini-1.5-pro", defaultImageModel: "gemini-2.5-flash-image-preview" },
  { value: "openrouter", label: "OpenRouter", hint: "openrouter.ai", defaultModel: "openai/gpt-4o-mini", defaultImageModel: "google/gemini-2.5-flash-image" },
  { value: "anthropic", label: "Anthropic (Claude)", hint: "api.anthropic.com — sem tools ainda", defaultModel: "claude-3-5-sonnet-20241022", defaultImageModel: "" },
  { value: "grok", label: "xAI Grok", hint: "api.x.ai", defaultModel: "grok-2-latest", defaultImageModel: "" },
];


function AdminAiPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAiSettings);
  const saveFn = useServerFn(saveAiSettings);
  const testFn = useServerFn(testAiSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => getFn(),
  });

  const [provider, setProvider] = React.useState<typeof PROVIDER_OPTIONS[number]["value"]>("openai");
  const [model, setModel] = React.useState("gpt-4o-mini");
  const [imageModel, setImageModel] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [clearKey, setClearKey] = React.useState(false);
  const [tavilyKey, setTavilyKey] = React.useState("");
  const [clearTavily, setClearTavily] = React.useState(false);

  React.useEffect(() => {
    if (data) {
      setProvider(data.provider as typeof provider);
      setModel(data.model_name);
      setImageModel(data.image_model_name ?? "");
    }
  }, [data]);

  const providerChanged = !!data && data.provider !== provider;
  const effectiveHasKey = !!data?.has_key && !providerChanged && !clearKey;
  const needsNewKey = !effectiveHasKey && apiKey.trim().length === 0;

  const buildPayload = () => ({
    provider,
    model_name: model.trim(),
    image_model_name: imageModel.trim() ? imageModel.trim() : null,
    api_key: clearKey ? null : apiKey.trim() ? apiKey.trim() : undefined,
    tavily_api_key: clearTavily ? null : tavilyKey.trim() ? tavilyKey.trim() : undefined,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (needsNewKey) {
        throw new Error(
          providerChanged
            ? `Você trocou para "${provider}". Cole a API Key desse provedor antes de salvar.`
            : "Cole a API Key do provedor antes de salvar.",
        );
      }
      await saveFn({ data: buildPayload() });
    },
    onSuccess: () => {
      toast.success("Configurações salvas.");
      setApiKey("");
      setClearKey(false);
      setTavilyKey("");
      setClearTavily(false);
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async () => {
      if (needsNewKey) {
        throw new Error(
          providerChanged
            ? `Você trocou para "${provider}". Cole a API Key desse provedor antes de testar.`
            : "Cole a API Key do provedor antes de testar.",
        );
      }
      const dirty =
        !data ||
        data.provider !== provider ||
        data.model_name !== model.trim() ||
        (data.image_model_name ?? "") !== imageModel.trim() ||
        apiKey.trim().length > 0 ||
        clearKey;
      if (dirty) {
        await saveFn({ data: buildPayload() });
        setApiKey("");

        setClearKey(false);
        qc.invalidateQueries({ queryKey: ["ai-settings"] });
      }
      return testFn();
    },
    onSuccess: (r: any) => {
      if (r.ok) toast.success(`OK · ${r.provider}/${r.model} · "${r.reply}"`);
      else toast.error(r.error);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const opt = PROVIDER_OPTIONS.find((p) => p.value === provider)!;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader
        title="Configurações de IA"
        subtitle="Provedor dinâmico usado por ChatFit, geração de capas e posts diários. Rodando 100% em Cloudflare."
      />

      <AccessModeCard />


      {isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Provedor
            </label>
            <select
              value={provider}
              onChange={(e) => {
                const v = e.target.value as typeof provider;
                setProvider(v);
                const found = PROVIDER_OPTIONS.find((p) => p.value === v);
                if (found) {
                  setModel(found.defaultModel);
                  setImageModel(found.defaultImageModel);
                }
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Modelo de texto (chat)
            </label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={opt.defaultModel}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              Usado por ChatFit, comentários e posts. Ex.: {opt.defaultModel}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Modelo de imagem (opcional)
            </label>
            <input
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              placeholder={opt.defaultImageModel || "— provedor sem geração de imagem —"}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              Usado só para gerar capas/imagens. Deixe vazio para usar o padrão do provedor
              {opt.defaultImageModel ? ` (${opt.defaultImageModel})` : ""}. Modelos de imagem não respondem chat — por isso são separados.
            </p>
          </div>


          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <KeyRound className="size-3.5" /> API Key
            </label>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                effectiveHasKey
                  ? `Chave salva (${data!.key_preview}). Digite aqui só se for trocar.`
                  : providerChanged
                    ? `Cole a chave do ${provider} — o provedor mudou`
                    : "Cole a chave do provedor"
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {providerChanged && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Você trocou de provedor. A chave antiga não vale — cole a chave do "{provider}".
              </p>
            )}
            {data?.has_key && (
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(e) => setClearKey(e.target.checked)}
                />
                Limpar chave salva (voltar para env var CUSTOM_AI_API_KEY, se existir)
              </label>
            )}
            <p className="text-[11px] text-muted-foreground">
              Salva criptografada no banco. Nunca é enviada de volta ao browser.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <KeyRound className="size-3.5" /> Tavily API Key (Busca na Internet)
            </label>
            <input
              type="password"
              autoComplete="off"
              value={tavilyKey}
              onChange={(e) => setTavilyKey(e.target.value)}
              placeholder={
                data?.has_tavily_key
                  ? `Chave salva (${data.tavily_key_preview}). Digite aqui só se for trocar.`
                  : "tvly-..."
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {data?.has_tavily_key && (
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={clearTavily}
                  onChange={(e) => setClearTavily(e.target.checked)}
                />
                Limpar chave Tavily salva
              </label>
            )}
            <p className="text-[11px] text-muted-foreground">
              Usada pelo FitBot para buscar notícias, clima e dicas em tempo real antes de gerar posts automáticos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-full"
            >
              {save.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Salvar configurações
            </Button>
            <Button
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending}
              className="rounded-full"
            >
              {test.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Zap className="mr-2 size-4" />
              )}
              Testar conexão
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Como funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>ChatFit, geração de capa e posts do bot leem essa config a cada chamada.</li>
          <li>Se a chave estiver vazia, o backend tenta as env vars (CUSTOM_AI_API_KEY / OPENAI_API_KEY etc.).</li>
          <li>OpenAI, OpenRouter, Grok e Gemini usam formato OpenAI-compatível — ferramentas (tools) funcionam.</li>
          <li>Anthropic (Claude) funciona para texto; tools ficam desligadas.</li>
        </ul>
      </div>
    </div>
  );
}

function AccessModeCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPlatformSettings);
  const setFn = useServerFn(setAccessMode);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => getFn(),
  });

  const mutate = useMutation({
    mutationFn: (mode: "closed" | "open") => setFn({ data: { access_mode: mode } }),
    onSuccess: (r) => {
      toast.success(
        r.access_mode === "open"
          ? "🌐 Modo Aberto ativado — qualquer pessoa pode criar conta."
          : "🔒 Modo Fechado ativado — cadastro exige convite.",
      );
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const current = data?.access_mode ?? "closed";

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div>
        <h2 className="font-display text-lg font-bold">Modo de Acesso</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Controla se novos usuários precisam de código de convite para criar conta.
        </p>
      </div>

      {isLoading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => current !== "closed" && mutate.mutate("closed")}
            disabled={mutate.isPending}
            className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
              current === "closed"
                ? "border-primary bg-primary/5 shadow-flame"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <span className="font-semibold">🔒 Fechado</span>
              {current === "closed" && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  ATIVO
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Exige código de convite. Comunidade privada.
            </p>
          </button>

          <button
            type="button"
            onClick={() => current !== "open" && mutate.mutate("open")}
            disabled={mutate.isPending}
            className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
              current === "open"
                ? "border-primary bg-primary/5 shadow-flame"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <span className="font-semibold">🌐 Aberto</span>
              {current === "open" && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  ATIVO
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Qualquer pessoa cria conta livremente. Ideal para campanhas.
            </p>
          </button>
        </div>
      )}

      <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
        💡 O link <strong>/entrar</strong> sempre leva ao cadastro aberto, independente deste modo — use nos anúncios.
      </p>
    </div>
  );
}
