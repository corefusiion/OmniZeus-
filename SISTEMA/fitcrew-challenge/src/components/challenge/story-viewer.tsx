import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteStory, type StoryAuthorGroup } from "@/lib/stories.functions";

const DURATION_MS = 5000;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) {
    const m = Math.max(1, Math.floor(diff / 60000));
    return `${m}min`;
  }
  return `${h}h`;
}

export function StoryViewer({
  groups,
  startIndex,
  meUserId,
  onClose,
  onDeleted,
}: {
  groups: StoryAuthorGroup[];
  startIndex: number;
  meUserId: string | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [gIdx, setGIdx] = useState(startIndex);
  const [sIdx, setSIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  const group = groups[gIdx];
  const story = group?.stories[sIdx];

  const advance = useMemo(
    () => () => {
      if (!group) return;
      if (sIdx < group.stories.length - 1) {
        setSIdx((i) => i + 1);
        setProgress(0);
      } else if (gIdx < groups.length - 1) {
        setGIdx((i) => i + 1);
        setSIdx(0);
        setProgress(0);
      } else {
        onClose();
      }
    },
    [group, sIdx, gIdx, groups.length, onClose],
  );

  const back = () => {
    if (sIdx > 0) {
      setSIdx((i) => i - 1);
      setProgress(0);
    } else if (gIdx > 0) {
      setGIdx((i) => i - 1);
      setSIdx(groups[gIdx - 1].stories.length - 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (paused || !story || story.media_kind === "video") return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(100, ((Date.now() - start) / DURATION_MS) * 100);
      setProgress(p);
      if (p >= 100) {
        advance();
      } else {
        timerRef.current = window.setTimeout(tick, 60);
      }
    };
    timerRef.current = window.setTimeout(tick, 60);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [story, paused, advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const delFn = useServerFn(deleteStory);
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Story removido.");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!group || !story) return null;
  const isMine = meUserId === group.author_id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
    >
      {/* Top bars */}
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-3">
        {group.stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-white transition-[width] duration-100"
              style={{
                width: `${i < sIdx ? 100 : i === sIdx ? progress : 0}%`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute inset-x-0 top-5 z-10 flex items-center gap-3 px-4 pt-3 text-white">
        <span className="grid size-9 place-items-center overflow-hidden rounded-full border border-white/30 bg-white/10">
          {group.avatar_url ? (
            <img src={group.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-xs font-bold">{group.display_name.slice(0, 2).toUpperCase()}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{group.display_name}</p>
          <p className="text-[10px] text-white/60">{timeAgo(story.created_at)} atrás</p>
        </div>
        {isMine && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Remover este story?")) delMut.mutate(story.id);
            }}
            disabled={delMut.isPending}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Excluir"
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Media area */}
      <div
        className="relative flex h-full w-full max-w-md items-center justify-center"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {story.signed_url ? (
          story.media_kind === "video" ? (
            <video
              key={story.id}
              src={story.signed_url}
              autoPlay
              playsInline
              controls={false}
              onEnded={advance}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <img
              key={story.id}
              src={story.signed_url}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          )
        ) : (
          <div className="text-white/60">Falha ao carregar mídia.</div>
        )}

        {story.caption && (
          <div className="absolute bottom-10 left-4 right-4 rounded-2xl bg-black/50 p-3 text-center text-sm text-white backdrop-blur">
            {story.caption}
          </div>
        )}

        {/* Tap zones */}
        <button
          type="button"
          onClick={back}
          className="absolute inset-y-0 left-0 w-1/3"
          aria-label="Anterior"
        >
          <ChevronLeft className="absolute left-2 top-1/2 size-6 -translate-y-1/2 text-white/40" />
        </button>
        <button
          type="button"
          onClick={advance}
          className="absolute inset-y-0 right-0 w-1/3"
          aria-label="Próximo"
        >
          <ChevronRight className="absolute right-2 top-1/2 size-6 -translate-y-1/2 text-white/40" />
        </button>
      </div>
    </div>
  );
}
