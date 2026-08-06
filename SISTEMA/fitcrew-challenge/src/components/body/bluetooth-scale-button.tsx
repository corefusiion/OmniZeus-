import { useEffect, useRef, useState } from "react";
import { Bluetooth, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  connectScale,
  isBluetoothScaleSupported,
  subscribeToWeight,
  type ScaleReading,
} from "@/lib/bluetooth-scale";

type Status = "idle" | "connecting" | "streaming" | "stabilized" | "error";

/**
 * Bluetooth scale button. Renders nothing on unsupported browsers (iOS, Firefox).
 * On unsupported: shows a small "por que não vejo o botão?" popover instead.
 */
export function BluetoothScaleButton({
  onReading,
  heightCm,
  sex,
  ageYears,
}: {
  onReading: (r: ScaleReading) => void;
  heightCm?: number | null;
  sex?: "male" | "female" | null;
  ageYears?: number | null;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [liveWeight, setLiveWeight] = useState<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const lastReadingsRef = useRef<ScaleReading[]>([]);

  useEffect(() => {
    let alive = true;
    isBluetoothScaleSupported().then((v) => {
      if (alive) setSupported(v);
    });
    return () => {
      alive = false;
      unsubRef.current?.();
    };
  }, []);

  if (supported === null) return null;

  if (!supported) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline underline-offset-2"
          >
            <Info className="size-3" />
            Não vejo o botão de conectar balança
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-72 text-xs">
          <p className="font-semibold">Bluetooth não disponível neste navegador</p>
          <p className="mt-1 text-muted-foreground">
            Web Bluetooth funciona no <b>Chrome, Edge ou Samsung Internet no Android</b>. No iPhone
            (Safari, Chrome iOS) a Apple não permite acesso a Bluetooth pelo navegador.
          </p>
          <p className="mt-2 text-muted-foreground">
            Enquanto isso, digite o peso manualmente — funciona igual em qualquer aparelho.
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  const stop = () => {
    unsubRef.current?.();
    unsubRef.current = null;
  };

  const handleClick = async () => {
    if (status === "streaming" || status === "connecting") {
      stop();
      setStatus("idle");
      setLiveWeight(null);
      return;
    }
    try {
      setStatus("connecting");
      lastReadingsRef.current = [];
      const device = await connectScale();
      setStatus("streaming");
      const unsub = await subscribeToWeight(
        device,
        (r) => {
          setLiveWeight(r.weightKg);
          const arr = lastReadingsRef.current;
          arr.push(r);
          if (arr.length > 6) arr.shift();

          // Stabilization: reading marked stable OR last 3 readings within 0.15kg
          const last3 = arr.slice(-3);
          const stable =
            r.isStabilized ||
            (last3.length === 3 &&
              Math.max(...last3.map((x) => x.weightKg)) -
                Math.min(...last3.map((x) => x.weightKg)) <
                0.15);
          if (stable && r.weightKg > 10) {
            setStatus("stabilized");
            onReading(r);
            toast.success(
              `Peso capturado: ${r.weightKg.toFixed(1)} kg${
                r.bodyFatPct ? ` · ${r.bodyFatPct.toFixed(1)}% gordura` : ""
              }`,
            );
            stop();
          }
        },
        { heightCm, sex, ageYears },
      );
      unsubRef.current = unsub;

      // 30s timeout
      setTimeout(() => {
        if (unsubRef.current === unsub) {
          stop();
          if (lastReadingsRef.current.length === 0) {
            setStatus("error");
            toast.error("Nenhuma leitura recebida. Suba na balança e tente de novo.");
            setTimeout(() => setStatus("idle"), 2000);
          } else {
            setStatus("idle");
          }
        }
      }, 30_000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao conectar";
      // User canceled the chooser — silent
      if (/cancel|user gesture|chooser/i.test(message)) {
        setStatus("idle");
        return;
      }
      setStatus("error");
      toast.error(message);
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  const label = (() => {
    if (status === "connecting") return "Conectando…";
    if (status === "streaming") return liveWeight ? `${liveWeight.toFixed(1)} kg…` : "Suba na balança";
    if (status === "stabilized") return "Peso capturado ✓";
    return "Conectar balança";
  })();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-1.5"
      >
        {status === "connecting" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : status === "streaming" ? (
          <Loader2 className="size-3.5 animate-spin text-blue-500" />
        ) : (
          <Bluetooth className="size-3.5 text-blue-500" />
        )}
        <span className="text-xs font-semibold">{label}</span>
      </Button>

    </div>
  );
}
