import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateImage } from "@/lib/ai-provider.server";


const BUCKET = "challenge-banners";
const SIGN_TTL = 60 * 60 * 24 * 7; // 7 dias

const STYLES = [
  {
    id: "photo",
    label: "Fotografia esportiva",
    template: (name: string, seed: string) =>
      `Banner horizontal cinematográfico de desafio fitness intitulado "${name}". Estilo fotografia esportiva realista, iluminação de academia dramática, alta energia, atleta em ação, composição wide 16:9. Renderize o TÍTULO EXATO "${name}" em letras grandes, tipografia bold sans-serif moderna, integrado à cena com efeito de luz/sombra, perfeitamente legível, sem erros de ortografia. seed:${seed}`,
  },
  {
    id: "flat",
    label: "Ilustração flat",
    template: (name: string, seed: string) =>
      `Banner horizontal de desafio fitness intitulado "${name}". Estilo ilustração vetorial flat design, cores vibrantes (laranja, vermelho, preto), moderno, composição wide 16:9. Renderize o TÍTULO EXATO "${name}" em destaque, tipografia bold geométrica, cores contrastantes, perfeitamente legível, sem erros de ortografia. seed:${seed}`,
  },
  {
    id: "neon3d",
    label: "Render 3D neon",
    template: (name: string, seed: string) =>
      `Banner horizontal de desafio fitness intitulado "${name}". Estilo render 3D abstrato com neon laranja e roxo, atmosfera academia noturna, alto contraste, composição wide 16:9. Renderize o TÍTULO EXATO "${name}" em letras 3D com efeito neon brilhante, tipografia bold, perfeitamente legível, sem erros de ortografia. seed:${seed}`,
  },
] as const;

async function assertAdmin(supabase: any, userId: string, challengeId: string) {
  const { data } = await supabase.rpc("is_challenge_admin", {
    _user_id: userId,
    _challenge_id: challengeId,
  });
  if (!data) throw new Error("Somente o ADM do desafio pode alterar a capa.");
}

async function generateOneImage(prompt: string): Promise<string> {
  return await generateImage(prompt);
}


function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const BANNER_GEN_LIMIT = 2;

export const generateChallengeBanners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.challengeId);
    const supabase = context.supabase;

    // Fetch challenge name + current generation count
    const { data: ch } = await supabase
      .from("challenges")
      .select("name, banner_generations_used")
      .eq("id", data.challengeId)
      .single();
    const name = (ch?.name as string) ?? "desafio fitness";
    const used: number = ((ch as any)?.banner_generations_used ?? 0) as number;

    // super_admin bypassa o limite
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });

    if (!isSuper && used >= BANNER_GEN_LIMIT) {
      throw new Error(
        `Limite de ${BANNER_GEN_LIMIT} gerações de capa por desafio atingido. Em breve teremos moedas para desbloquear mais 🪙`,
      );
    }

    const generations = await Promise.allSettled(
      STYLES.map(async (style) => {
        const seed = crypto.randomUUID();
        const prompt = style.template(name, seed);
        const b64 = await generateOneImage(prompt);
        const bytes = b64ToBytes(b64);
        const path = `${data.challengeId}/${crypto.randomUUID()}.png`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: "image/png", upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: signed, error: signErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGN_TTL);
        if (signErr || !signed) throw new Error(signErr?.message ?? "Falha ao assinar URL.");
        return { style: style.id, label: style.label, path, signedUrl: signed.signedUrl };
      }),
    );

    const options = generations
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<{ style: string; label: string; path: string; signedUrl: string }>).value);

    if (options.length === 0) {
      const firstErr = generations.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      throw new Error(firstErr?.reason?.message ?? "Falha ao gerar imagens.");
    }

    // Incrementa o contador (não conta para super_admin)
    let newUsed = used;
    if (!isSuper) {
      newUsed = used + 1;
      await (supabase as any)
        .from("challenges")
        .update({ banner_generations_used: newUsed })
        .eq("id", data.challengeId);
    }

    return {
      options,
      used: newUsed,
      limit: BANNER_GEN_LIMIT,
      remaining: isSuper ? Number.POSITIVE_INFINITY : Math.max(0, BANNER_GEN_LIMIT - newUsed),
      unlimited: !!isSuper,
    };
  });

export const setChallengeBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        path: z.string().min(1).max(300),
        discardPaths: z.array(z.string().min(1).max(300)).max(5).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.challengeId);
    // Segurança: path deve começar com <challengeId>/
    if (!data.path.startsWith(`${data.challengeId}/`)) {
      throw new Error("Caminho de imagem inválido.");
    }
    const supabase = context.supabase;

    const { error } = await (supabase as any)
      .from("challenges")
      .update({ banner_url: data.path })
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);

    // Descarta os não escolhidos
    const toRemove = (data.discardPaths ?? []).filter(
      (p) => p !== data.path && p.startsWith(`${data.challengeId}/`),
    );
    if (toRemove.length > 0) {
      await supabase.storage.from(BUCKET).remove(toRemove).catch(() => undefined);
    }

    return { ok: true, path: data.path };
  });

export const getBannerSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ path: z.string().min(1).max(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("challenge-banners")
      .createSignedUrl(data.path, SIGN_TTL, {
        transform: { width: 1200, quality: 75, resize: "cover" },
      });
    if (error || !signed) throw new Error(error?.message ?? "Falha ao assinar URL.");
    return { url: signed.signedUrl };
  });

