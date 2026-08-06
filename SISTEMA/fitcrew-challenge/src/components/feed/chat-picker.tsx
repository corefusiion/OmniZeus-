import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getMyChallenges } from "@/lib/challenges.functions";

export function ChatPicker() {
  const [open, setOpen] = useState(false);
  const fetchMine = useServerFn(getMyChallenges);
  const { data, isLoading } = useQuery({
    queryKey: ["my-challenges"],
    queryFn: () => fetchMine(),
    enabled: open,
  });

  const rows = (data ?? []).filter((r: any) => r.challenge);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft transition hover:bg-secondary"
        >
          <MessageCircle className="size-4 text-primary" />
          Bate-papo
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Escolha o desafio
        </p>
        {isLoading && (
          <p className="px-2 py-3 text-sm text-muted-foreground">Carregando…</p>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Você ainda não participa de nenhum desafio.
          </p>
        )}
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {rows.map((r: any) => (
            <Link
              key={r.challenge.id}
              to="/c/$id/chat"
              params={{ id: r.challenge.id }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm transition hover:bg-secondary"
            >
              <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {r.challenge.name}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
