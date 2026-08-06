import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight } from "lucide-react";

import { AnimatedButton } from "@/components/ui/animated-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";


const openSignupSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z
    .string()
    .trim()
    .min(8, "Telefone inválido")
    .max(20, "Telefone muito longo")
    .regex(/^[+0-9()\s-]+$/, "Use apenas números, espaço, + - ( )"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3-20 caracteres: letras, números e _"),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

/**
 * Shared open-signup panel used by:
 * - /entrar (dedicated marketing landing)
 * - /auth when platform_settings.access_mode === 'open'
 */
export function OpenSignupPanel({
  onGoSignIn,
  onDone,
}: {
  onGoSignIn?: () => void;
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function signup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = openSignupSchema.safeParse({
      email: form.get("email"),
      phone: form.get("phone"),
      username: form.get("username"),
      password: form.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { display_name: parsed.data.username, phone: parsed.data.phone },
          emailRedirectTo: `${window.location.origin}/feed`,
        },
      });
      if (signUpErr) {
        setSubmitting(false);
        if (/already|registered/i.test(signUpErr.message)) {
          return toast.error("Este e-mail já tem conta — faça login");
        }
        return toast.error("Não deu pra criar a conta", { description: signUpErr.message });
      }

      if (!signUpData.session) {
        setSubmitting(false);
        toast.success("Conta criada! Confirme o e-mail e faça login.");
        onGoSignIn?.();
        return;
      }

      // Set username on the auto-created profile
      const userId = signUpData.session.user.id;
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          username: parsed.data.username,
          display_name: parsed.data.username,
        })
        .eq("id", userId);
      if (profErr && /username/i.test(profErr.message)) {
        toast.error("Este @username já está em uso — troque nas configurações.");
      }
      // Save phone in user_contacts (email is auto-filled by trigger)
      await supabase
        .from("user_contacts")
        .upsert({ user_id: userId, email: parsed.data.email, phone: parsed.data.phone }, { onConflict: "user_id" });

      toast.success("Bem-vindo à crew 🔥");
      if (onDone) onDone();
      else navigate({ to: "/explore" });
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary ring-1 ring-inset ring-primary/30">
          🌐 Cadastro aberto
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
          Crie sua conta <span className="text-primary">grátis</span>
        </h1>
        <p className="mt-2 text-sm text-background/60">
          Bora treinar junto. Sem código, sem enrolação.
        </p>
      </div>

      <form onSubmit={signup} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="os-username" className="text-background/80">
            @Username
          </Label>
          <Input
            id="os-username"
            name="username"
            required
            autoCapitalize="none"
            autoComplete="username"
            placeholder="ex: rafa_lift"
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="os-email" className="text-background/80">
            E-mail
          </Label>
          <Input
            id="os-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="os-phone" className="text-background/80">
            Telefone
          </Label>
          <Input
            id="os-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            placeholder="+55 71 90000-0000"
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="os-password" className="text-background/80">
            Senha
          </Label>
          <Input
            id="os-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            className="rounded-xl border-background/15 bg-background/5 text-background placeholder:text-background/30"
          />
        </div>

        <AnimatedButton type="submit" flame className="w-full rounded-full" disabled={submitting}>
          {submitting ? (
            "Criando conta…"
          ) : (
            <span className="inline-flex items-center gap-2">
              Criar conta grátis <ArrowRight className="size-4" />
            </span>
          )}
        </AnimatedButton>
      </form>




      {onGoSignIn && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onGoSignIn}
            className="text-xs text-background/60 underline-offset-4 hover:text-background hover:underline"
          >
            Já tem conta? Fazer login
          </button>
        </div>
      )}
    </div>
  );
}
