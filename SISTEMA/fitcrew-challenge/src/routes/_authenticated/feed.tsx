import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, Trophy, Compass, KeyRound, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Composer } from "@/components/feed/composer";
import { SectionErrorBoundary } from "@/components/section-error-boundary";

import { CheckinCard } from "@/components/feed/checkin-card";
import { PostCard } from "@/components/feed/post-card";
import { fetchActiveChallenge } from "@/lib/checkins.queries";
import { fetchTimeline } from "@/lib/timeline.queries";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function FeedPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();


  const { data: challenge } = useQuery({
    queryKey: ["active-challenge"],
    queryFn: fetchActiveChallenge,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const { data: me } = useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return { userId: null as string | null, isAdmin: false };
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      return {
        userId: userData.user.id,
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      };
    },
  });

  const {
    data: timelinePages,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["timeline", challenge?.id],
    enabled: !!challenge?.id,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchTimeline(challenge!.id, { before: pageParam }),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  const timeline = useMemo(
    () => (timelinePages?.pages ?? []).flatMap((p) => p.items),
    [timelinePages],
  );

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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["timeline"] });

  const reactCheckin = useMutation({
    mutationFn: (args: { checkinId: string; emoji: any }) => reactCheckinFn({ data: args }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const commentCheckin = useMutation({
    mutationFn: (args: { checkinId: string; body: string }) => commentCheckinFn({ data: args }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const reactPost = useMutation({
    mutationFn: (args: { postId: string; emoji: any }) => reactPostFn({ data: args }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const commentPost = useMutation({
    mutationFn: (args: { postId: string; body: string }) => commentPostFn({ data: args }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const removePost = useMutation({
    mutationFn: (id: string) => deletePostFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Post apagado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updatePost = useMutation({
    mutationFn: (args: { id: string; body: string }) => editPostFn({ data: args }),
    onSuccess: () => {
      toast.success("Post atualizado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updatePostComment = useMutation({
    mutationFn: (args: { id: string; body: string }) => editPostCommentFn({ data: args }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const removePostComment = useMutation({
    mutationFn: (id: string) => deletePostCommentFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Comentário apagado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeCheckin = useMutation({
    mutationFn: (id: string) => deleteCheckinFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Check-in apagado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateCheckinCaption = useMutation({
    mutationFn: (args: { id: string; caption: string }) =>
      editCheckinCaptionFn({ data: { id: args.id, caption: args.caption || null } }),
    onSuccess: () => {
      toast.success("Legenda atualizada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateCheckinComment = useMutation({
    mutationFn: (args: { id: string; body: string }) => editCheckinCommentFn({ data: args }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const removeCheckinComment = useMutation({
    mutationFn: (id: string) => deleteCheckinCommentFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Comentário apagado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Seu feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimos check-ins e posts das suas crews.
        </p>
      </div>

      {!challenge ? (
        <WelcomeNoChallenge />
      ) : (
        <>
          <Composer />

          {isLoading && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && (!timeline || timeline.length === 0) && (
            <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
              <Trophy className="mx-auto size-8 text-primary" />
              <h2 className="mt-4 font-display text-xl font-bold">Feed vazio</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Compartilhe o primeiro momento da crew — bata um ponto ou solte um post.
              </p>
              <Button asChild className="mt-4 rounded-full shadow-flame">
                <Link to="/checkin">
                  <Plus className="mr-1 size-4" /> Fazer check-in
                </Link>
              </Button>
            </div>
          )}
        </>
      )}


      {challenge && (
      <div className="space-y-5">
        <AnimatePresence initial={false}>
          {timeline?.map((item, idx) => (
            <SectionErrorBoundary
              key={item.kind === "checkin" ? `c-${item.data.id}` : `p-${item.data.id}`}
              boundary={`feed_item_${item.kind}`}
              label="este item"
            >
            {item.kind === "checkin" ? (
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
                  challenge={challenge ? { id: challenge.id, name: challenge.name } : null}
                  currentUserId={me?.userId ?? null}
                  isAdmin={me?.isAdmin ?? false}
                  onReact={(emoji) =>
                    reactCheckin.mutate({ checkinId: item.data.id, emoji })
                  }
                  onComment={(body) =>
                    commentCheckin.mutate({ checkinId: item.data.id, body })
                  }
                  onDelete={
                    item.data.user_id === me?.userId || me?.isAdmin
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
                    item.data.user_id === me?.userId || me?.isAdmin
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
                  challenge={challenge ? { id: challenge.id, name: challenge.name } : null}
                  currentUserId={me?.userId ?? null}
                  isAdmin={me?.isAdmin ?? false}
                  onReact={(emoji) => reactPost.mutate({ postId: item.data.id, emoji })}
                  onComment={(body) => commentPost.mutate({ postId: item.data.id, body })}
                  onDelete={
                    item.data.user_id === me?.userId || me?.isAdmin
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
                    item.data.user_id === me?.userId || me?.isAdmin
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
            )}
            </SectionErrorBoundary>
          ))}
        </AnimatePresence>
      </div>
      )}


      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            className="rounded-full"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
              </>
            ) : (
              "Carregar mais"
            )}
          </Button>
        </div>
      )}
      {confirmDialog}
    </>
  );
}

function WelcomeNoChallenge() {
  return (
    <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-8 shadow-soft">
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/20 text-3xl">
          👋
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Bem-vindo ao FitCrew!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Para começar, entre em um desafio. É onde a mágica acontece: check-ins, ranking, treinos e a galera treinando junto.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Button asChild className="rounded-full shadow-flame">
          <Link to="/explore">
            <Compass className="mr-1.5 size-4" /> Explorar Desafios
          </Link>
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            const code = window.prompt("Cole o código de convite do desafio:");
            if (code && code.trim()) {
              window.location.href = `/join/${code.trim().toUpperCase()}`;
            }
          }}
        >
          <KeyRound className="mr-1.5 size-4" /> Entrar com Código
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/challenges/new">
            <Flag className="mr-1.5 size-4" /> Criar meu Desafio
          </Link>
        </Button>
      </div>
    </div>
  );
}
