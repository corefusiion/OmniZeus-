import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, ArrowRight, Lock, Send, Trophy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedButton } from "@/components/ui/animated-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { FitCrewLogo } from "@/components/brand/fitcrew-logo";
import {
  redeemInviteAndSignup,
  redeemChallengeInviteAndSignup,
  requestInvite,
} from "@/lib/invites.functions";
import { getChallengeByInvite, joinChallenge } from "@/lib/challenges.functions";
import { getPlatformSettings } from "@/lib/platform-settings.functions";
import { OpenSignupPanel } from "@/components/auth/open-signup-panel";


const authSearchSchema = z.object({
  join: z.string().trim().min(4).max(16).optional(),
  mode: z.enum(["signin", "invite"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => authSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Entrar — FitCrew" },
      { name: "description", content: "FitCrew é uma comunidade só para convidados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

const inviteSchema = z.object({
  code: z.string().trim().min(3, "Digite o código").max(32),
});

const signupSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3-20 caracteres: letras, números e _"),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

type Mode = "invite" | "signin" | "request" | "challenge" | "open";

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const joinCode = search.join?.toUpperCase() ?? null;
  const [checking, setChecking] = useState(true);

  const { data: platform } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => getPlatformSettings(),
    staleTime: 60_000,
  });
  const accessMode = platform?.access_mode ?? "closed";

  const [mode, setMode] = useState<Mode>(() => {
    if (search.join) return search.mode === "signin" ? "signin" : "challenge";
    return "invite";
  });

  // When platform loads in open mode, default landing is open signup (unless a join code is present)
  useEffect(() => {
    if (accessMode === "open" && !joinCode && (mode === "invite")) {
      setMode("open");
    }
  }, [accessMode, joinCode, mode]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        // Already signed in: if there's a pending challenge join, take them there.
        if (joinCode) {
          try {
            await joinChallenge({ data: { code: joinCode } });
            toast.success("Você entrou no desafio!");
          } catch {
            /* ignore, land on feed */
          }
          navigate({ to: "/feed", replace: true });
          return;
        }
        navigate({ to: "/feed", replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate, joinCode]);

  async function afterAuthDone() {
    if (joinCode) {
      try {
        await joinChallenge({ data: { code: joinCode } });
        toast.success("Você entrou no desafio!");
      } catch (err) {
        toast.error("Conta ok, mas não deu pra entrar no desafio", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
      navigate({ to: "/feed" });
      return;
    }
    navigate({ to: "/feed" });
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-foreground px-6 py-10 text-background">
      {/* Ambient mysterious backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(circle_at_20%_10%,oklch(0.685_0.19_40/0.35),transparent_55%),radial-gradient(circle_at_80%_90%,oklch(0.685_0.19_40/0.22),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <FitCrewLogo size={72} withGlow />
            <span className="font-display text-2xl font-bold tracking-tight">FitCrew</span>
          </Link>
          {accessMode !== "open" && (
            <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-background/80 ring-1 ring-inset ring-background/15">
              <Lock className="size-3" /> Comunidade privada
            </p>
          )}

        </div>

        {mode === "challenge" && joinCode && (
          <ChallengeSignupFlow
            joinCode={joinCode}
            onGoSignIn={() => setMode("signin")}
            onDone={afterAuthDone}
          />
        )}
        {mode === "open" && (
          <OpenSignupPanel onGoSignIn={() => setMode("signin")} onDone={afterAuthDone} />
        )}
        {mode === "invite" && (
          <InviteFlow
            onGoSignIn={() => setMode("signin")}
            onRequest={() => setMode("request")}
            onDone={afterAuthDone}
          />
        )}
        {mode === "signin" && (
          <SignInPanel
            onBack={() => setMode(joinCode ? "challenge" : accessMode === "open" ? "open" : "invite")}
            onDone={afterAuthDone}
          />
        )}
        {mode === "request" && <RequestInvitePanel onBack={() => setMode("invite")} />}
      </div>
    </div>
  );
}

// ---------- Challenge Invite → Signup (practical entry from /join/CODE) ----------
function ChallengeSignupFlow({
  joinCode,
  onGoSignIn,
  onDone,
}: {
  joinCode: string;
  onGoSignIn: () => void;
  onDone: () => void;
}) {
  const [challenge, setChallenge] = useState<{ name: string; description: string | null } | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getChallengeByInvite({ data: { code: joinCode } })
      .then((c) => setChallenge(c ? { name: c.name, description: c.description } : null))
      .finally(() => setLoadingChallenge(false));
  }, [joinCode]);

  async function signup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      email: form.get("email"),
      username: form.get("username"),
      password: form.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      // 1) Client-side signup (no service role needed)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { display_name: parsed.data.username },
          emailRedirectTo: `${window.location.origin}/auth?join=${joinCode}`,
        },
      });
      if (signUpErr) {
        setSubmitting(false);
        if (/already|registered/i.test(signUpErr.message)) {
          return toast.error("Este e-mail já tem conta — faça login");
        }
        return toast.error("Não deu pra criar a conta", { description: signUpErr.message });
      }

      // 2) If no session (email confirmation required), tell the user
      if (!signUpData.session) {
        setSubmitting(false);
        toast.success("Conta criada! Confirme o e-mail e faça login para entrar no desafio.");
        onGoSignIn();
        return;
      }

      // 3) Set username on the auto-created profile (RLS lets user update own row)
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          username: parsed.data.username,
          display_name: parsed.data.username,
        })
        .eq("id", signUpData.session.user.id);
      if (profErr && /username/i.test(profErr.message)) {
        toast.error("Este @username já está em uso — você pode trocar depois nas configurações.");
      }

      // 4) Auto-join the challenge via SECURITY DEFINER RPC
      try {
        await joinChallenge({ data: { code: joinCode } });
      } catch (err) {
        toast.error("Conta criada, mas não deu pra entrar no desafio", {
          description: err instanceof Error ? err.message : String(err),
        });
      }

      toast.success("Bem-vindo à crew 🔥");
      onDone();
    } catch (err) {
      setSubmitting(false);
      toast.error("Erro inesperado", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }


  return (
    <div className="rounded-3xl border border-background/10 bg-background/[0.04] p-7 backdrop-blur-sm sm:p-9">
      <div className="text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
          <Trophy className="size-6" />
        </div>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/90">
          Convite de desafio
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
          {loadingChallenge
            ? "Carregando desafio…"
            : challenge
              ? `Bora entrar no ${challenge.name}?`
              : "Convite inválido"}
        </h1>
        <p className="mt-2 text-sm text-background/60">
          {challenge
            ? "Cria sua conta abaixo — a gente já te coloca no desafio automaticamente."
            : "Peça um link novo pro ADM do desafio."}
        </p>
      </div>

      {challenge && (
        <form onSubmit={signup} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cs-username" className="text-background/80">@Username</Label>
            <Input
              id="cs-username"
              name="username"
              required
              autoCapitalize="none"
              autoComplete="username"
              placeholder="ex: rafa_lift"
              className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-email" className="text-background/80">E-mail</Label>
            <Input
              id="cs-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-password" className="text-background/80">Senha</Label>
            <Input
              id="cs-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
            />
          </div>

          <AnimatedButton type="submit" flame className="w-full rounded-full" disabled={submitting}>
            {submitting ? "Criando conta…" : "Criar conta e entrar no desafio"}
          </AnimatedButton>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={onGoSignIn}
              className="text-xs text-background/60 underline-offset-4 hover:text-background hover:underline"
            >
              Já tem conta? Fazer login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------- Invite → Signup ----------
function InviteFlow({ onGoSignIn, onRequest, onDone }: { onGoSignIn: () => void; onRequest: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [validCode, setValidCode] = useState<string | null>(null);
  const [isChallengeCode, setIsChallengeCode] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function validate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = inviteSchema.safeParse({ code });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setChecking(true);
    const trimmed = parsed.data.code.toUpperCase();
    // 1) Try personal invite
    const { data, error } = await supabase.rpc("is_invite_available", { _code: trimmed });
    if (error) {
      setChecking(false);
      return toast.error("Não deu pra validar", { description: error.message });
    }
    if (data) {
      setChecking(false);
      setIsChallengeCode(false);
      setValidCode(trimmed);
      return;
    }
    // 2) Fallback: challenge invite code (active + enabled)
    try {
      const ch = await getChallengeByInvite({ data: { code: trimmed } });
      setChecking(false);
      if (ch && ch.is_active) {
        setIsChallengeCode(true);
        setValidCode(trimmed);
        return;
      }
    } catch {
      setChecking(false);
    }
    toast.error("Convite inválido ou já utilizado");
  }

  async function signup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validCode) return;
    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      email: form.get("email"),
      username: form.get("username"),
      password: form.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      const res = isChallengeCode
        ? await redeemChallengeInviteAndSignup({
            data: { challengeCode: validCode, ...parsed.data },
          })
        : await redeemInviteAndSignup({ data: { code: validCode, ...parsed.data } });
      if (!res.ok) {
        setSubmitting(false);
        const map: Record<string, string> = {
          invalid: "Convite inválido ou já utilizado",
          invalid_challenge: "Código do desafio inválido ou desativado",
          expired: "Este convite expirou",
          username_taken: "Este @username já está em uso",
          email_taken: "Este e-mail já tem conta",
        };
        return toast.error(map[res.reason] ?? "Não deu pra criar a conta");
      }
      // Auto sign-in
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signErr) {
        setSubmitting(false);
        return toast.error("Conta criada, mas o login falhou", { description: signErr.message });
      }
      toast.success("Bem-vindo à crew 🔥");
      onDone();
    } catch (err) {
      setSubmitting(false);
      toast.error("Erro inesperado", { description: err instanceof Error ? err.message : String(err) });
    }
  }


  return (
    <div className="rounded-3xl border border-background/10 bg-background/[0.04] p-7 backdrop-blur-sm sm:p-9">
      {!validCode ? (
        <form onSubmit={validate} className="space-y-6">
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-[2rem]">
              Digite seu <span className="text-primary">Código de Convite</span>
            </h1>
            <p className="mt-2 text-sm text-background/60">
              FitCrew é só para convidados. Quem já tá na crew te chama.
            </p>
          </div>

          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-primary/80" />
            <Input
              autoFocus
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="FIT-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-16 rounded-2xl border-background/15 bg-background/5 pl-12 pr-4 text-center font-display text-xl font-bold tracking-[0.28em] text-background placeholder:text-background/30 focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/40"
              maxLength={32}
            />
          </div>

          <AnimatedButton type="submit" flame className="w-full rounded-full" disabled={checking}>
            {checking ? "Validando…" : (
              <span className="inline-flex items-center gap-2">
                Validar <ArrowRight className="size-4" />
              </span>
            )}
          </AnimatedButton>

          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <button
              type="button"
              onClick={onRequest}
              className="text-xs font-medium text-primary/90 underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              Não tem convite? Solicitar acesso
            </button>
            <button
              type="button"
              onClick={onGoSignIn}
              className="text-xs text-background/60 underline-offset-4 transition-colors hover:text-background hover:underline"
            >
              Já tem uma conta? Fazer login
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={signup} className="space-y-5">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary ring-1 ring-inset ring-primary/30">
              Convite validado · {validCode}
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold">Bora criar sua conta VIP</h2>
            <p className="mt-1 text-sm text-background/60">Escolha um @username. É como a crew vai te chamar.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="su-username" className="text-background/80">@Username</Label>
            <Input
              id="su-username"
              name="username"
              required
              autoCapitalize="none"
              autoComplete="username"
              placeholder="ex: rafa_lift"
              className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="su-email" className="text-background/80">E-mail</Label>
            <Input
              id="su-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="su-password" className="text-background/80">Senha</Label>
            <Input
              id="su-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
            />
          </div>

          <AnimatedButton type="submit" flame className="w-full rounded-full" disabled={submitting}>
            {submitting ? "Criando conta…" : "Entrar na FitCrew"}
          </AnimatedButton>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setValidCode(null)}
              className="text-xs text-background/60 underline-offset-4 hover:text-background hover:underline"
            >
              ← Usar outro código
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------- Sign In (email + senha) ----------
function SignInPanel({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="rounded-3xl border border-background/10 bg-background/[0.04] p-7 backdrop-blur-sm sm:p-9">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">Que bom te ver de volta</h1>
        <p className="mt-2 text-sm text-background/60">Entre com seu e-mail e senha.</p>
      </div>

      <form
        className="mt-7 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const parsed = signInSchema.safeParse({
            email: form.get("email"),
            password: form.get("password"),
          });
          if (!parsed.success) return toast.error(parsed.error.issues[0].message);
          setLoading(true);
          const { error } = await supabase.auth.signInWithPassword(parsed.data);
          setLoading(false);
          if (error) return toast.error("Não rolou", { description: error.message });
          onDone();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="si-email" className="text-background/80">E-mail</Label>
          <Input
            id="si-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="si-password" className="text-background/80">Senha</Label>
          <Input
            id="si-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>
        <AnimatedButton type="submit" flame className="w-full rounded-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </AnimatedButton>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-background/60 underline-offset-4 hover:text-background hover:underline"
        >
          ← Voltar (tenho um convite)
        </button>
      </div>
    </div>
  );
}

// ---------- Request Invite ----------
const requestSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  name: z.string().trim().max(80).optional(),
  message: z.string().trim().max(500).optional(),
});

function RequestInvitePanel({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-3xl border border-background/10 bg-background/[0.04] p-8 text-center backdrop-blur-sm">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/20 text-primary">
          <Send className="size-6" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Solicitação enviada</h2>
        <p className="mt-2 text-sm text-background/60">
          Um admin vai revisar seu pedido. Se aprovado, você recebe o código de convite no e-mail informado.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-xs text-background/60 underline-offset-4 hover:text-background hover:underline"
        >
          ← Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-background/10 bg-background/[0.04] p-7 backdrop-blur-sm sm:p-9">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">Solicitar convite</h1>
        <p className="mt-2 text-sm text-background/60">
          Conta pra crew quem é você. Se rolar match, um admin libera seu acesso.
        </p>
      </div>

      <form
        className="mt-7 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const parsed = requestSchema.safeParse({
            email: form.get("email"),
            name: (form.get("name") as string) || undefined,
            message: (form.get("message") as string) || undefined,
          });
          if (!parsed.success) return toast.error(parsed.error.issues[0].message);
          setLoading(true);
          try {
            const res = await requestInvite({ data: parsed.data });
            setLoading(false);
            if (!res.ok) {
              return toast.error("Você já solicitou nas últimas 24h. Aguarda a análise 😉");
            }
            setSent(true);
          } catch (err) {
            setLoading(false);
            toast.error("Erro ao enviar", { description: err instanceof Error ? err.message : String(err) });
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="rq-name" className="text-background/80">Como te chamam</Label>
          <Input
            id="rq-name"
            name="name"
            placeholder="Ex: Rafa"
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rq-email" className="text-background/80">Seu melhor e-mail</Label>
          <Input
            id="rq-email"
            name="email"
            type="email"
            required
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rq-message" className="text-background/80">Por que quer entrar? (opcional)</Label>
          <Textarea
            id="rq-message"
            name="message"
            rows={3}
            maxLength={500}
            placeholder="Bora treinar junto. Meta: bater 5x/semana."
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>
        <AnimatedButton type="submit" flame className="w-full rounded-full" disabled={loading}>
          {loading ? "Enviando…" : (
            <span className="inline-flex items-center gap-2">
              Solicitar acesso <Send className="size-4" />
            </span>
          )}
        </AnimatedButton>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-background/60 underline-offset-4 hover:text-background hover:underline"
        >
          ← Voltar (tenho um convite)
        </button>
      </div>
    </div>
  );
}
