import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createStory,
  listChallengeStories,
  type StoryAuthorGroup,
} from "@/lib/stories.functions";
import { StoryViewer } from "./story-viewer";

const SEEN_KEY = "story-seen-v1";

function getSeenSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function persistSeen(set: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export function StoryBar({ challengeId, meUserId }: { challengeId: string; meUserId: string | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listChallengeStories);
  const createFn = useServerFn(createStory);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [seenTick, setSeenTick] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["challenge-stories", challengeId],
    queryFn: () => listFn({ data: { challengeId } }),
    staleTime: 60_000,
  });

  const groups = useMemo<StoryAuthorGroup[]>(() => {
    const seen = getSeenSet();
    return (data ?? []).map((g) => ({
      ...g,
      has_unseen: g.stories.some((s) => !seen.has(s.id)),
    }));
    // seenTick forces recompute after marking as seen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seenTick]);

  const uploadAndCreate = async (file: File) => {
    if (!meUserId) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Envie uma imagem ou vídeo.");
      return;
    }
    const maxMb = isVideo ? 40 : 8;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx ${maxMb}MB).`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const path = `${challengeId}/${meUserId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("story-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      await createFn({
        data: {
          challengeId,
          mediaUrl: path,
          mediaKind: isVideo ? "video" : "image",
        },
      });
      toast.success("Story publicado!");
      qc.invalidateQueries({ queryKey: ["challenge-stories", challengeId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openViewer = (idx: number) => {
    setOpenIdx(idx);
    const g = groups[idx];
    if (!g) return;
    const seen = getSeenSet();
    g.stories.forEach((s) => seen.add(s.id));
    persistSeen(seen);
    // trigger re-render for "seen" rings
    setTimeout(() => setSeenTick((t) => t + 1), 300);
  };

  return (
    <section aria-label="Stories" className="-mx-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadAndCreate(f);
        }}
      />
      <div className="flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group flex w-16 shrink-0 flex-col items-center gap-1"
        >
          <span className="relative grid size-16 place-items-center rounded-full border-2 border-dashed border-primary/50 bg-primary/5 text-primary transition group-hover:border-primary group-hover:bg-primary/10">
            {uploading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Plus className="size-7" />
            )}
          </span>
          <span className="w-full truncate text-center text-[10px] font-semibold text-muted-foreground">
            Seu story
          </span>
        </button>

        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-16 shrink-0">
              <div className="size-16 animate-pulse rounded-full bg-secondary" />
              <div className="mt-1 h-2 animate-pulse rounded bg-secondary" />
            </div>
          ))}

        {groups.map((g, idx) => (
          <button
            key={g.author_id}
            type="button"
            onClick={() => openViewer(idx)}
            className="group flex w-16 shrink-0 flex-col items-center gap-1"
          >
            <span
              className={`relative grid size-16 place-items-center rounded-full p-[2px] ${
                g.has_unseen
                  ? "bg-gradient-to-tr from-orange-500 via-primary to-primary/60"
                  : "bg-border"
              }`}
            >
              <span className="grid size-full place-items-center overflow-hidden rounded-full border-2 border-background bg-secondary">
                {g.avatar_url ? (
                  <img
                    src={g.avatar_url}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="font-display text-sm font-bold">
                    {g.display_name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
            </span>
            <span className="w-full truncate text-center text-[10px] font-semibold">
              {g.author_id === meUserId ? "Você" : g.display_name.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {openIdx !== null && groups[openIdx] && (
        <StoryViewer
          groups={groups}
          startIndex={openIdx}
          meUserId={meUserId}
          onClose={() => setOpenIdx(null)}
          onDeleted={() => {
            qc.invalidateQueries({ queryKey: ["challenge-stories", challengeId] });
            setOpenIdx(null);
          }}
        />
      )}
    </section>
  );
}
