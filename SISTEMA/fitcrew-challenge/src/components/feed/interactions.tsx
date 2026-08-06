import { motion } from "framer-motion";
import { CornerUpLeft, Heart, MessageCircle, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import { useState } from "react";

import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MentionTextarea } from "@/components/feed/mention-textarea";
import { RenderMentions } from "@/components/render-mentions";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const QUICK_EMOJIS = ["💪", "🔥", "👏", "🚀", "😂", "🎉", "🙌", "😍"] as const;

export type Reaction = { emoji: string; user_id: string };
export type Comment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  is_bot?: boolean;
  flagged_terms?: string[] | null;
  author: { display_name: string; avatar_url: string | null; username?: string | null } | null;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Renderiza o corpo do comentário destacando os termos ofensivos sinalizados. */
function HighlightedBody({ body, terms }: { body: string; terms: string[] }) {
  if (!terms.length) return <>{body}</>;
  const normBody = stripAccents(body.toLowerCase());
  const patterns = terms
    .map((t) => stripAccents(t.toLowerCase()))
    .filter(Boolean)
    .map(escapeRegex)
    .join("|");
  if (!patterns) return <>{body}</>;
  const re = new RegExp(`(?:^|[^a-z0-9])(${patterns})(?=$|[^a-z0-9])`, "gi");
  const out: React.ReactNode[] = [];
  let cursor = 0;
  // Trabalhamos no texto normalizado para achar índices, mas exibimos o original.
  let m: RegExpExecArray | null;
  while ((m = re.exec(normBody)) !== null) {
    const matchStart = m.index + m[0].indexOf(m[1]);
    const matchEnd = matchStart + m[1].length;
    if (matchStart > cursor) out.push(body.slice(cursor, matchStart));
    out.push(
      <mark
        key={`f-${matchStart}`}
        className="rounded-sm bg-destructive/15 px-0.5 font-medium text-destructive line-through decoration-destructive decoration-2"
      >
        {body.slice(matchStart, matchEnd)}
      </mark>,
    );
    cursor = matchEnd;
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  if (cursor < body.length) out.push(body.slice(cursor));
  return <>{out}</>;
}


export function ReactionBar({
  reactions,
  currentUserId,
  commentsCount,
  onToggleComments,
  onReact,
  shareSlot,
  isPending,
}: {
  reactions: Reaction[];
  currentUserId: string | null;
  commentsCount: number;
  onToggleComments: () => void;
  onReact: (emoji: string) => void;
  shareSlot?: ReactNode;
  isPending?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const counts = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    const entry = acc[r.emoji] ?? { count: 0, mine: false };
    entry.count += 1;
    if (r.user_id === currentUserId) entry.mine = true;
    acc[r.emoji] = entry;
    return acc;
  }, {});

  const total = reactions.length;
  const iLiked = reactions.some((r) => r.user_id === currentUserId && r.emoji === "❤️");

  // Top 3 emojis presentes + emojis rápidos que ainda não estão
  const usedEmojis = Object.entries(counts)
    .filter(([e]) => e !== "❤️")
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([e]) => e);
  const quickToShow = usedEmojis.length
    ? usedEmojis
    : QUICK_EMOJIS.slice(0, 3).map((e) => e as string);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => onReact("❤️")}
        disabled={isPending}
        className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
          iLiked ? "text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
        aria-label="Curtir"
      >
        <motion.span
          key={iLiked ? "on" : "off"}
          initial={{ scale: iLiked ? 0.6 : 1 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        >
          <Heart className={`size-5 ${iLiked ? "fill-primary text-primary" : ""}`} />
        </motion.span>
        <span className="tabular-nums">{total}</span>
      </motion.button>

      <button
        onClick={onToggleComments}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <MessageCircle className="size-5" />
        <span className="tabular-nums">{commentsCount}</span>
      </button>

      {shareSlot}

      <div className="ml-auto flex items-center gap-1">
        {quickToShow.map((e) => {
          const info = counts[e];
          return (
            <button
              key={e}
              onClick={() => onReact(e)}
              disabled={isPending}
              className={`inline-flex h-8 items-center gap-1 rounded-full px-2 text-sm transition ${
                info?.mine
                  ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <span>{e}</span>
              {info?.count ? <span className="text-xs font-semibold tabular-nums">{info.count}</span> : null}
            </button>
          );
        })}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isPending}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground transition hover:bg-secondary"
              aria-label="Escolher outro emoji"
            >
              <Plus className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto border-0 bg-transparent p-0 shadow-none">
            <Suspense fallback={<div className="rounded-2xl bg-card p-4 text-sm">…</div>}>
              <EmojiPicker
                onEmojiClick={(d: { emoji: string }) => {
                  onReact(d.emoji);
                  setPickerOpen(false);
                }}
                width={320}
                height={360}
                lazyLoadEmojis
              />
            </Suspense>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function CommentThread({
  comments,
  currentUserId,
  isAdmin,
  onAdd,
  onEdit,
  onDelete,
  isPending,
}: {
  comments: Comment[];
  currentUserId?: string | null;
  isAdmin?: boolean;
  onAdd: (body: string) => void;
  onEdit?: (commentId: string, body: string) => void;
  onDelete?: (commentId: string) => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const visible = showAll ? comments : comments.slice(-2);

  const handleReply = (username?: string | null, displayName?: string | null) => {
    const handle = username ?? (displayName ?? "").toLowerCase().replace(/\s+/g, "");
    if (!handle) return;
    const mention = `@${handle} `;
    setValue((prev) => (prev.includes(mention) ? prev : mention + prev.replace(/^@\S+\s+/, "")));
  };


  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-3 space-y-3 border-t border-border pt-3"
    >
      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground">Seja o primeiro a comentar.</p>
      )}

      {!showAll && comments.length > 2 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Ver todos os {comments.length} comentários
        </button>
      )}

      <ul className="space-y-2.5">
        {visible.map((cm) => {
          const initials = (cm.author?.display_name ?? "?").slice(0, 2).toUpperCase();
          const isMine = cm.user_id === currentUserId;
          const canEdit = (isMine || isAdmin) && !!onEdit;
          const canDelete = (isMine || isAdmin) && !!onDelete;
          const isEditing = editingId === cm.id;
          return (
            <li key={cm.id} className="flex items-start gap-2">
              <Avatar className={`size-8 shrink-0 ${cm.is_bot ? "ring-2 ring-primary/40" : ""}`}>
                <AvatarImage src={cm.author?.avatar_url ?? undefined} />
                <AvatarFallback>{cm.is_bot ? "🤖" : initials}</AvatarFallback>
              </Avatar>
              <div className={`group min-w-0 flex-1 rounded-2xl px-3 py-2 ${cm.is_bot ? "bg-primary/10 ring-1 ring-primary/20" : "bg-secondary/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    {cm.author?.display_name ?? "Sem nome"}
                    {cm.is_bot && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                        IA · Coach
                      </span>
                    )}
                  </p>
                  {!isEditing && !cm.is_bot && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Responder ${cm.author?.display_name ?? ""}`}
                        onClick={() => handleReply(cm.author?.username, cm.author?.display_name)}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition hover:bg-background hover:text-primary"
                      >
                        <CornerUpLeft className="size-3" />
                        Responder
                      </button>
                      {(canEdit || canDelete) && (
                        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          {canEdit && (
                            <button
                              type="button"
                              aria-label="Editar comentário"
                              onClick={() => {
                                setEditingId(cm.id);
                                setEditDraft(cm.body);
                              }}
                              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                            >
                              <Pencil className="size-3" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              aria-label="Apagar comentário"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Apagar comentário?",
                                  description:
                                    "Tem certeza que deseja excluir este comentário? Essa ação não poderá ser desfeita.",
                                  confirmLabel: "Excluir",
                                });
                                if (ok) onDelete?.(cm.id);
                              }}
                              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
                {isEditing ? (
                  <form
                    className="mt-1.5 flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const body = editDraft.trim();
                      if (!body || body === cm.body) {
                        setEditingId(null);
                        return;
                      }
                      onEdit?.(cm.id, body);
                      setEditingId(null);
                    }}
                  >
                    <Input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      maxLength={500}
                      className="h-8 rounded-full bg-background text-sm"
                    />
                    <Button type="submit" size="icon" className="size-8 shrink-0 rounded-full">
                      <Send className="size-3.5" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancelar"
                      className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-background"
                    >
                      <X className="size-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {cm.flagged_terms && cm.flagged_terms.length > 0 ? (
                        <HighlightedBody body={cm.body} terms={cm.flagged_terms} />
                      ) : (
                        <RenderMentions text={cm.body} />
                      )}
                    </p>
                    {cm.flagged_terms && cm.flagged_terms.length > 0 && (
                      <div
                        role="alert"
                        className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] leading-snug text-destructive"
                      >
                        <span aria-hidden className="mt-[1px]">⚠️</span>
                        <span>
                          <span className="font-semibold">
                            Moderação FitCrew · {cm.author?.display_name ?? "Usuário"}
                          </span>
                          {" — "}
                          detectamos linguagem inadequada nesta mensagem. Mantenha o
                          respeito na comunidade; termos ofensivos podem gerar
                          advertências.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>


      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const body = value.trim();
          if (!body) return;
          onAdd(body);
          setValue("");
        }}
      >
        <div className="flex-1">
          <MentionTextarea
            value={value}
            onChange={setValue}
            placeholder="Adicione um comentário… use @ para marcar alguém"
            rows={1}
            maxLength={500}
            className="min-h-[40px] resize-none rounded-2xl"
          />
        </div>
        <Button
          type="submit"
          size="icon"
          className="rounded-full shrink-0"
          disabled={!value.trim() || isPending}
        >
          <Send className="size-4" />
        </Button>
      </form>
      {confirmDialog}
    </motion.div>
  );
}

export function useCopyLink() {
  return (path: string) => {
    const url = typeof window !== "undefined" ? window.location.origin + path : path;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => toast.success("Link copiado!"),
        () => toast.error("Não foi possível copiar."),
      );
    }
  };
}
