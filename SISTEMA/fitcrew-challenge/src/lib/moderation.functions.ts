import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normaliza texto: minúsculo + remove acentos.
 * Base para detecção robusta sem depender de acentuação exata.
 */
export function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Escapa metacaracteres de regex.
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detecta ocorrências de palavras proibidas em um texto.
 *
 * - Busca é case-insensitive e "acento-insensitive".
 * - Usa fronteiras de palavra para evitar falso positivo (ex.: "assumir" NÃO casa com "ass").
 * - Retorna os termos originais (como cadastrados) encontrados.
 *
 * O bloqueio de palavras é totalmente configurável via a tabela `banned_words`
 * — admins podem adicionar, remover ou desativar termos sem deploy.
 */
export async function detectBannedTerms(
  supabase: SupabaseClient,
  body: string,
): Promise<string[]> {
  if (!body || !body.trim()) return [];

  const { data, error } = await supabase
    .from("banned_words")
    .select("word")
    .eq("active", true);

  if (error || !data?.length) return [];

  const normalizedBody = normalizeForModeration(body);
  const found = new Set<string>();

  for (const row of data as { word: string }[]) {
    const original = row.word;
    if (!original) continue;
    const normalized = normalizeForModeration(original);
    // \b não trata bem hífens; usamos lookarounds em ASCII para melhor precisão.
    const pattern = new RegExp(
      `(?:^|[^a-z0-9])${escapeRegex(normalized)}(?=$|[^a-z0-9])`,
      "i",
    );
    if (pattern.test(normalizedBody)) {
      found.add(original);
    }
  }

  return Array.from(found);
}

/**
 * Registra advertência do usuário e marca o comentário com os termos ofensivos
 * encontrados. Fluxo educativo: a mensagem NÃO é apagada — apenas destacada
 * no cliente com um aviso automático abaixo.
 */
export async function flagCommentIfNeeded(params: {
  supabase: SupabaseClient;
  userId: string;
  commentTable: "post_comments" | "checkin_comments";
  commentId: string;
  body: string;
}): Promise<string[]> {
  const terms = await detectBannedTerms(params.supabase, params.body);
  if (!terms.length) return [];

  // Não bloqueamos o fluxo se algum update falhar — apenas logamos.
  const { error: updErr } = await params.supabase
    .from(params.commentTable)
    .update({ flagged_terms: terms })
    .eq("id", params.commentId);
  if (updErr) console.error("[moderation] update flagged_terms", updErr);

  const sourceType =
    params.commentTable === "post_comments" ? "post_comment" : "checkin_comment";
  const { error: warnErr } = await params.supabase.from("user_warnings").insert({
    user_id: params.userId,
    source_type: sourceType,
    source_id: params.commentId,
    terms,
  });
  if (warnErr) console.error("[moderation] insert user_warnings", warnErr);

  return terms;
}
