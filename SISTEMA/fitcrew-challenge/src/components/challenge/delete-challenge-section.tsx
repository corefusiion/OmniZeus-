import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { deleteChallenge } from "@/lib/challenges.functions";

export function DeleteChallengeSection({
  challengeId,
  challengeName,
}: {
  challengeId: string;
  challengeName: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const deleteFn = useServerFn(deleteChallenge);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const mut = useMutation({
    mutationFn: () => deleteFn({ data: { challengeId } }),
    onSuccess: () => {
      toast.success("Desafio excluído com sucesso.");
      qc.invalidateQueries({ queryKey: ["my-challenges"] });
      qc.invalidateQueries({ queryKey: ["active-challenge"] });
      qc.invalidateQueries({ queryKey: ["challenge-hub", challengeId] });
      setOpen(false);
      navigate({ to: "/challenges" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canConfirm = confirmText.trim().toUpperCase() === "EXCLUIR";

  return (
    <section className="mt-6 rounded-2xl border-2 border-destructive/50 bg-destructive/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-destructive">
            <ShieldAlert className="size-5" /> Super Admin — Excluir Desafio
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Remove permanentemente o desafio, membros, check-ins, mensagens e todo o histórico. Esta
            ação é irreversível e visível apenas para Super Admins.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="rounded-full"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" /> Excluir Desafio
        </Button>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (mut.isPending) return;
          setOpen(v);
          if (!v) setConfirmText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" /> Excluir "{challengeName}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga todos os dados relacionados: membros, check-ins, mensagens,
              classificações e histórico. Não é possível desfazer. Digite <b>EXCLUIR</b> para
              confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Digite EXCLUIR"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mut.isPending || !canConfirm}
              onClick={(e) => {
                e.preventDefault();
                if (!canConfirm) return;
                mut.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Excluir permanentemente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
