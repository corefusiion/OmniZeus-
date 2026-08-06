import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { SectionHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingList } from "@/components/ui/loading-list";
import { QueryError } from "@/components/ui/query-error";
import { RelativeTime } from "@/components/relative-time";
import { listNotifications, markAllRead, markRead } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listNotifications);
  const markAll = useServerFn(markAllRead);
  const markOne = useServerFn(markRead);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => list({ data: {} as any }),
  });

  const readAll = useMutation({
    mutationFn: () => markAll({ data: {} as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const items = data?.items ?? [];
  const actors = data?.actors ?? {};

  return (
    <>

      <SectionHeader
        title="Notificações"
        subtitle={data?.unread ? `${data.unread} não lidas` : "Você está em dia"}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => readAll.mutate()}
            disabled={!data?.unread || readAll.isPending}
            className="rounded-full"
          >
            <Check className="mr-1 size-4" /> Marcar todas
          </Button>
        }
      />
      {isLoading ? (
        <LoadingList count={5} />
      ) : isError ? (
        <QueryError
          label="suas notificações"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sem notificações ainda"
          description="Quando alguém te mencionar, comentar ou reagir, você verá aqui."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {items.map((n: any) => {
            const actor = actors[n.actor_id];
            const unread = !n.read_at;
            const actorName = actor?.display_name ?? "Alguém";
            const title = typeof n.title === "string" ? n.title : "";
            const rest = actor?.display_name && title.startsWith(actor.display_name)
              ? title.slice(actor.display_name.length).trim()
              : title;
            const content = (
              <div className="flex items-start gap-3 p-4">
                <Avatar className="size-10 shrink-0 border border-border">
                  <AvatarImage src={actor?.avatar_url ?? undefined} />
                  <AvatarFallback>{actorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm break-words">
                    <span className="font-semibold">{actorName}</span>{" "}
                    {rest && <span className="text-muted-foreground">{rest}</span>}
                  </p>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground">
                      {n.body}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    <RelativeTime iso={n.created_at} />
                  </p>
                </div>
                {unread && <div className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
              </div>
            );
            return (
              <li key={n.id} className={`min-w-0 ${unread ? "bg-primary/5" : ""}`}>
                {n.link ? (
                  <a
                    href={n.link}
                    onClick={() => unread && markOne({ data: { id: n.id } }).then(() => qc.invalidateQueries({ queryKey: ["notifications"] }))}
                    className="block transition hover:bg-secondary/40"
                  >
                    {content}
                  </a>
                ) : (
                  content
                )}
              </li>
            );

          })}
        </ul>
      )}
    </>
  );
}
