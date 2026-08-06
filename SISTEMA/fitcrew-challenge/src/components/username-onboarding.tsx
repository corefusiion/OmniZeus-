import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AtSign, Check, Loader2, Ruler, Scale, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkUsernameAvailability, setUsername } from "@/lib/username.functions";


import { recordBodyMetrics, skipInitialMetrics } from "@/lib/metrics.functions";

function sanitize(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

function suggestFromName(displayName?: string | null) {
  if (!displayName) return [] as string[];
  const base = sanitize(
    displayName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_"),
  );
  if (!base) return [];
  const clipped = base.slice(0, 16);
  return [clipped, `${clipped}_fit`, `${clipped}${Math.floor(Math.random() * 90 + 10)}`].filter(
    (v, i, a) => v.length >= 3 && a.indexOf(v) === i,
  );
}

function bmiOf(w: number, hCm: number) {
  const h = hCm / 100;
  return +(w / (h * h)).toFixed(1);
}
function bmiLabel(b: number) {
  if (b < 18.5) return { text: "abaixo do peso", color: "text-sky-500" };
  if (b < 25) return { text: "peso ideal", color: "text-emerald-500" };
  if (b < 30) return { text: "sobrepeso", color: "text-amber-500" };
  return { text: "obesidade", color: "text-rose-500" };
}

export function UsernameOnboarding({
  open,
  displayName,
  needsUsername,
  needsMetrics,
  onDone,
}: {
  open: boolean;
  displayName?: string | null;
  needsUsername: boolean;
  needsMetrics: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"username" | "metrics">(needsUsername ? "username" : "metrics");

  useEffect(() => {
    if (open) setStep(needsUsername ? "username" : "metrics");
  }, [open, needsUsername]);

  return (
    <Dialog open={open} onOpenChange={() => { /* bloqueante */ }}>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {step === "username" ? (
          <UsernameStep
            displayName={displayName}
            onNext={() => {
              if (needsMetrics) setStep("metrics");
              else onDone();
            }}
          />
        ) : (
          <MetricsStep onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UsernameStep({
  displayName,
  onNext,
}: {
  displayName?: string | null;
  onNext: () => void;
}) {
  const queryClient = useQueryClient();
  const setFn = useServerFn(setUsername);
  const checkFn = useServerFn(checkUsernameAvailability);

  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const suggestions = useMemo(() => suggestFromName(displayName), [displayName]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 350);
    return () => clearTimeout(t);
  }, [value]);

  const check = useQuery({
    queryKey: ["username-check", debounced],
    enabled: debounced.length >= 3,
    queryFn: () => checkFn({ data: { username: debounced } }),
  });

  const save = useMutation({
    mutationFn: (username: string) => setFn({ data: { username } }),
    onSuccess: async () => {
      toast.success("Username salvo!");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      onNext();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const state = (() => {
    if (value.length < 3) return { icon: null, msg: "3 a 20 caracteres." };
    if (!/^[a-z0-9_]+$/.test(value))
      return { icon: <X className="size-4 text-destructive" />, msg: "Use apenas letras minúsculas, números e _." };
    if (check.isFetching) return { icon: <Loader2 className="size-4 animate-spin" />, msg: "Verificando…" };
    if (check.data?.available) return { icon: <Check className="size-4 text-primary" />, msg: "Disponível!" };
    if (check.data && !check.data.available)
      return { icon: <X className="size-4 text-destructive" />, msg: check.data.reason ?? "Indisponível." };
    return { icon: null, msg: "" };
  })();

  const canSubmit = check.data?.available && !save.isPending;

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">1</span>
          Passo 1 de 2
        </div>
        <DialogTitle className="font-display text-2xl">Escolha seu @username</DialogTitle>
        <DialogDescription>
          Ele será seu identificador único no FitCrew. Poderá alterar 1x a cada 30 dias.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="relative">
          <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(sanitize(e.target.value))}
            placeholder="seu_username"
            className="pl-9 font-mono lowercase"
            maxLength={20}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{state.icon}</div>
        </div>
        <p className={`text-xs ${check.data && !check.data.available ? "text-destructive" : "text-muted-foreground"}`}>
          {state.msg}
        </p>

        {suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestões</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue(s)}
                  className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                >
                  @{s}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button onClick={() => save.mutate(value)} disabled={!canSubmit} className="w-full rounded-full shadow-flame">
          {save.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Salvando…
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </div>
    </>
  );
}

function MetricsStep({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(recordBodyMetrics);
  const skipFn = useServerFn(skipInitialMetrics);

  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "">("");

  const wNum = Number(weight);
  const hNum = Number(height);
  const validPreview = wNum >= 20 && wNum <= 400 && hNum >= 80 && hNum <= 260;
  const bmi = validPreview ? bmiOf(wNum, hNum) : null;
  const bmiInfo = bmi != null ? bmiLabel(bmi) : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!(wNum >= 20 && wNum <= 400)) throw new Error("Peso inválido (20-400 kg).");
      return saveFn({
        data: {
          weight_kg: wNum,
          height_cm: hNum >= 80 && hNum <= 260 ? Math.round(hNum) : null,
          sex: sex || null,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Métricas salvas — post publicado no feed! 🔥");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["me"] }),
        qc.invalidateQueries({ queryKey: ["timeline"] }),
        qc.invalidateQueries({ queryKey: ["settings-profile"] }),
      ]);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const skip = useMutation({
    mutationFn: () => skipFn({}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      onDone();
    },
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">2</span>
          Passo 2 de 2
        </div>
        <DialogTitle className="font-display text-2xl">Suas métricas iniciais</DialogTitle>
        <DialogDescription>
          Peso e altura permitem calcular IMC, metabolismo basal e mostrar sua evolução no feed. Você pode alterar em Configurações a qualquer momento.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="w" className="flex items-center gap-1.5 text-xs">
              <Scale className="size-3.5" /> Peso (kg)
            </Label>
            <Input
              id="w"
              autoFocus
              type="number"
              step="0.1"
              min={20}
              max={400}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="72.5"
            />
          </div>
          <div>
            <Label htmlFor="h" className="flex items-center gap-1.5 text-xs">
              <Ruler className="size-3.5" /> Altura (cm)
            </Label>
            <Input
              id="h"
              type="number"
              min={80}
              max={260}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="178"
            />
          </div>
        </div>

        {bmi != null && bmiInfo && (
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold">IMC {bmi}</span>
              <span className={`text-sm font-medium ${bmiInfo.color}`}>{bmiInfo.text}</span>
            </div>
          </div>
        )}

        <div>
          <Label className="mb-2 block text-xs">Sexo (para calcular metabolismo basal com precisão)</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["M", "F"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSex(opt)}
                className={`rounded-2xl border-2 px-4 py-3 text-sm font-medium transition ${
                  sex === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {opt === "M" ? "Masculino" : "Feminino"}
              </button>
            ))}
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          Ao salvar, a IA publicará automaticamente um post elegante com sua evolução no feed para a crew acompanhar.
        </p>


        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 rounded-full"
            onClick={() => skip.mutate()}
            disabled={skip.isPending || save.isPending}
          >
            Pular
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!validPreview || save.isPending}
            className="flex-1 rounded-full shadow-flame"
          >
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Salvando…
              </>
            ) : (
              "Salvar métricas"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
