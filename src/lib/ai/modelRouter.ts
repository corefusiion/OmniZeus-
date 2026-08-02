// Roteador Inteligente de Modelos — reduz custo de IA roteando consultas
// simples para o modelo econômico (gemini-2.5-flash) e mantendo as complexas
// no modelo selecionado pelo usuário. Heurística leve: sem custo de classificação.

// Modelo econômico: US$ 0,075/M prompt + US$ 0,30/M completion (vs. claude-3.7-sonnet
// a US$ 3,00/US$ 15,00) — até ~40x mais barato nas consultas triviais.
export const ECONOMIC_MODEL = "google/gemini-2.5-flash";

// Palavras/prefixos típicos de interações triviais que não exigem análise
const TRIVIAL_PATTERNS = [
  /^(oi|ola|olá|bom dia|boa tarde|boa noite|obrigado|obrigada|valeu|tks|thanks|ok|okay|sim|não|nao|tudo bem|tudo certo)[\s!?.,]*$/i,
  /^(quem é você|quem e voce|o que você faz|o que voce faz|o que é omni|o que e omni|me ajuda|como funciona|help|ajuda)[\s?]*$/i,
  /^(teste|test|testando|hello|hi|hey)[\s!?]*$/i,
];

// Se a consulta contiver números de valores, datas, códigos ou pedir análise,
// ela NUNCA é simples (evita resposta rasa em pergunta financeira curta).
const COMPLEX_HINTS = [
  /\bR\$\s?\d/,
  /\b\d{1,3}(\.\d{3})*(,\d{2})?\b/,
  /\b(analis|calcule|compare|resuma|explique|projet|crie|gere|escreva|redija)\b/i,
  /\b(contrato|boleto|nota|pagamento|receber|pagar|fatura|tributo|imposto|sped|dre)\b/i,
];

/**
 * Heurística: consulta simples = curta, sem números/pedidos de análise,
 * sem palavras de contexto financeiro.
 */
export function isSimpleQuery(text: string): boolean {
  if (!text) return true;
  const clean = text.trim();
  if (clean.length > 90) return false;
  if (COMPLEX_HINTS.some(r => r.test(clean))) return false;
  if (TRIVIAL_PATTERNS.some(r => r.test(clean))) return true;
  // Muito curta e sem conteúdo estruturado → simples
  return clean.split(/\s+/).length <= 4;
}

/**
 * Decide o modelo real para o /api/chat: consultas simples vão para o modelo
 * econômico; as demais usam o modelo solicitado (ou o default do sistema).
 */
export function routeModel(requestedModel: string | undefined, lastUserText: string): string {
  if (isSimpleQuery(lastUserText)) return ECONOMIC_MODEL;
  return requestedModel || "anthropic/claude-3.7-sonnet";
}
