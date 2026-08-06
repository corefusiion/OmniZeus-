import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-3 font-display text-5xl font-bold text-foreground">Rota não existe</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A página que você procura foi movida ou nunca existiu.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-flame transition-transform hover:-translate-y-0.5"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Algo deu errado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tenta recarregar ou volte pra home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-flame"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground"
          >
            Ir pra home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FitCrew — Desafio fitness entre amigos" },
      {
        name: "description",
        content:
          "Registre treinos, mande a foto do dia e veja o placar da sua crew subir. Ranking, streaks e temporadas pra treinar junto e não desistir.",
      },
      { name: "author", content: "FitCrew" },
      { name: "theme-color", content: "#0f0f10" },
      { property: "og:site_name", content: "FitCrew" },
      { property: "og:title", content: "FitCrew — Desafio fitness entre amigos" },
      {
        property: "og:description",
        content:
          "Registre treinos, mande a foto do dia e veja o placar da sua crew subir. Ranking, streaks e temporadas pra treinar junto e não desistir.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "FitCrew — Desafio fitness entre amigos" },
      {
        name: "twitter:description",
        content:
          "Registre treinos, mande a foto do dia e veja o placar da sua crew subir. Ranking, streaks e temporadas pra treinar junto e não desistir.",
      },
      { property: "og:image", content: "https://fitcrew.nuvvy.app/og-image.jpg" },
      { name: "twitter:image", content: "https://fitcrew.nuvvy.app/og-image.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/fitcrew-icon.png" },
      { rel: "apple-touch-icon", href: "/fitcrew-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "FitCrew",
          description:
            "Plataforma de desafios fitness entre amigos com ranking, streaks e temporadas.",
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event === "SIGNED_OUT") {
        // Limpa todo o cache para não vazar dados entre contas
        queryClient.clear();
      } else {
        queryClient.invalidateQueries();
      }
    });

    // Global safety net: log uncaught client errors so we can degrade gracefully
    // instead of blank-screening. Route-level ErrorBoundary handles render errors.
    const onError = (e: ErrorEvent) => {
      reportLovableError(e.error ?? new Error(e.message), { boundary: "window.onerror" });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      reportLovableError(e.reason ?? new Error("unhandledrejection"), {
        boundary: "window.onunhandledrejection",
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
