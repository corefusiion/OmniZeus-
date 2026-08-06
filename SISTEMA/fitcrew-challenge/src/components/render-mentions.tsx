import { Link } from "@tanstack/react-router";
import { MENTION_RE } from "@/lib/mentions";

export function RenderMentions({ text }: { text: string }) {
  const parts: Array<{ t: "text" | "mention"; v: string }> = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ t: "text", v: text.slice(last, start) });
    parts.push({ t: "mention", v: m[1] });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ t: "text", v: text.slice(last) });

  return (
    <>
      {parts.map((p, i) =>
        p.t === "mention" ? (
          <Link
            key={i}
            to="/u/$username"
            params={{ username: p.v }}
            className="font-semibold text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            @{p.v}
          </Link>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </>
  );
}
