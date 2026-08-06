import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Camera, ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { analyzeBodyScan } from "@/lib/body-scan.functions";
import { BluetoothScaleButton } from "@/components/body/bluetooth-scale-button";
import { ClassificationBar } from "@/components/body/classification-bar";
import { BodyTypeGrid } from "@/components/body/body-type-grid";
import { BodyGoalsCard } from "@/components/body/goals-card";
import { bmi as calcBmi } from "@/lib/body-classification";


type Step = "photos" | "measures" | "analyzing" | "result";

type ScanResult = {
  id: string;
  body_fat_pct: number;
  muscle_mass_pct: number;
  body_type: string;
  notes: string[];
  delta_fat: number | null;
};

const BODY_TYPE_LABEL: Record<string, string> = {
  magro: "Magro",
  atletico: "Atlético",
  medio: "Médio",
  acima_do_peso: "Acima do peso",
  obeso: "Obeso",
};

async function uploadScanPhoto(userId: string, file: File, side: "front" | "side"): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}-${side}.${ext}`;
  const { error } = await supabase.storage.from("body-scan-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export function BodyScanWizard({
  open,
  onOpenChange,
  challengeId,
  defaultWeight,
  defaultHeight,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  challengeId?: string | null;
  defaultWeight?: number | null;
  defaultHeight?: number | null;
  onDone?: () => void;
}) {
  const analyzeFn = useServerFn(analyzeBodyScan);

  const [step, setStep] = useState<Step>("photos");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [sidePreview, setSidePreview] = useState<string | null>(null);
  const [weight, setWeight] = useState<string>(defaultWeight ? String(defaultWeight) : "");
  const [height, setHeight] = useState<string>(defaultHeight ? String(defaultHeight) : "");
  const [share, setShare] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const sideRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("photos");
    setFrontFile(null);
    setSideFile(null);
    setFrontPreview(null);
    setSidePreview(null);
    setResult(null);
  };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(reset, 250);
  };

  const analyzeMut = useMutation({
    mutationFn: async () => {
      const w = Number(weight.replace(",", "."));
      const h = height ? Number(height) : null;
      if (!w) throw new Error("Peso inválido.");
      if (!frontFile || !sideFile) throw new Error("Envie as duas fotos.");

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada.");

      setStep("analyzing");
      const [frontPath, sidePath] = await Promise.all([
        uploadScanPhoto(userId, frontFile, "front"),
        uploadScanPhoto(userId, sideFile, "side"),
      ]);

      return analyzeFn({
        data: {
          challengeId: challengeId ?? null,
          weight_kg: w,
          height_cm: h,
          photoFrontPath: frontPath,
          photoSidePath: sidePath,
          shareWithChallenge: share,
        },
      });
    },
    onSuccess: (r) => {
      setResult(r);
      setStep("result");
      onDone?.();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setStep("measures");
    },
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> AI Body Scan
          </DialogTitle>
          <DialogDescription>
            Estimativa educativa de composição corporal. Não substitui bioimpedância.
          </DialogDescription>
        </DialogHeader>

        {step === "photos" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Envie 2 fotos: <b>frente</b> e <b>lado</b>. Corpo inteiro, fundo neutro, roupa justa
              (bermuda / top), luz boa. Suas fotos ficam privadas.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <PhotoPicker
                label="Frente"
                preview={frontPreview}
                inputRef={frontRef}
                onFile={(f) => {
                  setFrontFile(f);
                  setFrontPreview(URL.createObjectURL(f));
                }}
                onClear={() => {
                  setFrontFile(null);
                  setFrontPreview(null);
                }}
              />
              <PhotoPicker
                label="Lado"
                preview={sidePreview}
                inputRef={sideRef}
                onFile={(f) => {
                  setSideFile(f);
                  setSidePreview(URL.createObjectURL(f));
                }}
                onClear={() => {
                  setSideFile(null);
                  setSidePreview(null);
                }}
              />
            </div>

            <Button
              className="w-full"
              disabled={!frontFile || !sideFile}
              onClick={() => setStep("measures")}
            >
              Continuar
            </Button>
          </div>
        )}

        {step === "measures" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Medidas</p>
              <BluetoothScaleButton
                heightCm={height ? Number(height) : null}
                onReading={(r) => {
                  setWeight(r.weightKg.toFixed(1));
                  toast.success("Peso preenchido pela balança");
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="scan-w" className="text-xs">Peso (kg)</Label>
                <Input
                  id="scan-w"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="72.4"
                />
              </div>
              <div>
                <Label htmlFor="scan-h" className="text-xs">Altura (cm)</Label>
                <Input
                  id="scan-h"
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="178"
                />
              </div>
            </div>


            {challengeId && (
              <label className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs">
                <span>
                  <span className="font-semibold">Compartilhar com o desafio</span>
                  <br />
                  <span className="text-muted-foreground">Só delta relativo, valores exatos ficam privados.</span>
                </span>
                <Switch checked={share} onCheckedChange={setShare} />
              </label>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("photos")}>
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={() => analyzeMut.mutate()}
                disabled={analyzeMut.isPending || !weight}
              >
                {analyzeMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Analisar"}
              </Button>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="grid place-items-center gap-3 py-10 text-center">
            <div className="relative">
              <Sparkles className="size-10 animate-pulse text-primary" />
            </div>
            <p className="font-semibold">Analisando composição corporal…</p>
            <p className="text-xs text-muted-foreground">Pode levar até 20 segundos.</p>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Gordura corporal" value={`${result.body_fat_pct.toFixed(1)}%`} highlight />
              <StatCard label="Massa muscular" value={`${result.muscle_mass_pct.toFixed(1)}%`} />
              <StatCard
                label="Tipo corporal"
                value={BODY_TYPE_LABEL[result.body_type] ?? result.body_type}
              />
              {result.delta_fat != null && (
                <StatCard
                  label="Vs. primeiro scan"
                  value={`${result.delta_fat > 0 ? "+" : ""}${result.delta_fat.toFixed(1)}%`}
                  tone={result.delta_fat < 0 ? "good" : result.delta_fat > 0 ? "warn" : undefined}
                />
              )}
            </div>

            {(() => {
              const w = Number(weight.replace(",", "."));
              const h = height ? Number(height) : null;
              const bmiVal = h ? calcBmi(w, h) : null;
              return (
                <>
                  {bmiVal != null && (
                    <div className="rounded-2xl border border-border bg-card p-3">
                      <ClassificationBar bmi={bmiVal} />
                    </div>
                  )}
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <BodyTypeGrid bmi={bmiVal} fatPct={result.body_fat_pct} sex={null} />
                  </div>
                </>
              );
            })()}

            <BodyGoalsCard metricId={result.id} />

            {result.notes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Observações da IA</p>
                <ul className="space-y-1 rounded-2xl bg-secondary/40 p-3 text-sm">
                  {result.notes.map((n, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              ⚠️ Estimativa educativa baseada em imagem. Não substitui bioimpedância nem avaliação profissional.
            </p>

            <Button className="w-full" onClick={() => close(false)}>
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PhotoPicker({
  label,
  preview,
  inputRef,
  onFile,
  onClear,
}: {
  label: string;
  preview: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border-2 border-dashed border-border bg-secondary/30">
      {preview ? (
        <>
          <img src={preview} alt={label} className="size-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white"
            aria-label="Remover"
          >
            <X className="size-4" />
          </button>
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
            {label}
          </span>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="grid size-full place-items-center gap-2 text-muted-foreground transition hover:bg-secondary/50"
        >
          <Camera className="size-8" />
          <span className="text-xs font-semibold">{label}</span>
          <span className="flex items-center gap-1 text-[10px]">
            <ImageIcon className="size-3" /> Tocar para adicionar
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-500"
      : tone === "warn"
      ? "text-orange-500"
      : highlight
      ? "text-primary"
      : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
