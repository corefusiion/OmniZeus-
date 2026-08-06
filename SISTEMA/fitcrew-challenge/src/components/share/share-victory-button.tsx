import { useRef, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShareVictoryCard, type ShareVictoryData } from "./share-victory-card";
import { renderAndShare } from "@/lib/share-image";

type Props = {
  data: ShareVictoryData;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
  label?: string;
};

export function ShareVictoryButton({
  data,
  className,
  size = "default",
  variant = "default",
  label = "Compartilhar Vitória",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const { shared } = await renderAndShare({
        node: ref.current,
        filename: `fitcrew-${data.challengeName.replace(/\s+/g, "-")}.png`,
        title: `${data.displayName} no FitCrew`,
        text: `Estou em ${data.position}º no desafio "${data.challengeName}". Bate de frente! 💪`,
      });
      if (!shared) toast.success("Imagem baixada — poste no seu story!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu para gerar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={handle}
        disabled={busy}
        size={size}
        variant={variant}
        className={className}
      >
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
        {label}
      </Button>
      {/* Off-screen render surface */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <ShareVictoryCard ref={ref} data={data} />
      </div>
    </>
  );
}
