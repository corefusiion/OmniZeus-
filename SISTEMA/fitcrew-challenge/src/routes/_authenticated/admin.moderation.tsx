import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Bot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";
import { approveAiItem, listAiQueue, rejectAiItem } from "@/lib/ai-moderation.functions";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.user.id);
    if (!roles?.some((r) => r.role === "super_admin")) throw redirect({ to: "/feed" });
  },
  component: ModerationPage,
});

function ModerationPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAiQueue);
  const approve = useServerFn(approveAiItem);
  const reject = useServerFn(rejectAiItem);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-mod-queue", "pending"],
    queryFn: () => list({ data: { status: "pending" as const } }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: () => {
      toast.success("Publicado");
      qc.invalidateQueries({ queryKey: ["ai-mod-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => reject({ data: { id } }),
    onSuccess: () => {
      toast.success("Rejeitado");
      qc.invalidateQueries({ queryKey: ["ai-mod-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Moderação IA"
        subtitle="Aprovar ou rejeitar posts e comentários gerados pela IA"
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <Bot className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-bold">Nada na fila</p>
          <p className="text-sm text-muted-foreground">Quando a IA gerar algo, aparece aqui.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it: any) => (
            <li key={it.id} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-primary">
                  {it.kind === "post" ? "Post" : "Comentário"}
                </span>
                <RelativeTime iso={it.created_at} />
                {it.metadata?.schedule_name && <span>· {it.metadata.schedule_name}</span>}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{it.body}</p>
              {it.media_url && (
                <img src={it.media_url} alt="" className="mt-3 max-h-64 w-full rounded-2xl object-cover" />
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => approveMut.mutate(it.id)}
                  disabled={approveMut.isPending}
                  className="rounded-full"
                >
                  <Check className="mr-1 size-4" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectMut.mutate(it.id)}
                  disabled={rejectMut.isPending}
                  className="rounded-full"
                >
                  <X className="mr-1 size-4" /> Rejeitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
