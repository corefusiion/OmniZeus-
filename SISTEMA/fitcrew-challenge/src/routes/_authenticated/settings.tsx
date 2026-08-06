import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AtSign, Ban, Bell, Camera, Check, Crown, Instagram, Loader2, ShieldAlert, Trash2, Twitter, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionHeader } from "@/components/app-shell";
import { checkUsernameAvailability, setUsername } from "@/lib/username.functions";
import { recordBodyMetrics } from "@/lib/metrics.functions";
import {
  blockUser,
  getSettingsExtras,
  saveNotificationPrefs,
  saveSocialLinks,
  searchUsersForBlock,
  unblockUser,
  type NotificationPrefs,
} from "@/lib/settings.functions";
import { getPlatformOverview } from "@/lib/platform-admin.functions";
import { transferChallengeOwnership } from "@/lib/challenges.functions";
import { getAffiliateSummary, requestWithdraw } from "@/lib/affiliate.functions";
import { Link } from "@tanstack/react-router";




export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Nome muito curto").max(60),
  bio: z.string().trim().max(280, "Máximo 280 caracteres").optional(),
  weekly_goal: z.number().int().min(1).max(7),
  avatar_url: z.string().url().max(2000).optional().or(z.literal("")),
  weight_kg: z.number().min(20).max(300).nullable(),
  height_cm: z.number().int().min(80).max(250).nullable(),
  sex: z.enum(["M", "F"]).nullable(),
  location: z.string().trim().max(80).optional(),
  favorite_sport: z.string().trim().max(60).optional(),
});


function SettingsPage() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["settings-profile"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Sem usuário");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, weekly_goal, weight_kg, height_cm, sex, location, favorite_sport")
        .eq("id", user.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    weekly_goal: 3,
    avatar_url: "",
    weight_kg: "" as string,
    height_cm: "" as string,
    sex: "" as "" | "M" | "F",
    location: "",
    favorite_sport: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm((prev) => ({
        ...prev,
        display_name: profile.display_name ?? "",
        bio: profile.bio ?? "",
        weekly_goal: profile.weekly_goal ?? 3,
        avatar_url: profile.avatar_url ?? "",
        weight_kg: profile.weight_kg != null ? String(profile.weight_kg) : "",
        height_cm: profile.height_cm != null ? String(profile.height_cm) : "",
        sex: (profile as any).sex ?? "",
        location: profile.location ?? "",
        favorite_sport: profile.favorite_sport ?? "",
      }));
    }
  }, [profile]);


  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <>
      <SectionHeader title="Configurações" subtitle="Ajuste seu perfil e preferências." />

      <PlatformAdminPanel />

      <UsernameCard currentUsername={profile?.username ?? null} />



      <form
        className="max-w-2xl space-y-6 rounded-3xl border border-border bg-card p-6 shadow-soft"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = profileSchema.safeParse({
            display_name: form.display_name,
            bio: form.bio || undefined,
            weekly_goal: Number(form.weekly_goal),
            avatar_url: form.avatar_url || "",
            weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
            height_cm: form.height_cm ? Number(form.height_cm) : null,
            sex: form.sex === "M" || form.sex === "F" ? form.sex : null,
            location: form.location || undefined,
            favorite_sport: form.favorite_sport || undefined,
          });
          if (!parsed.success) {
            toast.error(parsed.error.issues[0].message);
            return;
          }
          setSaving(true);
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) return;
          const weightChanged =
            parsed.data.weight_kg != null &&
            parsed.data.weight_kg !== (profile?.weight_kg ?? null);

          const { error } = await supabase
            .from("profiles")
            .update({
              display_name: parsed.data.display_name,
              bio: parsed.data.bio ?? null,
              weekly_goal: parsed.data.weekly_goal,
              avatar_url: parsed.data.avatar_url || null,
              weight_kg: parsed.data.weight_kg,
              height_cm: parsed.data.height_cm,
              sex: parsed.data.sex,
              location: parsed.data.location ?? null,
              favorite_sport: parsed.data.favorite_sport ?? null,
            })
            .eq("id", user.user.id);
          if (error) {
            setSaving(false);
            return toast.error("Não foi possível salvar", { description: error.message });
          }

          // Peso alterado → registra histórico e publica automaticamente o post de evolução
          if (weightChanged && parsed.data.weight_kg != null) {
            try {
              const res = await recordBodyMetrics({
                data: {
                  weight_kg: parsed.data.weight_kg,
                  height_cm: parsed.data.height_cm ?? undefined,
                  sex: parsed.data.sex,
                },
              });
              if (res.postId) {
                toast.success("Evolução compartilhada no feed! 🔥");
              }
            } catch (err) {
              console.error("[metrics] recordBodyMetrics falhou", err);
            }
          }

          setSaving(false);
          toast.success("Perfil salvo!");
          qc.invalidateQueries({ queryKey: ["me"] });
          qc.invalidateQueries({ queryKey: ["settings-profile"] });
          qc.invalidateQueries({ queryKey: ["profile-stats"] });
          qc.invalidateQueries({ queryKey: ["timeline"] });
        }}
      >


        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="display_name">Nome</Label>
            <Input
              id="display_name"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Foto de perfil</Label>
            <AvatarUploader
              value={form.avatar_url}
              displayName={form.display_name}
              onChange={(url) => setForm((f) => ({ ...f, avatar_url: url }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={3}
              maxLength={280}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Um resumo curto sobre você…"
            />
          </div>

          <div>
            <Label htmlFor="weight_kg">Peso (kg)</Label>
            <Input
              id="weight_kg"
              type="number"
              step="0.1"
              min={20}
              max={300}
              value={form.weight_kg}
              onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
              placeholder="ex.: 72.5"
            />
          </div>
          <div>
            <Label htmlFor="height_cm">Altura (cm)</Label>
            <Input
              id="height_cm"
              type="number"
              min={80}
              max={250}
              value={form.height_cm}
              onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
              placeholder="ex.: 178"
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="mb-2 block">Sexo (para cálculo do metabolismo basal)</Label>
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              {(["M", "F"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm({ ...form, sex: opt })}
                  className={`rounded-2xl border-2 px-4 py-2.5 text-sm font-medium transition ${
                    form.sex === opt
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {opt === "M" ? "Masculino" : "Feminino"}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <span className="mt-0.5 text-primary">✨</span>
            <span>
              Sempre que você atualizar seu peso, a IA publica automaticamente um post elegante no feed com IMC, metabolismo basal e sua variação — para a crew acompanhar sua evolução.
            </span>
          </div>




          <div>
            <Label htmlFor="location">Localização</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="São Paulo, SP"
            />
          </div>
          <div>
            <Label htmlFor="favorite_sport">Esporte favorito</Label>
            <Input
              id="favorite_sport"
              value={form.favorite_sport}
              onChange={(e) => setForm({ ...form, favorite_sport: e.target.value })}
              placeholder="Musculação, corrida, jiu-jitsu…"
            />
          </div>

          <div>
            <Label htmlFor="weekly_goal">Meta semanal (treinos)</Label>
            <Input
              id="weekly_goal"
              type="number"
              min={1}
              max={7}
              value={form.weekly_goal}
              onChange={(e) => setForm({ ...form, weekly_goal: Number(e.target.value) })}
            />
          </div>
        </div>

        <Button type="submit" className="rounded-full shadow-flame" disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </form>

      <SocialLinksCard />
      <AffiliateWalletCard />
      <NotificationPrefsCard />
      <BlockedAccountsCard />
    </>
  );
}

function AvatarUploader({
  value,
  displayName,
  onChange,
}: {
  value: string;
  displayName: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const initials = (displayName || "?").slice(0, 2).toUpperCase();

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB).");
      return;
    }
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sessão expirada.");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // Bucket is private — generate a long-lived signed URL (1 year).
      const { data: signed, error: sErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Falha ao gerar URL.");
      onChange(signed.signedUrl);
      toast.success("Foto carregada! Clique em Salvar para confirmar.");
    } catch (err) {
      toast.error("Não foi possível enviar a foto", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mt-2 flex items-center gap-4">
      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        className="group relative grid size-20 place-items-center overflow-hidden rounded-full border-2 border-border bg-secondary shadow-soft transition hover:border-primary/60"
        aria-label="Trocar foto de perfil"
      >
        {value ? (
          <img src={value} alt="Avatar" className="size-full object-cover" />
        ) : (
          <span className="font-display text-2xl font-bold text-muted-foreground">{initials}</span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          {busy ? (
            <Loader2 className="size-6 animate-spin text-white" />
          ) : (
            <Camera className="size-6 text-white" />
          )}
        </span>
      </button>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handlePick} disabled={busy} className="rounded-full">
            {busy ? "Enviando…" : value ? "Trocar foto" : "Enviar foto"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disabled={busy}
              className="rounded-full text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" /> Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP até 5MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}

function UsernameCard({ currentUsername }: { currentUsername: string | null }) {
  const qc = useQueryClient();
  const setFn = useServerFn(setUsername);
  const checkFn = useServerFn(checkUsernameAvailability);
  const [value, setValue] = useState(currentUsername ?? "");
  const [debounced, setDebounced] = useState(value);

  useEffect(() => setValue(currentUsername ?? ""), [currentUsername]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 350);
    return () => clearTimeout(t);
  }, [value]);

  const isSame = debounced === (currentUsername ?? "");
  const check = useQuery({
    queryKey: ["username-check", debounced],
    enabled: !isSame && debounced.length >= 3,
    queryFn: () => checkFn({ data: { username: debounced } }),
  });

  const save = useMutation({
    mutationFn: (u: string) => setFn({ data: { username: u } }),
    onSuccess: async () => {
      toast.success("Username atualizado!");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["me"] }),
        qc.invalidateQueries({ queryKey: ["settings-profile"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const state = useMemo(() => {
    if (isSame) return { icon: null as any, msg: "Este é o seu username atual." };
    if (value.length < 3) return { icon: null, msg: "3 a 20 caracteres." };
    if (!/^[a-z0-9_]+$/.test(value))
      return { icon: <X className="size-4 text-destructive" />, msg: "Apenas letras minúsculas, números e _." };
    if (check.isFetching) return { icon: <Loader2 className="size-4 animate-spin" />, msg: "Verificando…" };
    if (check.data?.available) return { icon: <Check className="size-4 text-primary" />, msg: "Disponível!" };
    if (check.data && !check.data.available)
      return { icon: <X className="size-4 text-destructive" />, msg: check.data.reason ?? "Indisponível." };
    return { icon: null, msg: "" };
  }, [value, check.data, check.isFetching, isSame]);

  return (
    <div className="mb-6 max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold">@ Username</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Identificador único no FitCrew. Só pode ser trocado 1x a cada 30 dias.
      </p>
      <div className="relative mt-4">
        <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) =>
            setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))
          }
          className="pl-9 font-mono lowercase"
          maxLength={20}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{state.icon}</div>
      </div>
      <p className={`mt-2 text-xs ${check.data && !check.data.available ? "text-destructive" : "text-muted-foreground"}`}>
        {state.msg}
      </p>
      <Button
        type="button"
        onClick={() => save.mutate(value)}
        disabled={isSame || !check.data?.available || save.isPending}
        className="mt-4 rounded-full"
        variant="secondary"
      >
        {save.isPending ? "Salvando…" : "Trocar username"}
      </Button>
    </div>
  );
}

function useSettingsExtras() {
  const fn = useServerFn(getSettingsExtras);
  return useQuery({
    queryKey: ["settings-extras"],
    queryFn: () => fn(),
  });
}

function Card({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="mt-6 max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SocialLinksCard() {
  const qc = useQueryClient();
  const { data } = useSettingsExtras();
  const saveFn = useServerFn(saveSocialLinks);
  const [ig, setIg] = useState("");
  const [tt, setTt] = useState("");
  const [tw, setTw] = useState("");

  useEffect(() => {
    if (!data) return;
    setIg(data.instagram_handle ?? "");
    setTt(data.tiktok_handle ?? "");
    setTw(data.twitter_handle ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          instagram_handle: ig || undefined,
          tiktok_handle: tt || undefined,
          twitter_handle: tw || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Redes sociais atualizadas!");
      qc.invalidateQueries({ queryKey: ["settings-extras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clean = (v: string) => v.replace(/^@+/, "").replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 50);

  return (
    <Card title="Links sociais" subtitle="Aparecem no seu perfil público." icon={Instagram}>
      <div className="space-y-3">
        <HandleInput
          icon={<Instagram className="size-4" />}
          label="Instagram"
          value={ig}
          onChange={(v) => setIg(clean(v))}
          preview={ig ? `https://instagram.com/${ig}` : null}
        />
        <HandleInput
          icon={<span className="text-sm font-bold">TT</span>}
          label="TikTok"
          value={tt}
          onChange={(v) => setTt(clean(v))}
          preview={tt ? `https://tiktok.com/@${tt}` : null}
        />
        <HandleInput
          icon={<Twitter className="size-4" />}
          label="X / Twitter"
          value={tw}
          onChange={(v) => setTw(clean(v))}
          preview={tw ? `https://x.com/${tw}` : null}
        />
      </div>
      <Button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-4 rounded-full"
      >
        {save.isPending ? "Salvando…" : "Salvar redes"}
      </Button>
    </Card>
  );
}

function HandleInput({
  icon,
  label,
  value,
  onChange,
  preview,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  preview: string | null;
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center text-muted-foreground">
          {icon}
        </span>
        <span className="absolute left-11 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-14 font-mono"
          maxLength={50}
          placeholder="seuhandle"
        />
      </div>
      {preview && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          Prévia: <span className="text-primary">{preview}</span>
        </p>
      )}
    </div>
  );
}

const PREF_ITEMS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: "checkin", label: "Novos check-ins", desc: "Quando alguém do desafio bate meta." },
  { key: "comment", label: "Comentários", desc: "Comentários no seu post ou check-in." },
  { key: "reaction", label: "Reações", desc: "Curtidas nas suas publicações." },
  { key: "chat", label: "Bate-papo", desc: "Mensagens novas no chat do desafio." },
  { key: "mention", label: "Menções (@você)", desc: "Alguém te marca em um texto." },
  { key: "winners", label: "Vencedores", desc: "Encerramento e prêmios do desafio." },
];

function NotificationPrefsCard() {
  const qc = useQueryClient();
  const { data } = useSettingsExtras();
  const saveFn = useServerFn(saveNotificationPrefs);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  useEffect(() => {
    if (data) setPrefs(data.notification_prefs);
  }, [data]);

  const save = useMutation({
    mutationFn: (next: NotificationPrefs) => saveFn({ data: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-extras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!prefs) return null;

  const toggle = (k: keyof NotificationPrefs) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    save.mutate(next);
  };

  return (
    <Card title="Notificações" subtitle="Escolha o que quer receber." icon={Bell}>
      <ul className="divide-y divide-border">
        {PREF_ITEMS.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch checked={prefs[item.key]} onCheckedChange={() => toggle(item.key)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BlockedAccountsCard() {
  const qc = useQueryClient();
  const { data } = useSettingsExtras();
  const searchFn = useServerFn(searchUsersForBlock);
  const blockFn = useServerFn(blockUser);
  const unblockFn = useServerFn(unblockUser);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const search = useQuery({
    queryKey: ["block-search", debounced],
    enabled: debounced.length >= 2,
    queryFn: () => searchFn({ data: { q: debounced } }),
  });

  const block = useMutation({
    mutationFn: (uid: string) => blockFn({ data: { userId: uid } }),
    onSuccess: () => {
      toast.success("Conta bloqueada.");
      setQ("");
      qc.invalidateQueries({ queryKey: ["settings-extras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unblock = useMutation({
    mutationFn: (uid: string) => unblockFn({ data: { userId: uid } }),
    onSuccess: () => {
      toast.success("Conta desbloqueada.");
      qc.invalidateQueries({ queryKey: ["settings-extras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blockedIds = useMemo(() => new Set((data?.blocked ?? []).map((b) => b.id)), [data]);

  return (
    <Card title="Contas bloqueadas" subtitle="Você não verá posts, comentários nem mensagens dessas pessoas." icon={Ban}>
      <div className="relative">
        <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por @username ou nome"
          className="pl-9"
        />
      </div>
      {debounced.length >= 2 && (
        <div className="mt-2 space-y-1 rounded-2xl border border-border bg-background/60 p-1">
          {search.isFetching && (
            <p className="p-3 text-center text-xs text-muted-foreground">
              <Loader2 className="mx-auto size-4 animate-spin" />
            </p>
          )}
          {!search.isFetching && (search.data?.items ?? []).length === 0 && (
            <p className="p-3 text-center text-xs text-muted-foreground">Ninguém encontrado.</p>
          )}
          {(search.data?.items ?? []).map((u: any) => {
            const already = blockedIds.has(u.id);
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar className="size-8 border border-border">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>{u.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.display_name}</p>
                  {u.username && <p className="truncate text-xs text-muted-foreground">@{u.username}</p>}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={already ? "outline" : "secondary"}
                  disabled={already || block.isPending}
                  onClick={() => block.mutate(u.id)}
                  className="rounded-full"
                >
                  {already ? "Já bloqueado" : "Bloquear"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bloqueados ({data?.blocked.length ?? 0})
        </p>
        {(!data || data.blocked.length === 0) ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Nenhuma conta bloqueada.
          </p>
        ) : (
          <ul className="space-y-1">
            {data.blocked.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-2 py-2">
                <Avatar className="size-8 border border-border">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>{u.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.display_name}</p>
                  {u.username && <p className="truncate text-xs text-muted-foreground">@{u.username}</p>}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => unblock.mutate(u.id)}
                  disabled={unblock.isPending}
                  className="rounded-full"
                >
                  <X className="size-3.5" /> Desbloquear
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function PlatformAdminPanel() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview({ data: {} as any }),
    retry: false,
  });

  // Silenciosamente oculto para quem não é super_admin (o server fn 401 → error)
  if (error) return null;
  if (isLoading || !data) return null;

  return (
    <div className="mb-6 max-w-4xl rounded-3xl border border-primary/40 bg-primary/5 p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <Crown className="size-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Painel Super Admin</h2>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          plataforma
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Visão global da plataforma. Dados sensíveis — visível apenas para Super Admins.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link
          to="/admin/users"
          className="group rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Users className="size-3.5" /> Usuários
          </div>
          <p className="mt-1 font-display text-2xl font-bold group-hover:text-primary">{data.totalUsers}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Toque para ver, editar e exportar</p>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Desafios</div>
          <p className="mt-1 font-display text-2xl font-bold">{data.totalChallenges}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <ShieldAlert className="size-3.5" /> Advertências (últimas)
          </div>
          <p className="mt-1 font-display text-2xl font-bold">{data.recentWarnings.length}</p>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold">Admins de desafio</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Transfira a propriedade quando precisar remover um dono ou promover outro usuário.
        </p>
        <ul className="mt-2 space-y-2">
          {data.admins.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum admin ativo.</li>
          )}
          {data.admins.map((a: any) => (
            <li key={a.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{a.display_name ?? a.username ?? a.id.slice(0, 8)}</span>
                {a.username && <span className="text-xs text-muted-foreground">@{a.username}</span>}
              </div>
              <ul className="mt-2 space-y-2">
                {a.challenges.map((c: any) => (
                  <TransferOwnershipRow key={c.id} challenge={c} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>


      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/admin/warnings"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <ShieldAlert className="size-3.5" /> Trust & Safety
        </Link>
        <Link
          to="/admin/moderation"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Moderação IA
        </Link>
      </div>
    </div>
  );
}

function TransferOwnershipRow({ challenge }: { challenge: { id: string; name: string; status: string } }) {
  const qc = useQueryClient();
  const transferFn = useServerFn(transferChallengeOwnership);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const handleTransfer = async () => {
    const uname = username.trim().replace(/^@/, "");
    if (!uname) {
      toast.error("Informe o @username do novo dono.");
      return;
    }
    if (!confirm(`Transferir "${challenge.name}" para @${uname}? O dono atual vira membro.`)) return;
    setBusy(true);
    try {
      await transferFn({ data: { challengeId: challenge.id, newOwnerUsername: uname } });
      toast.success(`Propriedade transferida para @${uname}.`);
      setUsername("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["platform-overview"] });
      qc.invalidateQueries({ queryKey: ["challenge-hub", challenge.id] });
      qc.invalidateQueries({ queryKey: ["challenge-members", challenge.id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-border bg-background/50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px]">
          {challenge.name} · <span className="text-muted-foreground">{challenge.status}</span>
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-full text-[11px]"
          onClick={() => setOpen((v) => !v)}
        >
          <Crown className="mr-1 size-3" /> Transferir dono
        </Button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            placeholder="@username do novo dono"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-8 flex-1 text-xs"
          />
          <Button size="sm" className="h-8 rounded-full text-xs" disabled={busy} onClick={handleTransfer}>
            {busy ? <Loader2 className="size-3 animate-spin" /> : "Confirmar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-full text-xs"
            onClick={() => {
              setOpen(false);
              setUsername("");
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </li>
  );
}

function AffiliateWalletCard() {
  const qc = useQueryClient();
  const summaryFn = useServerFn(getAffiliateSummary);
  const withdrawFn = useServerFn(requestWithdraw);
  const { data, isLoading } = useQuery({
    queryKey: ["affiliate-summary"],
    queryFn: () => summaryFn({}),
  });
  const [pixKey, setPixKey] = useState("");

  const withdraw = useMutation({
    mutationFn: (key: string) => withdrawFn({ data: { pixKey: key } }),
    onSuccess: () => {
      toast.success("Saque solicitado! Pagamento em até 48h úteis.");
      setPixKey("");
      qc.invalidateQueries({ queryKey: ["affiliate-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = Number(data?.balance ?? 0);
  const eligible = balance >= 50;

  return (
    <div className="mb-6 max-w-2xl rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold">💰 Meus Ganhos (Programa de Parceiros)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Você ganha <strong>10%</strong> de tudo que os membros que você convidou para o FitCrew gastarem na loja. (Saque mínimo: R$ 50,00)
      </p>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-card p-4">
            <p className="text-xs text-muted-foreground">Saldo disponível</p>
            <p className="mt-1 font-display text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              R$ {balance.toFixed(2).replace(".", ",")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {data?.referredCount ?? 0} pessoa(s) convidada(s) por você
            </p>
          </div>

          {eligible ? (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = pixKey.trim();
                if (trimmed.length < 4) {
                  toast.error("Informe uma chave Pix válida.");
                  return;
                }
                withdraw.mutate(trimmed);
              }}
            >
              <div>
                <Label htmlFor="pix_key">Chave Pix</Label>
                <Input
                  id="pix_key"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  maxLength={140}
                />
              </div>
              <Button
                type="submit"
                disabled={withdraw.isPending}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              >
                {withdraw.isPending ? "Enviando…" : "Solicitar saque via Pix"}
              </Button>
            </form>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              Continue convidando amigos! Você precisa de R$ 50,00 para solicitar o primeiro saque.
            </p>
          )}

          {(data?.earnings?.length ?? 0) > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Últimas comissões
              </p>
              <ul className="space-y-1.5">
                {data!.earnings.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")} · {e.source_type}
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      + R$ {Number(e.commission_amount).toFixed(2).replace(".", ",")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data?.withdraws?.length ?? 0) > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Meus saques
              </p>
              <ul className="space-y-1.5">
                {data!.withdraws.map((w) => (
                  <li key={w.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {new Date(w.created_at).toLocaleDateString("pt-BR")} · R$ {Number(w.amount).toFixed(2).replace(".", ",")}
                    </span>
                    <span
                      className={
                        w.status === "paid"
                          ? "font-semibold text-emerald-600 dark:text-emerald-400"
                          : w.status === "pending"
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "font-semibold text-destructive"
                      }
                    >
                      {w.status === "paid" ? "✅ Pago" : w.status === "pending" ? "⏳ Pendente" : "Rejeitado"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
