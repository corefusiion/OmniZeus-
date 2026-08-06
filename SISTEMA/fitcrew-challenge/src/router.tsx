import { QueryClient } from "@tanstack/react-query";
import { createRouter, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { routeTree } from "./routeTree.gen";
import { reportLovableError } from "./lib/lovable-error-reporting";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_default_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-sm rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden />
        <h2 className="mt-2 font-display text-lg font-bold text-foreground">
          Não foi possível carregar
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Verifique sua conexão e tente novamente.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-flame"
          >
            Tentar de novo
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-4 py-2 text-xs font-semibold text-foreground"
          >
            Ir pra home
          </Link>
        </div>
      </div>
    </div>
  );
}

function DefaultNotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">404</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-foreground">
          Nada por aqui
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Este conteúdo foi removido ou você não tem acesso.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-flame"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 30s — cuts duplicate refetches while a user
        // navigates between /feed, /ranking, /profile, etc.
        staleTime: 30_000,
        // Keep unused query data around for 5 min so back-nav is instant.
        gcTime: 5 * 60_000,
        // Exponential backoff with jitter; skip 4xx and auth errors.
        retry: (failureCount, error) => {
          const message = error instanceof Error ? error.message : "";
          if (/unauthorized|forbidden|not.?found|invalid|permission|4\d\d/i.test(message)) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => {
          const exp = Math.min(8_000, 300 * 2 ** attemptIndex);
          return Math.round(Math.random() * exp);
        },
        refetchOnWindowFocus: false,
        networkMode: "online",
      },
      mutations: {
        retry: (failureCount, error) => {
          const message = error instanceof Error ? error.message : "";
          if (/unauthorized|forbidden|not.?found|invalid|permission|4\d\d/i.test(message)) {
            return false;
          }
          return failureCount < 1 && /network|timeout|fetch failed|5\d\d/i.test(message);
        },
        retryDelay: 500,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultErrorComponent: DefaultErrorComponent,
    defaultNotFoundComponent: DefaultNotFoundComponent,
  });

  return router;
};

