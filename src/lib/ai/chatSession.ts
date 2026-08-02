// Chat Session Manager — Omni IA Hub
// Mantém o processamento de consultas de IA FORA do ciclo de vida do componente
// React. Assim, quando o usuário troca de tela (o componente desmonta), o fetch
// continua em segundo plano, a resposta é persistida no banco e, ao voltar,
// o componente re-sincroniza via evento.

import { fetchServerSettings, insertServerTable, updateServerTableRecord } from "@/lib/db/serverDb";

export interface ChatJobParams {
  conversationId: string;
  messages: { role: "user" | "assistant"; content: string }[];
  prompt: string;
  model: string;
  persona: string;
  personaPrompt?: string;
  personaName?: string;
  temperature?: number;
  activeCompanyId: string;
  userId?: string;
}

export const OMNIIA_JOB_EVENT = "omnizeus_omniia_job_change";
export const OMNIIA_MESSAGE_EVENT = "omnizeus_omniia_message_persisted";

// Estado global de jobs em andamento (sobrevive à navegação)
const pendingJobs: Record<string, boolean> = {};

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OMNIIA_JOB_EVENT));
  }
}

export function isConversationProcessing(conversationId: string): boolean {
  return Boolean(pendingJobs[conversationId]);
}

export function getProcessingConversationIds(): string[] {
  return Object.keys(pendingJobs).filter((k) => pendingJobs[k]);
}

function sanitizeForStorage(text: string): string {
  return text || "Resposta processada com sucesso.";
}

export async function runChatJob(params: ChatJobParams): Promise<void> {
  const { conversationId } = params;
  if (pendingJobs[conversationId]) return; // já em andamento

  pendingJobs[conversationId] = true;
  notify();

  const placeholderId = `msg_pending_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const startedAt = new Date().toISOString();

  try {
    // 1. Persiste uma mensagem de "Processando" para que, se o usuário sair e
    //    voltar (ou der F5), a conversa mostre o estado de processamento.
    await insertServerTable("messages", {
      id: placeholderId,
      conversation_id: conversationId,
      sender: "ai",
      text: "__PROCESSING__",
      model: params.model,
      pending: true,
      created_at: startedAt
    });
  } catch (e) {
    console.error("Erro ao persistir placeholder de processamento:", e);
  }

  let res: Response | null = null;
  try {
    const settings = await fetchServerSettings();
    const savedKey = settings?.openrouter_api_key || null;

    res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(savedKey ? { "x-openrouter-key": savedKey } : {}),
        ...(params.activeCompanyId ? { "x-company-id": params.activeCompanyId } : {})
      },
      body: JSON.stringify({
        messages: params.messages,
        model: params.model,
        temperature: params.temperature !== undefined ? params.temperature : undefined,
        persona: params.persona,
        personaName: params.personaName,
        personaPrompt: params.personaPrompt,
        clientApiKey: savedKey || undefined
        // NOTA: NÃO enviamos conversationId para o servidor. Assim o /api/chat
        // NÃO grava uma segunda mensagem — quem gerencia o placeholder→resposta
        // é este módulo (via /api/db), evitando duplicação e race de escrita.
      }),
    });

    let aiResponseText = "";
    if (res.ok) {
      aiResponseText = await res.text();
    } else {
      throw new Error("Falha na rota de streaming");
    }

    // Sincroniza o saldo de coins (o servidor debitou).
    try {
      const { fetchCoinBalanceFromServer } = await import("@/lib/coins/store");
      await fetchCoinBalanceFromServer(params.activeCompanyId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("omnizeus_coins_change"));
      }
    } catch (e) {}

    const finalText = sanitizeForStorage(aiResponseText);

    // Atualiza o placeholder com o texto final real (fallback ou resposta).
    try {
      await updateServerTableRecord("messages", {
        id: placeholderId,
        text: finalText,
        pending: false
      });
    } catch (e) {
      console.error("Erro ao atualizar resposta da IA:", e);
    }
  } catch (err) {
    const fallbackText = "Estamos enfrentando uma instabilidade temporária no servidor de IA.";
    try {
      await updateServerTableRecord("messages", {
        id: placeholderId,
        text: fallbackText,
        pending: false
      });
    } catch (e) {}
  } finally {
    pendingJobs[conversationId] = false;
    notify();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(OMNIIA_MESSAGE_EVENT));
    }
  }
}
