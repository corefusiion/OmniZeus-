import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getChallengeByInvite, joinChallenge } from "@/lib/challenges.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy } from "lucide-react";

export const Route = createFileRoute("/join/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Convite para ${params.code} — FitCrew` },
      { name: "description", content: "Você foi convidado(a) para um desafio no FitCrew." },
      { property: "og:title", content: "FitCrew — Você foi convidado para um desafio" },
      {
        property: "og:description",
        content: "Registre treinos, dispute pontos e acompanhe a evolução do seu grupo de amigos na academia.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://fitcrew.nuvvy.app/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://fitcrew.nuvvy.app/og-image.jpg" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const challenge = await getChallengeByInvite({ data: { code: params.code } });
    return { code: params.code, challenge };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="text-sm text-muted-foreground">Convite inválido.</p>
    </div>
  ),
  component: JoinPage,
});

function JoinPage() {
  const { code, challenge } = Route.useLoaderData();
  const joinFn = useServerFn(joinChallenge);
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  if (!challenge) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <Trophy className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 font-display text-xl font-bold">Convite inválido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O link expirou ou o ADM desativou os convites deste desafio.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
        >
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-8">
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-card p-8 text-center shadow-soft">
        <Trophy className="mx-auto size-10 text-primary" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Você foi convidado</p>
        <h1 className="mt-1 font-display text-3xl font-black">{challenge.name}</h1>
        {challenge.description && (
          <p className="mt-3 text-sm text-muted-foreground">{challenge.description}</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          De {challenge.starts_at} até {challenge.ends_at}
        </p>
      </div>

      {authed === null ? (
        <div className="flex justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : authed ? (
        <Button
          className="w-full rounded-full shadow-flame"
          disabled={joining}
          onClick={async () => {
            setJoining(true);
            try {
              await joinFn({ data: { code } });
              toast.success("Você entrou no desafio!");
              navigate({ to: "/feed" });
            } catch (err: any) {
              toast.error(err.message);
            } finally {
              setJoining(false);
            }
          }}
        >
          {joining ? "Entrando…" : "Entrar no desafio"}
        </Button>
      ) : (
        <Link
          to="/auth"
          search={{ join: code }}
          className="block w-full rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground shadow-flame"
        >
          Criar conta pra entrar no desafio
        </Link>
      )}
      {authed === false && (
        <p className="text-center text-xs text-muted-foreground">
          Já tem conta?{" "}
          <Link
            to="/auth"
            search={{ join: code, mode: "signin" }}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Fazer login
          </Link>
        </p>
      )}
    </div>
  );
}
