import { AlertTriangle, RefreshCw } from "lucide-react";

export function QueryError({
  message,
  onRetry,
  label,
}: {
  message?: string;
  onRetry?: () => void;
  label?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center"
    >
      <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden />
      <p className="mt-2 text-sm font-medium text-foreground">
        Não foi possível carregar {label ?? "esta seção"}.
      </p>
      {message && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-flame transition-transform hover:-translate-y-0.5"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Tentar de novo
        </button>
      )}
    </div>
  );
}
