// Agent Context Builder — Multi-Tenant AI Context Fusion Engine
// Combines native agent Base System Prompts with the active Company's specific Context and Rules.
// ATENÇÃO: este módulo roda NO SERVIDOR (dentro de rotas de API). Por isso lê o
// banco diretamente via readDb — NUNCA via fetchServerTable (URL relativa, só
// funciona no browser; causaria ERR_INVALID_URL no runtime Node).

import { readDb } from "../db/localDb";

export interface CompanyContextParams {
  companyId: string;
  agentId?: string;
  baseSystemPrompt?: string;
}

export async function buildAgentSystemPrompt(params: CompanyContextParams): Promise<string> {
  const { companyId, agentId, baseSystemPrompt = "" } = params;

  let companyContextBlock = "";

  if (companyId) {
    try {
      const db = await readDb();
      const companies = Array.isArray(db?.companies) ? db.companies : [];
      const company = companies.find((c: any) => c.id === companyId);
      if (company) {
        const corpName = company.corporate_name || company.corporateName || "";
        const tradeName = company.tradeName || company.trade_name || corpName;
        const cnpj = company.cnpj || "";
        const city = company.city || "";
        const state = company.state || "";
        const plan = company.plan || "Premium";
        const contextText = company.company_context || company.companyContext || "";
        const aiNotesText = company.ai_notes || company.aiNotes || "";

        companyContextBlock = `
[CONTEXTO INSTITUCIONAL DA EMPRESA ATIVA (TENANT: ${companyId})]
- Empresa Contratante: ${tradeName} (${corpName})
- CNPJ: ${cnpj} | Localização: ${city}/${state} | Plano SaaS: ${plan}
${contextText ? `- Descrição / Operação / Perfil da Empresa: ${contextText}` : ""}
${aiNotesText ? `- Regras Internas & Observações para a IA: ${aiNotesText}` : ""}
[FIM DO CONTEXTO INSTITUCIONAL]`;
      }
    } catch (e) {
      console.error("[agentContextBuilder] Erro ao buscar contexto da empresa:", e);
    }
  }

  const multiTenantSecurityBlock = `
[REGRAS RÍGIDAS DE ISOLAMENTO E SEGURANÇA MULTI-TENANT]
1. Você está operando estritamente dentro do contexto do Tenant/Empresa '${companyId || 'ativa'}'.
2. NUNCA mencione, acesse ou compartilhe dados de outras empresas ou tenants.
3. Todas as orientações fiscais, contábeis e de BPO financeiro devem respeitar o perfil e segmento desta empresa.`;

  return `${baseSystemPrompt.trim()}

${companyContextBlock.trim()}

${multiTenantSecurityBlock.trim()}`.trim();
}
