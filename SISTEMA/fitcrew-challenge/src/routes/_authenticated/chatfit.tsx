import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bot, Camera, ImagePlus, Loader2, Send, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  clearCoachHistory,
  listCoachMessages,
  sendCoachMessage,
} from "@/lib/coach-chat.functions";

export const Route = createFileRoute("/_authenticated/chatfit")({
  component: ChatFitPage,
  errorComponent: ({ error }) => (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
  head: () => ({ meta: [{ title: "Chat Fit · FitCrew" }] }),
});

const MAX_IMAGE_MB = 5;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });
}

function ChatFitPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCoachMessages);
  const sendFn = useServerFn(sendCoachMessage);
  const clearFn = useServerFn(clearCoachHistory);
  const [input, setInput] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);


  const { data } = useQuery({
    queryKey: ["coach-messages"],
    queryFn: () => listFn(),
  });

  const sendMut = useMutation({
    mutationFn: (payload: { content: string; image_data_url: string | null; pay_extra?: boolean }) =>
      sendFn({ data: payload }),
    onSuccess: (res) => {
      setInput("");
      setImageDataUrl(null);
      qc.invalidateQueries({ queryKey: ["coach-messages"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      if (res.tools?.length) {
        for (const t of res.tools) {
          if (t.name === "post_to_feed" && t.result?.ok) toast.success("Publicado no feed! 🎉");
          if (t.name === "log_meal" && t.result?.ok) toast.success("Refeição registrada no diário.");
        }
      }
    },
    onError: (e: Error, vars) => {
      const msg = e.message ?? "";
      if (msg.startsWith("VISION_LIMIT:")) {
        const detail = msg.slice("VISION_LIMIT:".length);
        if (window.confirm(`${detail}\n\nGastar 15 FitCoins agora para uma análise extra?`)) {
          sendMut.mutate({ ...vars, pay_extra: true });
        }
        return;
      }
      if (msg.startsWith("CHAT_LIMIT:")) {
        toast.error(msg.slice("CHAT_LIMIT:".length), {
          action: { label: "Ir à loja", onClick: () => (window.location.href = "/store") },
        });
        return;
      }
      if (msg.startsWith("NO_FITCOINS:")) {
        toast.error(msg.slice("NO_FITCOINS:".length), {
          action: { label: "Comprar", onClick: () => (window.location.href = "/store") },
        });
        return;
      }
      toast.error(msg);
    },
  });

  const clearMut = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-messages"] });
      toast.success("Histórico limpo.");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages.length, sendMut.isPending]);

  const messages = data?.messages ?? [];
  const unlimited = (data as any)?.unlimited === true;
  const isPro = (data as any)?.isPro === true;
  const remaining = Math.max(0, (data?.dailyLimit ?? 10) - (data?.todayCount ?? 0));
  const atLimit = !unlimited && remaining === 0;


  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie apenas imagens.");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande (máx ${MAX_IMAGE_MB}MB).`);
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setImageDataUrl(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && !imageDataUrl) || sendMut.isPending) return;
    sendMut.mutate({ content: text, image_data_url: imageDataUrl });
  }


  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-flame">
            <Bot className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight">Coach FitCrew</h1>
            <p className="text-xs text-muted-foreground">
              <Sparkles className="mr-1 inline size-3" />
              {isPro
                ? "PRO · Mensagens ilimitadas 👑"
                : unlimited
                  ? "Mensagens ilimitadas (Super Admin)"
                  : (
                    <>
                      {remaining} de {data?.dailyLimit ?? 10} restantes hoje ·{" "}
                      <Link to="/store" className="font-medium text-primary underline-offset-2 hover:underline">
                        Loja
                      </Link>
                    </>
                  )}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearMut.mutate()}
            disabled={clearMut.isPending}
            className="text-muted-foreground"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-3xl border border-border bg-card p-4 shadow-soft"
      >
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-sm space-y-2">
              <p className="font-display text-lg font-bold">Manda tua dúvida 💪</p>
              <p className="text-sm text-muted-foreground">
                Peça sugestão de treino, envie a foto do seu prato pra análise nutricional, ou tire dúvidas sobre constância.
              </p>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sendMut.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="inline size-4 animate-spin" /> pensando…
            </div>
          </div>
        )}
      </div>

      {/* Preview da imagem selecionada */}
      {imageDataUrl && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
          <img
            src={imageDataUrl}
            alt="Imagem para análise"
            className="size-14 rounded-xl object-cover"
          />
          <span className="flex-1 text-xs text-muted-foreground">
            Imagem pronta pra análise. Descreva ou envie direto.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setImageDataUrl(null)}
            aria-label="Remover imagem"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0 rounded-2xl"
          disabled={atLimit || sendMut.isPending}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar imagem"
        >
          <ImagePlus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0 rounded-2xl"
          disabled={atLimit || sendMut.isPending}
          onClick={() => cameraInputRef.current?.click()}
          aria-label="Abrir câmera"
          title="Abrir câmera"
        >
          <Camera className="size-4" />
        </Button>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          rows={2}
          disabled={atLimit || sendMut.isPending}
          placeholder={
            atLimit
              ? "Limite diário atingido. Volte amanhã."
              : imageDataUrl
                ? "Adicione um contexto (opcional)…"
                : "Pergunte ou envie uma foto do prato…"
          }
          className="resize-none rounded-2xl"
        />
        <Button
          type="submit"
          disabled={(!input.trim() && !imageDataUrl) || sendMut.isPending || atLimit}
          className="rounded-2xl"
          aria-label="Enviar"
        >
          {sendMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
