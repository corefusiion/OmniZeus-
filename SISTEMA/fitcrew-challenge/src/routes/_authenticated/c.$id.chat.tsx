import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/feed/mention-textarea";
import { RenderMentions } from "@/components/render-mentions";
import { RelativeTime } from "@/components/relative-time";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteChallengeMessage,
  listChallengeMessages,
  listMyRecentCheckins,
  sendChallengeMessage,
  type ChatMessage,
} from "@/lib/chat.functions";
import { getChallengeHub } from "@/lib/challenge-hub.functions";

export const Route = createFileRoute("/_authenticated/c/$id/chat")({
  component: ChallengeChatPage,
});

function ChallengeChatPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(listChallengeMessages);
  const sendFn = useServerFn(sendChallengeMessage);
  const deleteFn = useServerFn(deleteChallengeMessage);
  const listCheckinsFn = useServerFn(listMyRecentCheckins);
  const hubFn = useServerFn(getChallengeHub);

  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const { data: hub } = useQuery({
    queryKey: ["challenge-hub", id],
    queryFn: () => hubFn({ data: { challengeId: id } }),
    staleTime: 60_000,
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat", id],
    queryFn: () => listFn({ data: { challengeId: id } }),
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "challenge_messages", filter: `challenge_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat", id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "challenge_messages", filter: `challenge_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat", id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  // Scroll to bottom when messages change
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Mark chat as read for the launcher badge
  useEffect(() => {
    try {
      const latest = messages.reduce<string | null>(
        (acc, m: any) => (!acc || m.created_at > acc ? m.created_at : acc),
        null,
      );
      const stamp = latest ?? new Date().toISOString();
      window.localStorage.setItem(`fitcrew:chat-read:${id}`, stamp);
      window.dispatchEvent(new CustomEvent("fitcrew:chat-read", { detail: { id } }));
    } catch {
      /* ignore */
    }
  }, [id, messages.length]);

  const inviteUrl =
    typeof window !== "undefined" && hub?.challenge.invite_code
      ? `${window.location.origin}/join/${hub.challenge.invite_code}`
      : "";

  // Composer state
  const [body, setBody] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          challengeId: id,
          body: body.trim() || undefined,
          image_url: imagePath ?? undefined,
          checkin_id: checkinId ?? undefined,
        },
      }),
    onSuccess: () => {
      setBody("");
      setImagePath(null);
      setImagePreview(null);
      setCheckinId(null);
      qc.invalidateQueries({ queryKey: ["chat", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (mid: string) => deleteFn({ data: { id: mid } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadImage = async (file: File) => {
    if (!me) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 8MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${me}/${id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 3600);
      setImagePath(path);
      setImagePreview(signed?.signedUrl ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (sendMut.isPending || uploading) return;
    if (!body.trim() && !imagePath && !checkinId) return;
    // /convite slash-command
    if (body.trim() === "/convite" && inviteUrl) {
      setBody(`Bora treinar juntos! ${inviteUrl}`);
      return;
    }
    sendMut.mutate();
  };

  return (
    <div className="flex flex-col gap-4 pb-32 lg:pb-8">
      <div
        ref={scrollRef}
        className="flex-1 space-y-1 overflow-y-auto rounded-3xl border border-border bg-card p-3 shadow-soft"
        style={{ minHeight: "50vh", maxHeight: "calc(100vh - 340px)" }}
      >
        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="grid place-items-center py-16 text-center text-sm text-muted-foreground">
            <div>
              <p className="font-semibold">Ainda não há mensagens.</p>
              <p className="mt-1 text-xs">Manda um oi e chama a galera 👋</p>
            </div>
          </div>
        ) : (
          <MessageGroups messages={messages} meId={me} onDelete={(mid) => deleteMut.mutate(mid)} />
        )}
      </div>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-background/95 px-3 py-3 backdrop-blur-xl lg:static lg:mt-2 lg:rounded-3xl lg:border lg:border-border lg:bg-card lg:p-3 lg:shadow-soft">
        {(imagePreview || checkinId) && (
          <div className="mb-2 flex items-center gap-2">
            {imagePreview && (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Prévia"
                  className="size-16 rounded-xl border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePath(null);
                    setImagePreview(null);
                  }}
                  className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            {checkinId && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                <Paperclip className="size-3.5" />
                <span className="font-semibold">Check-in anexado</span>
                <button type="button" onClick={() => setCheckinId(null)}>
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        )}
        <MentionTextarea
          value={body}
          onChange={setBody}
          placeholder="Escreva uma mensagem…  (use @ para mencionar, /convite para link)"
          rows={2}
          maxLength={2000}
          className="resize-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <label className="cursor-pointer rounded-full border border-border bg-card p-2 hover:bg-secondary">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage(f);
                e.target.value = "";
              }}
              disabled={uploading}
            />
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
          </label>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-full border border-border bg-card p-2 hover:bg-secondary"
            title="Anexar check-in"
          >
            <Paperclip className="size-4" />
          </button>
          {inviteUrl && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                toast.success("Link copiado!");
              }}
              className="rounded-full border border-border bg-card p-2 hover:bg-secondary"
              title="Copiar link de convite"
            >
              <LinkIcon className="size-4" />
            </button>
          )}
          <div className="flex-1" />
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={sendMut.isPending || uploading || (!body.trim() && !imagePath && !checkinId)}
            className="rounded-full"
          >
            {sendMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="ml-1">Enviar</span>
          </Button>
        </div>

        {pickerOpen && (
          <CheckinPicker
            challengeId={id}
            fetchFn={(payload) => listCheckinsFn({ data: payload })}
            onPick={(cid) => {
              setCheckinId(cid);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function MessageGroups({
  messages,
  meId,
  onDelete,
}: {
  messages: ChatMessage[];
  meId: string | null;
  onDelete: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      const day = new Date(m.created_at).toLocaleDateString("pt-BR");
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(m);
    }
    return Array.from(map.entries());
  }, [messages]);

  return (
    <>
      {groups.map(([day, msgs]) => (
        <div key={day} className="space-y-1.5">
          <div className="sticky top-0 z-10 mx-auto my-2 w-max rounded-full bg-secondary/80 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
            {day}
          </div>
          {msgs.map((m) => (
            <Bubble key={m.id} msg={m} isMe={m.user_id === meId} onDelete={onDelete} />
          ))}
        </div>
      ))}
    </>
  );
}

function Bubble({
  msg,
  isMe,
  onDelete,
}: {
  msg: ChatMessage;
  isMe: boolean;
  onDelete: (id: string) => void;
}) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    if (!msg.image_url) return;
    supabase.storage
      .from("chat-media")
      .createSignedUrl(msg.image_url, 3600)
      .then(({ data }) => setSigned(data?.signedUrl ?? null));
  }, [msg.image_url]);

  return (
    <div className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      {!isMe && (
        <Avatar className="size-7 border border-border">
          <AvatarImage src={msg.author.avatar_url ?? undefined} />
          <AvatarFallback>{msg.author.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`group max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-soft ${
          isMe
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-secondary text-foreground"
        }`}
      >
        {!isMe && (
          <p className="text-[10px] font-semibold text-muted-foreground">
            {msg.author.username ? `@${msg.author.username}` : msg.author.display_name}
          </p>
        )}
        {signed && (
          <img
            src={signed}
            alt="Mensagem"
            className="mb-1 mt-0.5 max-h-64 rounded-xl object-cover"
          />
        )}
        {msg.checkin && (
          <Link
            to="/feed"
            className={`mb-1 mt-0.5 flex items-center gap-2 rounded-xl border p-2 text-xs ${
              isMe
                ? "border-primary-foreground/30 bg-primary-foreground/10"
                : "border-border bg-card text-foreground"
            }`}
          >
            {msg.checkin.photo_url && (
              <img
                src={msg.checkin.photo_url}
                alt=""
                className="size-10 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {msg.checkin.exercise_name ?? "Check-in"} · +{msg.checkin.points_awarded ?? 0} pts
              </p>
              {msg.checkin.caption && (
                <p className="truncate opacity-80">{msg.checkin.caption}</p>
              )}
            </div>
          </Link>
        )}
        {msg.body && (
          <p className="whitespace-pre-wrap break-words">
            <RenderMentions text={msg.body} />
          </p>
        )}
        <div
          className={`mt-0.5 flex items-center gap-1.5 text-[10px] ${
            isMe ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          <RelativeTime iso={msg.created_at} />
          {isMe && (
            <button
              type="button"
              onClick={() => onDelete(msg.id)}
              className="opacity-0 transition group-hover:opacity-100"
              aria-label="Apagar mensagem"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckinPicker({
  challengeId,
  fetchFn,
  onPick,
  onClose,
}: {
  challengeId: string;
  fetchFn: (payload: { challengeId: string }) => Promise<any[]>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-recent-checkins", challengeId],
    queryFn: () => fetchFn({ challengeId }),
  });

  return (
    <div className="absolute inset-x-3 bottom-full mb-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-lg lg:inset-x-0">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Anexar check-in
        </p>
        <button type="button" onClick={onClose}>
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>
      {isLoading ? (
        <div className="grid place-items-center py-6">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-muted-foreground">
          Você ainda não tem check-ins neste desafio.
        </p>
      ) : (
        <div className="space-y-1">
          {data.map((c: any) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-secondary"
            >
              {c.photo_url && (
                <img src={c.photo_url} alt="" className="size-10 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {c.exercise_name ?? "Check-in"} · +{c.points_awarded ?? 0} pts
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(c.occurred_on + "T00:00:00").toLocaleDateString("pt-BR")}
                  {c.caption ? ` · ${c.caption}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
