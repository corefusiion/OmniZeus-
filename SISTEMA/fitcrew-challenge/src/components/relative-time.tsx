import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RelativeTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const label =
    diffMs < 45_000
      ? "agora"
      : `há ${formatDistanceToNowStrict(d, { locale: ptBR })}`;
  return (
    <time dateTime={iso} title={d.toLocaleString("pt-BR")} className="tabular-nums">
      {label}
    </time>
  );
}
