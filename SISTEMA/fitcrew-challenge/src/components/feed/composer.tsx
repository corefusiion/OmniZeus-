import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MentionTextarea } from "@/components/feed/mention-textarea";
import { supabase } from "@/integrations/supabase/client";
import { createPost } from "@/lib/posts.functions";
import { classifyAndCommentPost } from "@/lib/coach.functions";
import { uploadPostMedia } from "@/lib/timeline.queries";

export function Composer() {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createPost);
  const coachFn = useServerFn(classifyAndCommentPost);

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: me } = useQuery({
    queryKey: ["composer-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      return { userId: u.user.id, profile: data };
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!body.trim() && !file) throw new Error("Escreva algo ou anexe uma foto.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada.");
      let mediaUrl: string | null = null;
      if (file) mediaUrl = await uploadPostMedia(u.user.id, file);
      return await createFn({
        data: { body: body.trim() || "📸", mediaUrl },
      });
    },
    onSuccess: (res) => {
      toast.success("Post publicado!");
      setBody("");
      setFile(null);
      setPreview(null);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      if (res?.id) {
        coachFn({ data: { postId: res.id } })
          .then(() => queryClient.invalidateQueries({ queryKey: ["timeline"] }))
          .catch(() => {});
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const initials = (me?.profile?.display_name ?? "?").slice(0, 2).toUpperCase();
  const first = me?.profile?.display_name?.split(" ")[0] ?? "você";

  // Uma frase por dia da semana (0 = domingo)
  const prompts = [
    `Bora começar a semana leve, ${first}?`,
    `Qual a boa de hoje, ${first}?`,
    `Cadê o treino de terça, ${first}?`,
    `Meio de semana, meio caminho — e aí, ${first}?`,
    `Já suou hoje, ${first}?`,
    `Sextou! Bora treinar, ${first}?`,
    `Fechando a semana com chave de ouro, ${first}?`,
  ];
  const placeholder = prompts[new Date().getDay()];

  return (
    <div className="mb-6 rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <Avatar className="size-10 shrink-0 border border-border">
          <AvatarImage src={me?.profile?.avatar_url ?? undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-left text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
              {placeholder}
            </button>

          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Novo post</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 border border-border">
                  <AvatarImage src={me?.profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <p className="font-display font-bold">{me?.profile?.display_name}</p>
              </div>
              <MentionTextarea
                autoFocus
                rows={5}
                maxLength={2000}
                value={body}
                onChange={setBody}
                placeholder="Bora, crew! Use @ para mencionar alguém…"
                className="resize-none border-none bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              />

              {preview && (
                <div className="relative overflow-hidden rounded-2xl bg-secondary">
                  <img src={preview} alt="Prévia" className="max-h-72 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onFile(null)}
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-background/90 text-foreground shadow"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />

              <div className="flex items-center justify-between rounded-2xl border border-border p-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <ImagePlus className="size-4" /> Foto
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {body.length}/2000
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => submit.mutate()}
                disabled={submit.isPending || (!body.trim() && !file)}
                className="rounded-full shadow-flame"
              >
                {submit.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Publicando…
                  </>
                ) : (
                  "Publicar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
        <button
          onClick={() => {
            fileRef.current?.click();
            setOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ImagePlus className="size-4" /> Foto
        </button>
        <Button asChild className="rounded-full shadow-flame">
          <Link to="/checkin">
            <Camera className="mr-1 size-4" /> Fazer check-in
          </Link>
        </Button>
      </div>
    </div>
  );
}
