import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return window.location.origin + path;
}

export function ShareMenu({
  path,
  text,
  imageUrl,
}: {
  path: string;
  text: string;
  imageUrl?: string | null;
}) {
  const url = absoluteUrl(path);
  const shareText = `${text} — via FitCrew`;

  const openWindow = (target: string) =>
    window.open(target, "_blank", "noopener,noreferrer,width=680,height=680");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const nativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: "FitCrew", text: shareText, url });
    } catch {
      /* usuário cancelou */
    }
  };

  const openInstagram = async () => {
    await copyLink();
    toast.info(
      "Instagram não permite postagem direta pelo navegador. Link copiado — cole no seu story ou post.",
    );
    if (imageUrl) window.open(imageUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        aria-label="Compartilhar"
      >
        <Share2 className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Compartilhar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            openWindow(
              `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${url}`)}`,
            )
          }
        >
          <span className="mr-2">🟢</span> WhatsApp (status/chat)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openWindow(
              `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
            )
          }
        >
          <span className="mr-2">𝕏</span> Twitter / X
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openWindow(
              `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            )
          }
        >
          <span className="mr-2">📘</span> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openWindow(
              `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
            )
          }
        >
          <span className="mr-2">✈️</span> Telegram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openInstagram}>
          <span className="mr-2">📷</span> Instagram (copia link)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={nativeShare}>
          <Share2 className="mr-2 size-4" /> Mais opções…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <Copy className="mr-2 size-4" /> Copiar link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
