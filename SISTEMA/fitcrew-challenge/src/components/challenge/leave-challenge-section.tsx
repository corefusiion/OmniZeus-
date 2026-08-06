import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { LogOut, Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { leaveChallenge } from "@/lib/challenges.functions";

export function LeaveChallengeSection({
  challengeId,
  challengeName,
  isOwner,
  isSuperAdmin = false,
}: {
  challengeId: string;
  challengeName: string;
  isOwner: boolean;
  isSuperAdmin?: boolean;
}) {

  const qc = useQueryClient();
  const navigate = useNavigate();
  const leaveFn = useServerFn(leaveChallenge);
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: () => leaveFn({ data: { challengeId } }),
    onSuccess: () => {
      toast.success("Você saiu do desafio.");
      qc.invalidateQueries({ queryKey: ["my-challenges"] });
      qc.invalidateQueries({ queryKey: ["active-challenge"] });
      qc.invalidateQueries({ queryKey: ["challenge-hub", challengeId] });
      qc.invalidateQueries({ queryKey: ["challenge-members", challengeId] });
      setOpen(false);
      navigate({ to: "/challenges" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-destructive">
            <ShieldAlert className="size-5" /> Zona de perigo
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ao sair, seu histórico fica salvo mas você deixa o ranking ativo. Para voltar, será
            preciso um novo código de convite.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="rounded-full"
          onClick={() => setOpen(true)}
        >
          <LogOut className="size-4" /> Sair do Desafio
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={(v) => !mut.isPending && setOpen(v)}>
        <AlertDialogContent>
          {isOwner && !isSuperAdmin ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-destructive" /> Você é o Admin
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Você é o Admin deste desafio. Transfira a administração para outro membro antes
                  de sair.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Fechar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    if (typeof window !== "undefined") {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                    toast.info("Peça a um Super Admin para transferir a administração.");
                  }}
                >
                  Transferir Admin <ArrowRight className="ml-1 size-4" />
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair de "{challengeName}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  {isOwner && isSuperAdmin
                    ? "Como Super Admin, ao sair a administração será transferida automaticamente para o Co-Admin mais antigo do desafio. Seu histórico é preservado."
                    : `Tem certeza que deseja sair de "${challengeName}"? Seu histórico de check-ins e pontuação serão preservados, mas você sairá do ranking ativo.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={mut.isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={mut.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    mut.mutate();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {mut.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Confirmar Saída"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
