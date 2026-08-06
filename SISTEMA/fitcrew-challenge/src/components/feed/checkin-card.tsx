import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flag, MapPin, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RelativeTime } from "@/components/relative-time";
import { CommentThread, ReactionBar } from "@/components/feed/interactions";
import { ShareMenu } from "@/components/feed/share-menu";
import { ChallengeChip } from "@/components/feed/challenge-chip";
import { ExpandableText } from "@/components/expandable-text";
import { reportCheckin } from "@/lib/checkin-reports.functions";
import type { FeedCheckin } from "@/lib/checkins.queries";

export function CheckinCard({
  checkin: c,
  challenge,
  currentUserId,
  isAdmin,
  onReact,
  onComment,
  onDelete,
  onEditCaption,
  onEditComment,
  onDeleteComment,
  reactPending,
  commentPending,
  editPending,
}: {
  checkin: FeedCheckin;
  challenge?: { id: string; name: string } | null;
  currentUserId: string | null;
  isAdmin?: boolean;
  onReact: (emoji: string) => void;
  onComment: (body: string) => void;
  onDelete?: () => void;
  onEditCaption?: (caption: string) => void;
  onEditComment?: (commentId: string, body: string) => void;
  onDeleteComment?: (commentId: string) => void;
  reactPending: boolean;
  commentPending: boolean;
  editPending?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.caption ?? "");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const initials = (c.author?.display_name ?? "?").slice(0, 2).toUpperCase();
  const isMine = c.user_id === currentUserId;
  const canDelete = (isMine || isAdmin) && !!onDelete;
  const canEdit = (isMine || isAdmin) && !!onEditCaption;
  const canReport = !isMine && !!currentUserId;

  const reportFn = useServerFn(reportCheckin);
  const reportMut = useMutation({
    mutationFn: (reason: string) => reportFn({ data: { checkinId: c.id, reason } }),
    onSuccess: () => {
      toast.success("Denúncia enviada — admin vai revisar.");
      setReportOpen(false);
      setReportReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition hover:shadow-flame/10"
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4">
        <Link
          to="/profile/$userId"
          params={{ userId: c.user_id }}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar className="size-10 shrink-0 border border-border">
            <AvatarImage src={c.author?.avatar_url ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold leading-tight">
              {c.author?.display_name ?? "Sem nome"}
              {c.author?.username && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  @{c.author.username}
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {c.exercise?.icon} {c.exercise?.name} · {c.duration_min}min · <RelativeTime iso={c.created_at} />
            </p>
          </div>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {c.ai_validated === "needs_review" && (
            <Badge variant="outline" className="rounded-full border-amber-500/40 bg-amber-500/10 text-[10px] font-semibold text-amber-600">
              ⏳ Pendente revisão
            </Badge>
          )}
          {c.ai_validated === "rejected" && (
            <Badge variant="outline" className="rounded-full border-destructive/40 bg-destructive/10 text-[10px] font-semibold text-destructive">
              ✕ Reprovado
            </Badge>
          )}
          {c.ai_validated === "approved" && (
            <Badge variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600">
              ✓ Aprovado
            </Badge>
          )}
          {c.over_limit ? (
            <Badge variant="secondary" className="rounded-full">Extra · 0 pts</Badge>
          ) : c.ai_validated === "rejected" ? (
            <Badge variant="secondary" className="rounded-full">0 pts</Badge>
          ) : (
            <Badge className="rounded-full bg-primary text-primary-foreground shadow-flame">
              +{c.points_awarded} pts
            </Badge>
          )}
        </div>
        {(canDelete || canEdit || canReport) && (
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary">
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => {
                    setDraft(c.caption ?? "");
                    setEditing(true);
                  }}
                >
                  <Pencil className="mr-2 size-4" /> {isMine ? "Editar legenda" : "Editar (admin)"}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="mr-2 size-4" /> {isMine ? "Apagar" : "Apagar (admin)"}
                </DropdownMenuItem>
              )}
              {canReport && (canEdit || canDelete) && <DropdownMenuSeparator />}
              {canReport && (
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-amber-600">
                  <Flag className="mr-2 size-4" /> Denunciar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar check-in</DialogTitle>
            <DialogDescription>
              Achou que essa foto é falsa, repetida ou não é treino? O admin do desafio vai revisar.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Ex: foto tirada da internet, print de tela, mesma foto do dia anterior…"
            className="min-h-[100px]"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)} disabled={reportMut.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => reportMut.mutate(reportReason.trim())}
              disabled={reportMut.isPending || reportReason.trim().length < 3}
            >
              <Flag className="mr-2 size-4" /> Enviar denúncia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing ? (
        <div className="space-y-2 px-4 pb-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="Adicione uma legenda…"
            className="min-h-[72px] rounded-2xl"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => setEditing(false)}
              disabled={editPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              disabled={editPending || draft.trim() === (c.caption ?? "").trim()}
              onClick={() => {
                onEditCaption?.(draft.trim());
                setEditing(false);
              }}
            >
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        (challenge || (c.challenges && c.challenges.length > 0) || c.caption || c.location_name) && (
          <div className="px-4 pb-3">
            {c.location_name && (
              <div className="mb-2">
                {c.location_lat != null && c.location_lng != null ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${c.location_lat},${c.location_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={c.location_address ?? undefined}
                    className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground transition hover:text-primary"
                  >
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{c.location_name}</span>
                  </a>
                ) : (
                  <span
                    title={c.location_address ?? undefined}
                    className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground"
                  >
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{c.location_name}</span>
                  </span>
                )}
              </div>
            )}
            {(() => {
              const chips = (c.challenges && c.challenges.length > 0)
                ? c.challenges
                : (challenge ? [challenge] : []);
              return chips.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {chips.map((ch) => (
                    <ChallengeChip key={ch.id} challengeId={ch.id} name={ch.name} />
                  ))}
                </div>
              ) : null;
            })()}
            {c.used_daily_pose && (
              <div className="mb-2">
                <Badge className="rounded-full border border-primary/30 bg-primary/10 text-[10px] font-semibold text-primary">
                  🎯 Cumpriu a Pose do Dia
                </Badge>
              </div>
            )}
            {c.caption && (
              <ExpandableText
                text={c.caption}
                className="text-sm leading-relaxed text-foreground"
              />
            )}
          </div>
        )
      )}

      {c.photo_signed_url && (
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-secondary">
          <img
            src={c.photo_signed_url}
            alt="Treino"
            loading="lazy"
            decoding="async"
            width={800}
            height={800}
            className="h-auto max-h-[28rem] w-full bg-secondary object-cover"
            style={{ aspectRatio: "1 / 1" }}
            onLoad={(e) => {
              e.currentTarget.style.aspectRatio = "auto";
            }}
          />
        </div>
      )}

      <div className="border-t border-border p-2">
        <ReactionBar
          reactions={c.reactions}
          currentUserId={currentUserId}
          commentsCount={c.comments.length}
          onToggleComments={() => setShowComments((v) => !v)}
          onReact={(e) => onReact(e)}
          shareSlot={
            <ShareMenu
              path={`/feed#checkin-${c.id}`}
              text={`${c.exercise?.icon ?? "💪"} ${c.exercise?.name ?? "Treino"} · ${c.duration_min}min${c.caption ? " — " + c.caption : ""}`}
              imageUrl={c.photo_signed_url}
            />
          }
          isPending={reactPending}
        />
        {showComments && (
          <div className="px-2 pb-2">
            <CommentThread
              comments={c.comments}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onAdd={onComment}
              onEdit={onEditComment}
              onDelete={onDeleteComment}
              isPending={commentPending}
            />
          </div>
        )}
      </div>
    </motion.article>
  );
}
