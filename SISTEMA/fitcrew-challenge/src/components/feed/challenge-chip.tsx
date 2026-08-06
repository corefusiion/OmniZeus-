import { Link } from "@tanstack/react-router";
import { Flag } from "lucide-react";

export function ChallengeChip({
  challengeId,
  name,
}: {
  challengeId: string;
  name: string;
}) {
  return (
    <Link
      to="/c/$id"
      params={{ id: challengeId }}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      title={`Ver desafio "${name}"`}
      onClick={(e) => e.stopPropagation()}
    >
      <Flag className="size-3 shrink-0" />
      <span className="truncate">{name}</span>
    </Link>
  );
}
