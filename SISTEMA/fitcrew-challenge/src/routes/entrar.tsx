import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FitCrewLogo } from "@/components/brand/fitcrew-logo";
import { Link } from "@tanstack/react-router";
import { OpenSignupPanel } from "@/components/auth/open-signup-panel";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Criar conta grátis — FitCrew" },
      {
        name: "description",
        content:
          "Crie sua conta grátis no FitCrew, entre em desafios fitness e treine junto com a crew.",
      },
      { property: "og:title", content: "Criar conta grátis — FitCrew" },
      {
        property: "og:description",
        content: "Bora treinar junto. Cadastre-se grátis e escolha seu desafio.",
      },
    ],
  }),
  component: EntrarPage,
});

function EntrarPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [signInMode, setSignInMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/feed", replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-foreground px-6 py-10 text-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(circle_at_20%_10%,oklch(0.685_0.19_40/0.35),transparent_55%),radial-gradient(circle_at_80%_90%,oklch(0.685_0.19_40/0.22),transparent_60%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-10 flex flex-col items-center text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <FitCrewLogo size={72} withGlow />
            <span className="font-display text-2xl font-bold tracking-tight">FitCrew</span>
          </Link>
        </div>
        {signInMode ? (
          <div className="rounded-3xl border border-background/10 bg-background/[0.04] p-7 text-center backdrop-blur-sm sm:p-9">
            <p className="text-sm text-background/70">
              Faça login na página principal.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Ir para o login →
            </Link>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setSignInMode(false)}
                className="text-xs text-background/60 underline-offset-4 hover:text-background hover:underline"
              >
                ← Voltar
              </button>
            </div>
          </div>
        ) : (
          <OpenSignupPanel onGoSignIn={() => setSignInMode(true)} />
        )}
      </div>
    </div>
  );
}
