import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  Download,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  History,
  ExternalLink,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RelativeTime } from "@/components/relative-time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  listFlaggedComments,
  clearFlaggedComment,
  deleteFlaggedComment,
  listBannedWords,
  upsertBannedWord,
  deleteBannedWord,
  listUserWarnings,
} from "@/lib/trust-safety.functions";

export const Route = createFileRoute("/_authenticated/admin/warnings")({
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.user.id);
    if (!roles?.some((r) => r.role === "super_admin")) throw redirect({ to: "/feed" });
  },
  component: TrustSafetyPage,
});

function TrustSafetyPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Trust & Safety"
        subtitle="Revise comentários sinalizados, gerencie termos proibidos e acompanhe advertências."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link
          to="/admin"
          className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-muted"
        >
          ← Voltar ao admin
        </Link>
        <Link
          to="/admin/moderation"
          className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:bg-muted"
        >
          Moderação IA
        </Link>
      </div>
      <Tabs defaultValue="flagged" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="flagged" className="gap-2">
            <AlertTriangle className="size-4" /> Comentários sinalizados
          </TabsTrigger>
          <TabsTrigger value="words" className="gap-2">
            <Ban className="size-4" /> Termos proibidos
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" /> Histórico de advertências
          </TabsTrigger>
        </TabsList>
        <TabsContent value="flagged">
          <FlaggedTab />
        </TabsContent>
        <TabsContent value="words">
          <BannedWordsTab />
        </TabsContent>
        <TabsContent value="history">
          <WarningsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Flagged comments ---------- */

function FlaggedTab() {
  const qc = useQueryClient();
  const list = useServerFn(listFlaggedComments);
  const clearFn = useServerFn(clearFlaggedComment);
  const delFn = useServerFn(deleteFlaggedComment);

  const { data, isLoading } = useQuery({
    queryKey: ["ts-flagged"],
    queryFn: () => list({ data: { limit: 100 } }),
  });

  const clearMut = useMutation({
    mutationFn: (v: { id: string; source: "post_comment" | "checkin_comment" }) => clearFn({ data: v }),
    onSuccess: () => {
      toast.success("Sinalização removida.");
      qc.invalidateQueries({ queryKey: ["ts-flagged"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (v: { id: string; source: "post_comment" | "checkin_comment" }) => delFn({ data: v }),
    onSuccess: () => {
      toast.success("Comentário removido.");
      qc.invalidateQueries({ queryKey: ["ts-flagged"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const items = data ?? [];

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-display text-lg font-bold">Nada sinalizado</p>
        <p className="text-sm text-muted-foreground">
          A comunidade está de boa. Termos ofensivos aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((it: any) => (
        <li key={`${it.source}-${it.id}`} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <Avatar className="size-9">
              <AvatarImage src={it.profile?.avatar_url ?? undefined} />
              <AvatarFallback>{(it.profile?.display_name ?? "?").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {it.profile?.display_name ?? "Usuário"}
                </span>
                {it.profile?.username && <span>@{it.profile.username}</span>}
                <span>·</span>
                <RelativeTime iso={it.created_at} />
                <span className="rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide">
                  {it.source === "post_comment" ? "Post" : "Check-in"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{it.body}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {it.terms.map((t: string) => (
                  <Badge key={t} variant="destructive" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => clearMut.mutate({ id: it.id, source: it.source })}
                >
                  Marcar como resolvido
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => delMut.mutate({ id: it.id, source: it.source })}
                >
                  <Trash2 className="size-3.5" /> Excluir
                </Button>
                {it.source === "post_comment" && (
                  <Link
                    to="/feed"
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Ver post <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Banned words ---------- */

function BannedWordsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listBannedWords);
  const upsert = useServerFn(upsertBannedWord);
  const del = useServerFn(deleteBannedWord);

  const { data, isLoading } = useQuery({
    queryKey: ["ts-banned"],
    queryFn: () => list({}),
  });

  const [word, setWord] = useState("");
  const [severity, setSeverity] = useState(1);

  const addMut = useMutation({
    mutationFn: (v: { word: string; severity: number; active: boolean }) => upsert({ data: v }),
    onSuccess: () => {
      setWord("");
      toast.success("Termo salvo.");
      qc.invalidateQueries({ queryKey: ["ts-banned"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleMut = useMutation({
    mutationFn: (v: { word: string; severity: number; active: boolean }) => upsert({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ts-banned"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (w: string) => del({ data: { word: w } }),
    onSuccess: () => {
      toast.success("Termo removido.");
      qc.invalidateQueries({ queryKey: ["ts-banned"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <p className="mb-3 text-sm text-muted-foreground">
          Adicione palavras que devem ser sinalizadas nos comentários. A detecção ignora acentos e caixa.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Termo</label>
            <Input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="palavra ou expressão"
              maxLength={60}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Gravidade</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="block h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => {
              if (!word.trim()) return;
              addMut.mutate({ word: word.trim(), severity, active: true });
            }}
            disabled={addMut.isPending}
          >
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum termo cadastrado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Termo</th>
                <th className="px-4 py-2">Gravidade</th>
                <th className="px-4 py-2">Ativo</th>
                <th className="px-4 py-2">Criado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any) => (
                <tr key={row.word} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">{row.word}</td>
                  <td className="px-4 py-2">{row.severity}</td>
                  <td className="px-4 py-2">
                    <Switch
                      checked={row.active}
                      onCheckedChange={(v) =>
                        toggleMut.mutate({ word: row.word, severity: row.severity, active: v })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    <RelativeTime iso={row.created_at} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => delMut.mutate(row.word)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Warnings ---------- */

function WarningsTab() {
  const list = useServerFn(listUserWarnings);
  const { data, isLoading } = useQuery({
    queryKey: ["ts-warnings"],
    queryFn: () => list({ data: { limit: 300 } }),
  });

  const csv = useMemo(() => {
    if (!data?.rows?.length) return "";
    const header = "created_at,user_id,display_name,username,source_type,source_id,terms";
    const lines = data.rows.map((r: any) => {
      const name = (r.profile?.display_name ?? "").replace(/"/g, '""');
      const uname = r.profile?.username ?? "";
      const terms = (r.terms ?? []).join("|");
      return `"${r.created_at}","${r.user_id}","${name}","${uname}","${r.source_type}","${r.source_id}","${terms}"`;
    });
    return [header, ...lines].join("\n");
  }, [data]);

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `advertencias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const summary = data?.summary ?? [];
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} advertências registradas · {summary.length} usuários envolvidos
        </p>
        <Button onClick={downloadCsv} disabled={!rows.length} variant="outline" size="sm">
          <Download className="size-4" /> Baixar CSV
        </Button>
      </div>

      {!summary.length ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <History className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-bold">Sem advertências</p>
          <p className="text-sm text-muted-foreground">Nenhum usuário foi sinalizado até agora.</p>
        </div>
      ) : (
        <>
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Resumo por usuário</h3>
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Usuário</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2">Última</th>
                    <th className="px-4 py-2">Termos mais frequentes</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s: any) => {
                    const top = Object.entries(s.terms as Record<string, number>)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5);
                    return (
                      <tr key={s.user_id} className="border-t border-border align-top">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarImage src={s.profile?.avatar_url ?? undefined} />
                              <AvatarFallback>
                                {(s.profile?.display_name ?? "?").slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{s.profile?.display_name ?? "Usuário"}</div>
                              {s.profile?.username && (
                                <div className="text-xs text-muted-foreground">@{s.profile.username}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 font-semibold">{s.total}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          <RelativeTime iso={s.last_at} />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {top.map(([t, n]) => (
                              <Badge key={t} variant="secondary" className="text-[10px]">
                                {t} · {n}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Últimas ocorrências</h3>
            <ul className="space-y-2">
              {rows.slice(0, 50).map((r: any) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm"
                >
                  <Avatar className="size-7">
                    <AvatarImage src={r.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>{(r.profile?.display_name ?? "?").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{r.profile?.display_name ?? "Usuário"}</span>
                  <span className="text-xs text-muted-foreground">
                    <RelativeTime iso={r.created_at} />
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {r.source_type}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(r.terms ?? []).map((t: string) => (
                      <Badge key={t} variant="destructive" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
