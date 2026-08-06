import { useState } from "react";
import { RenderMentions } from "@/components/render-mentions";

export function ExpandableText({
  text,
  limit = 240,
  className = "",
}: {
  text: string;
  limit?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const needsClamp = text.length > limit;
  const shown = !needsClamp || expanded ? text : text.slice(0, limit).trimEnd() + "…";

  return (
    <p className={`whitespace-pre-wrap ${className}`}>
      <RenderMentions text={shown} />
      {needsClamp && (
        <>
          {" "}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="align-baseline text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            {expanded ? "menos" : "mais..."}
          </button>
        </>
      )}
    </p>
  );
}
