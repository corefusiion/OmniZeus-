import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  inviteUrl: string;
  inviteCode: string;
  challengeName: string;
};

export function QrInviteModal({ open, onClose, inviteUrl, inviteCode, challengeName }: Props) {
  if (!open) return null;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Entre no ${challengeName}`,
          text: `Você foi convidado para o desafio ${challengeName}!`,
          url: inviteUrl,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Link copiado!");
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-flame"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Convite por QR</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aponte a câmera para entrar no desafio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid place-items-center rounded-2xl bg-white p-5">
          <QRCodeSVG value={inviteUrl} size={220} level="M" includeMargin={false} />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Código
          </p>
          <p className="mt-0.5 truncate font-mono text-lg font-bold tracking-wide">{inviteCode}</p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              toast.success("Link copiado!");
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2.5 text-xs font-semibold hover:bg-secondary"
          >
            <Copy className="size-3.5" /> Copiar link
          </button>
          <button
            type="button"
            onClick={share}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-flame hover:opacity-90"
          >
            <Share2 className="size-3.5" /> Compartilhar
          </button>
        </div>
      </div>
    </div>
  );
}
