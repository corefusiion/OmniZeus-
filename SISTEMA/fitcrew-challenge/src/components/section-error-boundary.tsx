import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useEffect, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

function DefaultFallback({ resetErrorBoundary, label }: FallbackProps & { label?: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden />
      <p className="mt-2 text-sm font-medium text-foreground">
        Não foi possível carregar {label ?? "esta seção"}.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Tente novamente em alguns segundos.
      </p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-flame transition-transform hover:-translate-y-0.5"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Tentar de novo
      </button>
    </div>
  );
}

/**
 * Wraps a section so a runtime render error in it doesn't blank the whole page.
 * Reports the error to the Lovable overlay and renders a small retry UI.
 */
export function SectionErrorBoundary({
  children,
  label,
  boundary,
  onReset,
}: {
  children: ReactNode;
  label?: string;
  boundary: string;
  onReset?: () => void;
}) {
  return (
    <ErrorBoundary
      onError={(error) => {
        reportLovableError(error, { boundary });
      }}
      onReset={onReset}
      fallbackRender={(props) => <DefaultFallback {...props} label={label} />}
    >
      {children}
    </ErrorBoundary>
  );
}

/** Reports errors from a wrapped section. */
export function useReportError(error: unknown, boundary: string) {
  useEffect(() => {
    if (error instanceof Error) reportLovableError(error, { boundary });
  }, [error, boundary]);
}
