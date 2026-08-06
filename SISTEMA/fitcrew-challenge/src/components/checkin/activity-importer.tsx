import { useMemo, useRef, useState } from "react";
import { Activity, FileUp, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  parseActivityFile,
  type ImportedActivity,
} from "@/lib/activity-import";

const SOURCE_LABEL: Record<ImportedActivity["source"], string> = {
  apple_health: "Apple Health",
  google_fit: "Google Fit",
  strava_csv: "Strava (export)",
};

/**
 * Import de atividades por arquivo (sem API/OAuth).
 * Aceita export do Apple Health (.xml), Google Fit/Takeout (.json),
 * e Strava export (.csv). Client-side puro.
 */
export function ActivityImporter({
  onPick,
}: {
  onPick: (a: ImportedActivity) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<ImportedActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const recent = useMemo(() => {
    // Últimos 60 dias, mais recentes primeiro, cap em 30 itens
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    return activities
      .filter((a) => new Date(a.startedAt).getTime() >= cutoff)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .slice(0, 30);
  }, [activities]);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setLoading(true);
    setError(null);
    setFileName(f.name);
    try {
      const parsed = await parseActivityFile(f);
      if (!parsed.length) {
        setError("Nenhuma atividade encontrada nesse arquivo.");
      }
      setActivities(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler arquivo.");
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Activity className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Importar do seu smartwatch / app</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Apple Health (<code>export.xml</code>), Google Fit / Takeout (
            <code>.json</code>) ou Strava export (<code>activities.csv</code>).
            Tudo processado no seu navegador — nada sai do dispositivo.
          </p>
          <div className="mt-3">
            <input
              ref={inputRef}
              type="file"
              accept=".xml,.json,.csv,application/xml,application/json,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Lendo…
                </>
              ) : (
                <>
                  <FileUp className="mr-2 size-4" /> Escolher arquivo
                </>
              )}
            </Button>
            {fileName && !loading && (
              <span className="ml-2 text-xs text-muted-foreground">
                {fileName}
              </span>
            )}
          </div>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Como exportar
            </summary>
            <ul className="mt-2 space-y-1.5 pl-4 [list-style:disc]">
              <li>
                <strong>iPhone (Apple Health):</strong> app Saúde → toque na
                sua foto (topo) → <em>Exportar todos os dados de saúde</em> →
                envie o ZIP pra si mesmo e extraia. Suba o <code>export.xml</code>.
              </li>
              <li>
                <strong>Google Fit:</strong>{" "}
                <a
                  href="https://takeout.google.com/settings/takeout/custom/fit"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Takeout → Fit
                </a>{" "}
                → baixar → suba o JSON de sessões.
              </li>
              <li>
                <strong>Strava (grátis):</strong> em{" "}
                <a
                  href="https://www.strava.com/athlete/delete_your_account"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Meus dados → Solicitar arquivo
                </a>{" "}
                → aguarde o e-mail → extraia o ZIP → suba{" "}
                <code>activities.csv</code>.
              </li>
            </ul>
          </details>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {recent.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Atividades recentes ({recent.length})
          </p>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {recent.map((a) => {
              const d = new Date(a.startedAt);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onPick(a)}
                    className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.kind}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.toLocaleDateString("pt-BR")} ·{" "}
                        {a.durationMin}min
                        {a.distanceKm ? ` · ${a.distanceKm}km` : ""}
                        {a.calories ? ` · ${a.calories}kcal` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-primary">
                      {SOURCE_LABEL[a.source]}
                    </span>
                    <Upload className="size-4 text-muted-foreground group-hover:text-primary" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Toque em uma atividade pra preencher o check-in automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}

/** Card explicativo do Strava enquanto a API é paga. */
export function StravaComingSoon() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
          🏃
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Conectar Strava direto{" "}
            <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              em breve
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            O Strava passou a exigir assinatura paga pra criar apps na API. Assim que
            liberarmos, você conecta sua conta em 1 clique. Por enquanto dá pra
            importar seu arquivo grátis do Strava acima (activities.csv).
          </p>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Tenho assinatura Strava — como habilito?
            </summary>
            <ol className="mt-2 space-y-1 pl-5 [list-style:decimal]">
              <li>
                Acesse{" "}
                <a
                  href="https://www.strava.com/settings/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  strava.com/settings/api
                </a>{" "}
                logado.
              </li>
              <li>
                Crie um aplicativo (Categoria <em>Training</em>, callback domain
                do FitCrew).
              </li>
              <li>Nos avise pra ativarmos o botão "Conectar Strava" pra você.</li>
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}
