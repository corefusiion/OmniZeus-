import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { followUser, getFollowStats, unfollowUser } from "@/lib/follows.functions";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  fullWidth?: boolean;
};

export function FollowButton({ userId, size = "default", className, fullWidth }: Props) {
  const qc = useQueryClient();
  const statsFn = useServerFn(getFollowStats);
  const followFn = useServerFn(followUser);
  const unfollowFn = useServerFn(unfollowUser);

  const { data, isLoading } = useQuery({
    queryKey: ["follow-stats", userId],
    queryFn: () => statsFn({ data: { userId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["follow-stats", userId] });
    qc.invalidateQueries({ queryKey: ["follow-stats"] }); // includes viewer's own stats card
  };

  const follow = useMutation({
    mutationFn: () => followFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Seguindo! 👥");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao seguir."),
  });
  const unfollow = useMutation({
    mutationFn: () => unfollowFn({ data: { userId } }),
    onSuccess: () => {
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao deixar de seguir."),
  });

  if (isLoading || !data) {
    return (
      <Button
        size={size}
        variant="outline"
        disabled
        className={cn("rounded-full", fullWidth && "w-full", className)}
      >
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }
  if (data.isMe) return null;

  const busy = follow.isPending || unfollow.isPending;
  const following = data.isFollowing;

  return (
    <Button
      size={size}
      variant={following ? "outline" : "default"}
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (following) unfollow.mutate();
        else follow.mutate();
      }}
      className={cn("rounded-full font-semibold", fullWidth && "w-full", className)}
    >
      {busy ? (
        <Loader2 className="mr-1.5 size-4 animate-spin" />
      ) : following ? (
        <UserCheck className="mr-1.5 size-4" />
      ) : (
        <UserPlus className="mr-1.5 size-4" />
      )}
      {following ? "Seguindo" : "Seguir"}
    </Button>
  );
}
