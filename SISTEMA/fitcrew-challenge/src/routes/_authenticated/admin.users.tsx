import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Pencil, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPlatformUsers, updatePlatformUser } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

type Row = {
  user_id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

function AdminUsersPage() {
  const listFn = useServerFn(listPlatformUsers);
  const updateFn = useServerFn(updatePlatformUser);
  const qc = useQueryClient();

  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedQ, page],
    queryFn: () => listFn({ data: { q: debouncedQ, page, pageSize } }),
  });

  const [editRow, setEditRow] = React.useState<Row | null>(null);

  const saveMut = useMutation({
    mutationFn: (payload: any) => updateFn({ data: payload }),
    onSuccess: () => {
      toast.success("Usuário atualizado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setEditRow(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar"),
  });

  async function exportCsv() {
    try {
      const all = await listFn({ data: { q: debouncedQ, all: true, page: 1, pageSize: 200 } });
      const rows: Row[] = all.items;
      const header = ["Nome", "Username", "E-mail", "Telefone", "Criado em"];
      const csv = [
        header.join(","),
        ...rows.map((r) =>
          [
            r.display_name ?? "",
            r.username ?? "",
            r.email ?? "",
            r.phone ?? "",
            r.created_at ?? "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao exportar");
    }
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items: Row[] = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Usuários da plataforma</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, @usuário, e-mail ou telefone"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">@username</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Telefone</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  </td>
                </tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="px-3 py-2">{r.display_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.username ? `@${r.username}` : "—"}
                  </td>
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2">{r.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditRow(r)}>
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} usuário(s) · Página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      {editRow && (
        <EditUserModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSave={(payload) => saveMut.mutate({ user_id: editRow.user_id, ...payload })}
          saving={saveMut.isPending}
        />
      )}
    </div>
  );
}

function EditUserModal({
  row,
  onClose,
  onSave,
  saving,
}: {
  row: Row;
  onClose: () => void;
  onSave: (payload: { display_name?: string; email?: string; phone?: string }) => void;
  saving: boolean;
}) {
  const [displayName, setDisplayName] = React.useState(row.display_name ?? "");
  const [email, setEmail] = React.useState(row.email ?? "");
  const [phone, setPhone] = React.useState(row.phone ?? "");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold">Editar usuário</h2>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">E-mail</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">
            Só atualiza o registro de contato; não altera o login do Supabase Auth.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Telefone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                display_name: displayName.trim() || undefined,
                email: email.trim(),
                phone: phone.trim(),
              })
            }
            disabled={saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
