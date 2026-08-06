import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageCircle,
  ChevronRight,
  Search,
  X,
  Minus,
  Inbox,
  Info,
  Copy,
  Plus,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getMyChallenges } from "@/lib/challenges.functions";
import { getChatSummaries, type ChatSummary } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

const LS_PREFIX = "fitcrew:chat-read:";

function useReadMap(challengeIds: string[]): Record<string, string> {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("fitcrew:chat-read", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("fitcrew:chat-read", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  return useMemo(() => {
    const out: Record<string, string> = {};
    if (typeof window === "undefined") return out;
    for (const id of challengeIds) {
      const v = window.localStorage.getItem(LS_PREFIX + id);
      if (v) out[id] = v;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeIds.join("|"), tick]);
}

function useDebounced<T>(value: T, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 220);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: session } = useQuery({
    queryKey: ["auth-user-id-launcher"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
    staleTime: 60_000,
  });

  const hidden =
    !session ||
    /^\/c\/[^/]+\/chat$/.test(pathname) ||
    pathname.startsWith("/chatfit") ||
    pathname.startsWith("/auth") ||
    pathname === "/";

  const fetchMine = useServerFn(getMyChallenges);
  const fetchSummaries = useServerFn(getChatSummaries);

  const { data: mine, isLoading: loadingMine } = useQuery({
    queryKey: ["my-challenges"],
    queryFn: () => fetchMine(),
    enabled: !hidden,
  });

  const { data: summaries } = useQuery<ChatSummary[]>({
    queryKey: ["chat-summaries"],
    queryFn: () => fetchSummaries(),
    enabled: !hidden,
    refetchInterval: open ? 15_000 : 60_000,
    staleTime: 10_000,
  });

  const challengeIds = useMemo(
    () => (mine ?? []).filter((r: any) => r.challenge).map((r: any) => r.challenge.id),
    [mine],
  );
  const readMap = useReadMap(challengeIds);

  const summaryMap = useMemo(() => {
    const m = new Map<string, ChatSummary>();
    (summaries ?? []).forEach((s) => m.set(s.challenge_id, s));
    return m;
  }, [summaries]);

  const rows = useMemo(() => {
    const list = (mine ?? []).filter((r: any) => r.challenge);
    const q = debouncedQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter((r: any) => (r.challenge.name ?? "").toLowerCase().includes(q))
      : list;
    return [...filtered].sort((a: any, b: any) => {
      const sa = summaryMap.get(a.challenge.id)?.last_message_at ?? null;
      const sb = summaryMap.get(b.challenge.id)?.last_message_at ?? null;
      // Active first
      if (a.challenge.is_active !== b.challenge.is_active) {
        return a.challenge.is_active ? -1 : 1;
      }
      // Then by most recent message
      if (sa && sb) return sa > sb ? -1 : sa < sb ? 1 : 0;
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      // Fallback alphabetical
      return (a.challenge.name ?? "").localeCompare(b.challenge.name ?? "");
    });
  }, [mine, debouncedQuery, summaryMap]);

  const totalUnread = useMemo(() => {
    let n = 0;
    for (const cid of challengeIds) {
      const s = summaryMap.get(cid);
      if (!s?.last_message_at) continue;
      const read = readMap[cid];
      if (!read || s.last_message_at > read) n += 1;
    }
    return n;
  }, [challengeIds, summaryMap, readMap]);

  if (hidden) return null;

  const isEmpty = !loadingMine && rows.length === 0 && !debouncedQuery.trim();

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={cn(
              "fixed z-50 inline-flex items-center justify-center gap-2 rounded-full border border-border",
              "bg-card/95 text-foreground shadow-lg backdrop-blur",
              "hover:bg-secondary hover:shadow-xl transition",
              "bottom-24 right-4 lg:bottom-6 lg:right-6",
              "size-12 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm sm:font-semibold",
            )}
            aria-label={`Abrir bate-papo${totalUnread ? `, ${totalUnread} não lidas` : ""}`}
          >
            <span className="relative grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
              <MessageCircle className="size-3.5" />
              {totalUnread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground ring-2 ring-card">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </span>
            <span className="hidden sm:inline">Bate-papo</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className={cn(
                "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
                // Desktop: docked bottom-right
                "lg:bottom-6 lg:right-6 lg:h-[30rem] lg:w-[23rem]",
                // Mobile: bottom sheet sitting above the bottom nav (h-16 + safe-area)
                "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 max-h-[75vh]",
              )}
              role="dialog"
              aria-label="Bate-papo"
            >
              <header className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <MessageCircle className="size-4 shrink-0 text-primary" />
                  <p className="truncate font-display text-sm font-bold">Bate-papo</p>
                  {totalUnread > 0 && (
                    <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                      {totalUnread} nova{totalUnread > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    aria-label="Fechar"
                  >
                    <X className="size-4 lg:hidden" />
                    <Minus className="hidden size-4 lg:block" />
                  </button>
                </div>
              </header>

              <div className="border-b border-border p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar desafio…"
                    className="h-9 w-full rounded-full border border-border bg-background pl-9 pr-8 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Limpar busca"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-1">
                {loadingMine && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Carregando conversas…
                  </p>
                )}

                {isEmpty && <EmptyState />}

                {!loadingMine && rows.length === 0 && debouncedQuery.trim() && (
                  <div className="px-4 py-8 text-center">
                    <Search className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Nada encontrado</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhum desafio com “{debouncedQuery}”.
                    </p>
                  </div>
                )}

                <ul className="space-y-0.5">
                  {rows.map((r: any) => {
                    const initials = (r.challenge.name ?? "?")
                      .split(" ")
                      .map((s: string) => s[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    const sum = summaryMap.get(r.challenge.id);
                    const read = readMap[r.challenge.id];
                    const unread = !!sum?.last_message_at && (!read || sum.last_message_at > read);
                    return (
                      <li key={r.challenge.id}>
                        <Link
                          to="/c/$id/chat"
                          params={{ id: r.challenge.id }}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-secondary",
                            unread && "bg-primary/5",
                          )}
                        >
                          <div className="relative shrink-0">
                            <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 font-display text-xs font-bold text-primary">
                              {initials || "?"}
                            </div>
                            {unread && (
                              <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-card" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "truncate text-sm",
                                unread ? "font-bold" : "font-semibold",
                              )}
                            >
                              {r.challenge.name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {sum?.last_body?.trim()
                                ? sum.last_body
                                : r.challenge.is_active
                                  ? "Ativo agora"
                                  : "Encerrado"}
                              {r.role === "owner" ? " · admin" : ""}
                            </p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary/10">
        <Inbox className="size-6 text-primary" />
      </div>
      <p className="text-sm font-semibold">Nenhuma conversa ainda</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Entre em um desafio para começar a bater papo com o grupo.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/challenges"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-flame transition hover:opacity-90"
        >
          <Plus className="size-3.5" />
          Ver desafios
        </Link>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
            >
              <Info className="size-3.5" />
              Como entrar
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Como entrar em um desafio</DialogTitle>
              <DialogDescription>
                Você pode participar de um grupo para conversar e competir.
              </DialogDescription>
            </DialogHeader>
            <ol className="mt-2 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <span>
                  <strong className="text-foreground">Peça o código</strong> do desafio ao ADM
                  do grupo (formato tipo <code className="rounded bg-muted px-1">ABCD1234</code>).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  2
                </span>
                <span>
                  Vá em <strong className="text-foreground">Meus desafios</strong> e use{" "}
                  <em>“Entrar por código”</em> — ou abra o link de convite que receberam.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  3
                </span>
                <span>
                  Quer criar o seu?{" "}
                  <Link to="/challenges/new" className="font-semibold text-primary underline">
                    Crie um desafio
                  </Link>{" "}
                  e vire o ADM da temporada.
                </span>
              </li>
              <li className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-xs">
                <Copy className="size-3.5 text-primary" />
                <span>
                  Dica: ADMs conseguem copiar código e link direto na lista de desafios.
                </span>
              </li>
            </ol>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
