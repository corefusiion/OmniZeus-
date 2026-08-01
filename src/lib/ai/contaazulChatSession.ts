// Chat Session Manager — Omni Conta Azul IA
// Mantém o processamento de consultas de IA FORA do ciclo de vida do componente
// React. Assim, quando o usuário troca de tela (o componente desmonta), o fetch
// continua em segundo plano e, ao voltar, o componente re-sincroniza via evento.

import { getActiveTenantId } from "@/lib/auth/roles";

export const CAI_JOB_EVENT = "omnizeus_contaazul_ia_job_change";

// Estado global de jobs em andamento (sobrevive à navegação)
const pendingJobs: Record<string, boolean> = {};

export function isCaiProcessing(conversationId: string): boolean {
  return Boolean(pendingJobs[conversationId]);
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CAI_JOB_EVENT));
  }
}

export interface CaiJobParams {
  conversationId: string;
  prompt: string;
  model: string;
  fileData?: any;
}

export async function runCaiJob(params: CaiJobParams): Promise<{ ok: boolean; data: any }> {
  const { conversationId } = params;
  if (pendingJobs[conversationId]) {
    return { ok: false, data: null };
  }

  pendingJobs[conversationId] = true;
  notify();

  try {
    const companyId = getActiveTenantId() || "";
    const res = await fetch("/api/contaazul/ia-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-company-id": companyId },
      body: JSON.stringify({
        prompt: params.prompt,
        conversationId: params.conversationId,
        model: params.model,
        attachmentData: params.fileData
      })
    });

    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    console.error("Erro na consulta IA ContaAzul:", err);
    return { ok: false, data: null };
  } finally {
    pendingJobs[conversationId] = false;
    notify();
  }
}
