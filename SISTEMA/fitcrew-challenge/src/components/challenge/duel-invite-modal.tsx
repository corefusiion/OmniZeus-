import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createDuel } from "@/lib/duels.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  challengeId: string;
  opponent: {
    user_id: string;
    display_name: string;
    username?: string | null;
    avatar_url?: string | null;
  };
};

const STAKES = [1, 2, 3, 4, 5] as const;

export function DuelInviteModal({ open, onOpenChange, challengeId, opponent }: Props) {
  const [stake, setStake] = useState<number>(3);
  const qc = useQueryClient();
  const createFn = useServerFn(createDuel);

  const mutation = useMutation({
    mutationFn: () =>
      createFn({
        data: { challengeId, opponentId: opponent.user_id, stakePoints: stake },
      }),
    onSuccess: () => {
      toast.success("Desafio enviado ⏳", {
        description: `Apostou ${stake} ${stake === 1 ? "ponto" : "pontos"} contra ${opponent.display_name}.`,
      });
      qc.invalidateQueries({ queryKey: ["duels", challengeId] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const label = opponent.username ? `@${opponent.username}` : opponent.display_name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Swords className="size-5 text-primary" />
            Rivalidade 1v1
          </DialogTitle>
          <DialogDescription>
            Você quer desafiar <span className="font-semibold">{label}</span> para um 1v1 nesta
            semana?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
          <Avatar className="size-11">
            <AvatarImage src={opponent.avatar_url ?? undefined} />
            <AvatarFallback>{opponent.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold">{opponent.display_name}</p>
            {opponent.username && (
              <p className="truncate text-xs text-muted-foreground">@{opponent.username}</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Aposta desta semana
          </p>
          <div className="grid grid-cols-5 gap-2">
            {STAKES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStake(n)}
                className={`rounded-xl border py-3 font-display text-lg font-bold transition ${
                  stake === n
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {stake} {stake === 1 ? "ponto" : "pontos"} vão pra quem ganhar. Quem perder paga do
            saldo. Empate devolve.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Swords className="mr-2 size-4" />
                Desafiar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
