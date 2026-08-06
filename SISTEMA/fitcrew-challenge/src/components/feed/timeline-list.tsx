import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CheckinCard } from "@/components/feed/checkin-card";
import { PostCard } from "@/components/feed/post-card";
import {
  addComment,
  deleteCheckin,
  deleteCheckinComment,
  editCheckinCaption,
  editCheckinComment,
  toggleReaction,
} from "@/lib/checkins.functions";
import {
  addPostComment,
  deletePost,
  deletePostComment,
  editPost,
  editPostComment,
  togglePostReaction,
} from "@/lib/posts.functions";
import type { TimelineItem } from "@/lib/timeline.queries";

export function TimelineList({
  items,
  currentUserId,
  isAdmin,
  queryKey,
}: {
  items: TimelineItem[];
  currentUserId: string | null;
  isAdmin?: boolean;
  queryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const reactCheckinFn = useServerFn(toggleReaction);
  const commentCheckinFn = useServerFn(addComment);
  const reactPostFn = useServerFn(togglePostReaction);
  const commentPostFn = useServerFn(addPostComment);
  const deletePostFn = useServerFn(deletePost);
  const editPostFn = useServerFn(editPost);
  const editPostCommentFn = useServerFn(editPostComment);
  const deletePostCommentFn = useServerFn(deletePostComment);
  const deleteCheckinFn = useServerFn(deleteCheckin);
  const editCheckinCaptionFn = useServerFn(editCheckinCaption);
  const editCheckinCommentFn = useServerFn(editCheckinComment);
  const deleteCheckinCommentFn = useServerFn(deleteCheckinComment);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const reactCheckin = useMutation({
    mutationFn: (a: { checkinId: string; emoji: any }) => reactCheckinFn({ data: a }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const commentCheckin = useMutation({
    mutationFn: (a: { checkinId: string; body: string }) => commentCheckinFn({ data: a }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const reactPost = useMutation({
    mutationFn: (a: { postId: string; emoji: any }) => reactPostFn({ data: a }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const commentPost = useMutation({
    mutationFn: (a: { postId: string; body: string }) => commentPostFn({ data: a }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const removePost = useMutation({
    mutationFn: (id: string) => deletePostFn({ data: { id } }),
    onSuccess: () => { toast.success("Post apagado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updatePost = useMutation({
    mutationFn: (a: { id: string; body: string }) => editPostFn({ data: a }),
    onSuccess: () => { toast.success("Post atualizado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updatePostComment = useMutation({
    mutationFn: (a: { id: string; body: string }) => editPostCommentFn({ data: a }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const removePostComment = useMutation({
    mutationFn: (id: string) => deletePostCommentFn({ data: { id } }),
    onSuccess: () => { toast.success("Comentário apagado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeCheckin = useMutation({
    mutationFn: (id: string) => deleteCheckinFn({ data: { id } }),
    onSuccess: () => { toast.success("Check-in apagado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateCheckinCaption = useMutation({
    mutationFn: (a: { id: string; caption: string }) =>
      editCheckinCaptionFn({ data: { id: a.id, caption: a.caption || null } }),
    onSuccess: () => { toast.success("Legenda atualizada."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateCheckinComment = useMutation({
    mutationFn: (a: { id: string; body: string }) => editCheckinCommentFn({ data: a }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const removeCheckinComment = useMutation({
    mutationFn: (id: string) => deleteCheckinCommentFn({ data: { id } }),
    onSuccess: () => { toast.success("Comentário apagado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="space-y-5">
        <AnimatePresence initial={false}>
          {items.map((item, idx) =>
            item.kind === "checkin" ? (
              <motion.div
                key={`c-${item.data.id}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx, 5) * 0.04 } }}
                exit={{ opacity: 0, scale: 0.98 }}
                id={`checkin-${item.data.id}`}
              >
                <CheckinCard
                  checkin={item.data}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onReact={(emoji) => reactCheckin.mutate({ checkinId: item.data.id, emoji })}
                  onComment={(body) => commentCheckin.mutate({ checkinId: item.data.id, body })}
                  onDelete={
                    item.data.user_id === currentUserId || isAdmin
                      ? async () => {
                          const ok = await confirm({
                            title: "Apagar check-in?",
                            description:
                              "Tem certeza que deseja excluir este check-in? Você perderá os pontos associados e essa ação não poderá ser desfeita.",
                            confirmLabel: "Excluir check-in",
                          });
                          if (ok) removeCheckin.mutate(item.data.id);
                        }
                      : undefined
                  }
                  onEditCaption={
                    item.data.user_id === currentUserId || isAdmin
                      ? (caption) => updateCheckinCaption.mutate({ id: item.data.id, caption })
                      : undefined
                  }
                  onEditComment={(id, body) => updateCheckinComment.mutate({ id, body })}
                  onDeleteComment={(id) => removeCheckinComment.mutate(id)}
                  reactPending={reactCheckin.isPending}
                  commentPending={commentCheckin.isPending}
                  editPending={updateCheckinCaption.isPending}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`p-${item.data.id}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx, 5) * 0.04 } }}
                exit={{ opacity: 0, scale: 0.98 }}
                id={`post-${item.data.id}`}
              >
                <PostCard
                  post={item.data}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onReact={(emoji) => reactPost.mutate({ postId: item.data.id, emoji })}
                  onComment={(body) => commentPost.mutate({ postId: item.data.id, body })}
                  onDelete={
                    item.data.user_id === currentUserId || isAdmin
                      ? async () => {
                          const ok = await confirm({
                            title: "Apagar post?",
                            description:
                              "Tem certeza que deseja excluir este post? Comentários e reações serão removidos e essa ação não poderá ser desfeita.",
                            confirmLabel: "Excluir post",
                          });
                          if (ok) removePost.mutate(item.data.id);
                        }
                      : undefined
                  }
                  onEdit={
                    item.data.user_id === currentUserId || isAdmin
                      ? (body) => updatePost.mutate({ id: item.data.id, body })
                      : undefined
                  }
                  onEditComment={(id, body) => updatePostComment.mutate({ id, body })}
                  onDeleteComment={(id) => removePostComment.mutate(id)}
                  reactPending={reactPost.isPending}
                  commentPending={commentPost.isPending}
                  editPending={updatePost.isPending}
                />
              </motion.div>
            ),
          )}
        </AnimatePresence>
      </div>
      {dialog}
    </>
  );
}
