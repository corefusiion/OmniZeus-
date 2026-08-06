import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  generateChallengeBanners,
  setChallengeBanner,
} from "@/lib/challenge-banner.functions";

interface Option {
  style: string;
  label: string;
  path: string;
  signedUrl: string;
}

interface Props {
  challengeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export function BannerPickerModal({ challengeId, open, onOpenChange, onDone }: Props) {
  const qc = useQueryClient();
  const generateFn = useServerFn(generateChallengeBanners);
  const setFn = useServerFn(setChallengeBanner);
  const [selected, setSelected] = useState<string | null>(null);

  const genQ = useQuery({
    queryKey: ["challenge-banner-options", challengeId, open],
    queryFn: () => generateFn({ data: { challengeId } }),
    enabled: open,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    retry: false,
  });

  const regenerate = () => {
    setSelected(null);
    qc.removeQueries({ queryKey: ["challenge-banner-options", challengeId] });
    genQ.refetch();
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selected || !genQ.data) throw new Error("Escolha uma imagem.");
      const paths = genQ.data.options.map((o) => o.path);
      return setFn({
        data: { challengeId, path: selected, discardPaths: paths },
      });
    },
    onSuccess: () => {
      toast.success("Capa do desafio definida!");
      qc.invalidateQueries({ queryKey: ["challenge-hub", challengeId] });
      qc.invalidateQueries({ queryKey: ["challenge-banner-url"] });
      onOpenChange(false);
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const options: Option[] = genQ.data?.options ?? [];
  const loading = genQ.isLoading || genQ.isFetching;
  const remaining = (genQ.data as any)?.remaining;
  const limit = (genQ.data as any)?.limit;
  const unlimited = (genQ.data as any)?.unlimited;
  const noMore = !unlimited && typeof remaining === "number" && remaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="size-5 text-primary" />
            Escolha a capa do desafio
          </DialogTitle>
          <DialogDescription>
            A IA gerou 3 opções com estilos diferentes a partir do nome do desafio. Escolha
            a que mais combina — dá pra trocar depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          {loading &&
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="aspect-video animate-pulse rounded-xl bg-gradient-to-br from-primary/20 via-muted to-orange-500/10"
              />
            ))}
          {!loading &&
            options.map((opt) => {
              const isSel = selected === opt.path;
              return (
                <button
                  key={opt.path}
                  type="button"
                  onClick={() => setSelected(opt.path)}
                  className={`group relative overflow-hidden rounded-xl ring-2 transition-all ${
                    isSel
                      ? "ring-primary shadow-flame scale-[1.02]"
                      : "ring-transparent hover:ring-primary/40"
                  }`}
                >
                  <img
                    src={opt.signedUrl}
                    alt={opt.label}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-left">
                    <p className="text-xs font-semibold text-white">{opt.label}</p>
                  </div>
                  {isSel && (
                    <div className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-flame">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          {!loading && options.length === 0 && genQ.error && (
            <div className="col-span-full rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {(genQ.error as Error).message}
            </div>
          )}
        </div>

        {loading && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Gerando 3 estilos exclusivos… pode levar até 20s.
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={regenerate}
              disabled={loading || saveMut.isPending || noMore}
              className="rounded-full"
            >
              <RefreshCw className="mr-1 size-3.5" /> Gerar de novo
            </Button>
            {typeof limit === "number" && !unlimited && (
              <p className="text-[10px] text-muted-foreground">
                {remaining} de {limit} gerações restantes
              </p>
            )}
            {noMore && (
              <p className="text-[10px] text-destructive">
                Limite atingido. Em breve: moedas 🪙
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onDone?.();
              }}
              disabled={saveMut.isPending}
              className="rounded-full"
            >
              <X className="mr-1 size-3.5" /> Pular por agora
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selected || saveMut.isPending}
              onClick={() => saveMut.mutate()}
              className="rounded-full shadow-flame"
            >
              {saveMut.isPending ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" /> Salvando…
                </>
              ) : (
                "Confirmar capa"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
