import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BannerPickerModal } from "@/components/challenge/banner-picker-modal";
import { createChallenge } from "@/lib/challenges.functions";

export const Route = createFileRoute("/_authenticated/challenges/new")({
  component: NewChallengePage,
});

function NewChallengePage() {
  const createFn = useServerFn(createChallenge);
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const inThreeMonths = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startsAt: today,
    endsAt: inThreeMonths,
    maxDaysPerWeek: 5,
    streakBonusPoints: 2,
    entryFee: 50,
    isPublic: false,
    city: "",
  });
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader title="Criar desafio" subtitle="Você vira o ADM e recebe um link para convidar a galera." />
      <form
        className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            const res = await createFn({
              data: {
                name: form.name,
                description: form.description || null,
                startsAt: form.startsAt,
                endsAt: form.endsAt,
                maxDaysPerWeek: Number(form.maxDaysPerWeek),
                streakBonusPoints: Number(form.streakBonusPoints),
                entryFee: Number(form.entryFee),
                isPublic: form.isPublic,
                city: form.city.trim() || null,
              },
            });
            toast.success(`Desafio criado! Código: ${res.inviteCode}`);
            setCreatedId(res.id);
          } catch (err: any) {
            toast.error("Falha ao criar", { description: err.message });
          } finally {
            setSaving(false);
          }
        }}
      >
        <div>
          <Label>Nome</Label>
          <Input
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Verão em forma 2026"
          />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Regra da casa, brincadeiras, o que quiser."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Início</Label>
            <Input
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </div>
          <div>
            <Label>Máx. dias por semana</Label>
            <Input
              type="number"
              min={1}
              max={7}
              value={form.maxDaysPerWeek}
              onChange={(e) => setForm({ ...form, maxDaysPerWeek: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Bônus streak (pts)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={form.streakBonusPoints}
              onChange={(e) => setForm({ ...form, streakBonusPoints: Number(e.target.value) })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Valor de entrada (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.entryFee}
              onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })}
            />
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-border bg-background/60 p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                className="mt-1 size-4 rounded border-border accent-primary"
              />
              <div>
                <p className="text-sm font-semibold">Deixar público (aparece em Explorar)</p>
                <p className="text-xs text-muted-foreground">
                  Qualquer pessoa poderá ver este desafio e entrar pelo link de convite.
                </p>
              </div>
            </label>
            {form.isPublic && (
              <div>
                <Label>Cidade (opcional)</Label>
                <Input
                  maxLength={80}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Ex.: São Paulo"
                />
              </div>
            )}
          </div>
        </div>
        <Button type="submit" disabled={saving} className="rounded-full shadow-flame">
          {saving ? "Criando…" : "Criar desafio"}
        </Button>
      </form>

      {createdId && (
        <BannerPickerModal
          challengeId={createdId}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              const id = createdId;
              setCreatedId(null);
              navigate({ to: "/c/$id", params: { id } });
            }
          }}
        />
      )}
    </div>
  );
}
