import { cn } from "@/lib/utils";
import markSrc from "@/assets/fitcrew-mark.png";

/**
 * FitCrew brandmark — barras ascendentes + figura em movimento.
 * Renderiza o PNG oficial. Mantém a mesma API do componente antigo
 * (size, className, withGlow) pra ser drop-in em todas as telas.
 */
export function FitCrewLogo({
  className,
  size = 24,
  withGlow = false,
}: {
  className?: string;
  size?: number;
  withGlow?: boolean;
}) {
  return (
    <img
      src={markSrc}
      alt="FitCrew"
      width={size}
      height={size}
      draggable={false}
      className={cn(
        "shrink-0 select-none object-contain",
        withGlow && "drop-shadow-[0_0_10px_rgba(255,90,31,0.45)]",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
