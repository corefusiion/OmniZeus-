import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { RelativeTime } from "@/components/relative-time";
import { CommentThread, ReactionBar } from "@/components/feed/interactions";
import { ShareMenu } from "@/components/feed/share-menu";

import { ExpandableText } from "@/components/expandable-text";
import type { FeedPost } from "@/lib/timeline.queries";

export function PostCard({
  post,
  challenge,
  currentUserId,
  isAdmin,
  onReact,
  onComment,
  onDelete,
  onEdit,
  onEditComment,
  onDeleteComment,
  reactPending,
  commentPending,
  editPending,
}: {
  post: FeedPost;
  challenge?: { id: string; name: string } | null;
  currentUserId: string | null;
  isAdmin?: boolean;
  onReact: (emoji: string) => void;
  onComment: (body: string) => void;
  onDelete?: () => void;
  onEdit?: (body: string) => void;
  onEditComment?: (commentId: string, body: string) => void;
  onDeleteComment?: (commentId: string) => void;
  reactPending: boolean;
  commentPending: boolean;
  editPending?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const initials = (post.author?.display_name ?? "?").slice(0, 2).toUpperCase();
  const isMine = post.user_id === currentUserId;
  const canDelete = (isMine || isAdmin) && !!onDelete;
  const canEdit = (isMine || isAdmin) && !!onEdit;
  const isRoast = post.is_system && post.system_kind === "poke_roast";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={
        isRoast
          ? "overflow-hidden rounded-3xl border-2 border-orange-500/60 bg-gradient-to-br from-orange-500/10 via-card to-red-500/10 shadow-soft ring-1 ring-orange-500/30 transition hover:shadow-flame/20"
          : "overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition hover:shadow-flame/10"
      }
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
        <Link
          to="/profile/$userId"
          params={{ userId: post.user_id }}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar className="size-10 shrink-0 border border-border">
            <AvatarImage src={post.author?.avatar_url ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-display text-sm font-bold leading-tight">
              <span className="truncate">{post.author?.display_name ?? "Sem nome"}</span>
              {post.author?.is_bot && (
                <span
                  title="Perfil oficial FitBot"
                  className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary"
                >
                  🤖 FitBot
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {post.author?.username ? `@${post.author.username} · ` : ""}
              <RelativeTime iso={post.created_at} />
            </p>
          </div>
        </Link>
        {(canDelete || canEdit) && (
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary">
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => {
                    setDraft(post.body);
                    setEditing(true);
                  }}
                >
                  <Pencil className="mr-2 size-4" /> {isMine ? "Editar" : "Editar (admin)"}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="mr-2 size-4" /> {isMine ? "Apagar" : "Apagar (admin)"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {editing ? (
        <div className="space-y-2 px-4 pb-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            className="min-h-[96px] rounded-2xl"
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
              disabled={!draft.trim() || draft.trim() === post.body || editPending}
              onClick={() => {
                onEdit?.(draft.trim());
                setEditing(false);
              }}
            >
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <ExpandableText
            text={post.body}
            className="text-[15px] leading-relaxed text-foreground"
          />
        </div>
      )}

      {post.media_signed_url && (
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-secondary">
          <img
            src={post.media_signed_url}
            alt=""
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
          reactions={post.reactions}
          currentUserId={currentUserId}
          commentsCount={post.comments.length}
          onToggleComments={() => setShowComments((v) => !v)}
          onReact={(e) => onReact(e)}
          shareSlot={
            <ShareMenu
              path={`/feed#post-${post.id}`}
              text={post.body.slice(0, 140)}
              imageUrl={post.media_signed_url}
            />
          }
          isPending={reactPending}
        />
        {showComments && (
          <div className="px-2 pb-2">
            <CommentThread
              comments={post.comments}
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
