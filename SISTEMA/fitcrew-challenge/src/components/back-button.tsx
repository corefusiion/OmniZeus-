import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type BackButtonProps = {
  label?: string;
  className?: string;
  /** Optional explicit target — falls back to browser history */
  to?: string;
  params?: Record<string, string>;
};

export function BackButton({
  label = "Voltar",
  className = "",
  to,
  params,
}: BackButtonProps) {
  const router = useRouter();
  const handleClick = () => {
    if (to) {
      router.navigate({ to: to as any, params: params as any });
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/feed" });
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={typeof label === "string" ? label : "Voltar"}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur transition hover:bg-secondary hover:text-foreground ${className}`}
    >
      <ArrowLeft className="size-4" />
      <span className="truncate max-w-[220px]">{label}</span>
    </button>
  );
}
