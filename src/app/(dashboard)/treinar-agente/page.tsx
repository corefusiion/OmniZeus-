"use client";

import { useState, useEffect } from "react";
import { Bot, Sparkles, Plus, Trash2, RefreshCw, Check, X, FileText } from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { getCustomAgents, saveCustomAgent, deleteCustomAgent, CustomAgent } from "@/lib/agents/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function TreinarAgentePage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  
  // Agent Fields
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [agentSpecialty, setAgentSpecialty] = useState("");
  const [agentCategory, setAgentCategory] = useState("Fiscal");
  const [agentModel, setAgentModel] = useState("anthropic/claude-4.8-sonnet");
  const [agentTemperature, setAgentTemperature] = useState<number>(0.7);
  const [agentPrompt, setAgentPrompt] = useState("");
  
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [improvedPromptProposal, setImprovedPromptProposal] = useState<string | null>(null);
  
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setRole(getActiveRole());
    setAgents(getCustomAgents());

    const handleRoleChange = () => setRole(getActiveRole());
    const handleAgentsChange = () => setAgents(getCustomAgents());

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_agents_change", handleAgentsChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_agents_change", handleAgentsChange);
    };
  }, []);

  const handleImproveAgentWithAI = async () => {
    if (!agentName.trim() && !agentPrompt.trim()) {
      setWarningMessage("Por favor, informe o nome do agente ou um rascunho de prompt para o treinamento por IA.");
      return;
    }

    setIsImprovingPrompt(true);

    try {
      const res = await fetch("/api/agents/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName,
          category: agentCategory,
          rawPrompt: agentPrompt,
          model: "anthropic/claude-4.8-sonnet"
        })
      });

      const data = await res.json();
      
      if (res.ok && data.success && data.improvedPrompt) {
        setImprovedPromptProposal(data.improvedPrompt);
      } else {
        setWarningMessage(data.error || "Erro ao tentar melhorar o prompt com a IA.");
      }
    } catch (err) {
      setWarningMessage("Falha de conexão ao tentar melhorar o prompt.");
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  const acceptImprovedPrompt = () => {
    if (improvedPromptProposal) {
      setAgentPrompt(improvedPromptProposal);
      setImprovedPromptProposal(null);
    }
  };

  const rejectImprovedPrompt = () => {
    setImprovedPromptProposal(null);
  };

  const handleCreateAgent = () => {
    if (!agentName.trim() || !agentPrompt.trim()) {
      setWarningMessage("Por favor, preencha o Nome do Agente e o System Prompt.");
      return;
    }

    saveCustomAgent({
      label: agentName.trim(),
      description: agentDescription.trim(),
      specialty: agentSpecialty.trim(),
      category: agentCategory,
      modelLlm: agentModel,
      temperature: agentTemperature,
      systemPrompt: agentPrompt.trim(),
      color: "bg-primary/10 text-primary border-primary/20/60",
      isCustom: true
    });

    setSuccessMessage(`O agente "${agentName}" foi criado e já está disponível no Omni IA Hub!`);
    
    // Clear form
    setAgentName("");
    setAgentDescription("");
    setAgentSpecialty("");
    setAgentPrompt("");
    setAgentTemperature(0.7);
    setImprovedPromptProposal(null);
  };

  const confirmDeleteAgent = () => {
    if (!deletingAgentId) return;
    deleteCustomAgent(deletingAgentId);
    setDeletingAgentId(null);
  };

  if (role === "funcionario") {
    return (
      <div className="p-6 text-center text-slate-500 font-medium">
        Acesso restrito a Gestores e Administradores.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      <ConfirmModal
        isOpen={deletingAgentId !== null}
        onClose={() => setDeletingAgentId(null)}
        onConfirm={confirmDeleteAgent}
        title="Remover Agente Especialista?"
        description="Este agente personalizado não estará mais disponível no menu do Omni IA Hub para nenhum usuário da sua empresa."
        confirmText="Remover Agente"
        cancelText="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={warningMessage !== null}
        onClose={() => setWarningMessage(null)}
        onConfirm={() => setWarningMessage(null)}
        title="Atenção"
        description={warningMessage || ""}
        confirmText="Entendi"
        cancelText="Fechar"
        variant="warning"
      />

      <ConfirmModal
        isOpen={successMessage !== null}
        onClose={() => setSuccessMessage(null)}
        onConfirm={() => setSuccessMessage(null)}
        title="Sucesso"
        description={successMessage || ""}
        confirmText="OK"
        cancelText="Fechar"
        variant="success"
      />

      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Criar & Treinar Agente IA
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Crie personas especializadas com instruções (system prompts) seguras e exclusivas para o seu escritório.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bot className="w-4.5 h-4.5 text-purple-600" />
                <span>Configurações do Agente</span>
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Nome do Agente *</label>
                <input
                  type="text"
                  placeholder="Ex: Auditor SPED Reinf & DCTFWeb"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Categoria *</label>
                <select
                  value={agentCategory}
                  onChange={(e) => setAgentCategory(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Fiscal">Fiscal & SPED</option>
                  <option value="Contábil">Contábil & Balancetes</option>
                  <option value="Jurídico">Jurídico & Contratos</option>
                  <option value="Trabalhista">Trabalhista & eSocial</option>
                  <option value="BPO Financeiro">BPO Financeiro</option>
                  <option value="Geral">Geral Corporativo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Descrição Curta (Visível aos Usuários)</label>
                <input
                  type="text"
                  placeholder="Ex: Auxilia em rotinas de fechamento fiscal e validação de retenções."
                  value={agentDescription}
                  onChange={(e) => setAgentDescription(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Especialidade (Skill Domain)</label>
                <input
                  type="text"
                  placeholder="Ex: Direito Tributário"
                  value={agentSpecialty}
                  onChange={(e) => setAgentSpecialty(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Modelo IA / LLM Base</label>
                <select
                  value={agentModel}
                  onChange={(e) => setAgentModel(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="anthropic/claude-4.8-sonnet">Claude 4.8 Sonnet (Recomendado)</option>
                  <option value="openai/gpt-5.0-pro">GPT-5.0 Pro (Raciocínio Profundo)</option>
                  <option value="google/gemini-3.5-flash">Gemini 3.5 Flash (Velocidade)</option>
                  <option value="deepseek/deepseek-r2">DeepSeek R2 (Econômico)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">System Prompt / Diretrizes Master *</label>
                <span className="text-xs font-medium text-slate-400">Criatividade / Temp: {agentTemperature.toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.1" 
                value={agentTemperature} 
                onChange={e => setAgentTemperature(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer mb-3 accent-primary"
              />
              
              {!improvedPromptProposal ? (
                <textarea
                  rows={8}
                  placeholder="Descreva como o agente deve se comportar, suas regras, limites, e formato de resposta. Ex: 'Você é um assistente tributário...'"
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  className="w-full p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono leading-relaxed focus:outline-none focus:border-primary transition-all"
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg">
                      <div className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1.5"><X className="w-3.5 h-3.5"/> Original (Rascunho)</div>
                      <div className="text-xs font-mono text-slate-600 whitespace-pre-wrap opacity-80 h-48 overflow-y-auto">{agentPrompt}</div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm">
                      <div className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1.5"><Check className="w-3.5 h-3.5"/> Melhorado (Enterprise Grade)</div>
                      <div className="text-xs font-mono text-slate-800 whitespace-pre-wrap h-48 overflow-y-auto">{improvedPromptProposal}</div>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={rejectImprovedPrompt} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Descartar</button>
                    <button onClick={acceptImprovedPrompt} className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                      <Check className="w-4 h-4"/> Substituir pelo Melhorado
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!improvedPromptProposal && (
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleImproveAgentWithAI}
                  disabled={isImprovingPrompt}
                  className="w-full sm:flex-1 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
                >
                  {isImprovingPrompt ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : <Sparkles className="w-4.5 h-4.5 text-purple-600" />}
                  <span>{isImprovingPrompt ? "Engenharia de Prompt em andamento..." : "Melhorar & Treinar Agente com IA"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateAgent}
                  className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:opacity-90 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <Plus className="w-4.5 h-4.5" />
                  <span>Salvar Agente</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 pb-2 border-b border-slate-200/60">
              <FileText className="w-4 h-4" />
              Agentes da Empresa ({agents.filter(a => a.isCustom).length})
            </span>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {agents.filter(a => a.isCustom).length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">
                  Nenhum agente personalizado criado pela sua empresa.
                </div>
              ) : (
                agents.filter(a => a.isCustom).map((agent) => (
                  <div key={agent.id} className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm relative group hover:border-primary/40 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{agent.label}</h3>
                        <div className="flex items-center gap-2 mt-1 mb-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{agent.category}</span>
                          {agent.modelLlm && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600">{agent.modelLlm.split('/')[1] || agent.modelLlm}</span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => setDeletingAgentId(agent.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="Remover agente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {agent.description && (
                      <p className="text-xs text-slate-500 mb-2 line-clamp-2">{agent.description}</p>
                    )}
                    <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 flex justify-between items-center">
                      <span>Criado em: {new Date(agent.createdAt).toLocaleDateString()}</span>
                      {agent.temperature !== undefined && <span>Temp: {agent.temperature}</span>}
                    </div>
                  </div>
                ))
              )}

              {/* Built-in fallback */}
              {agents.filter(a => !a.isCustom).length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200/60">
                   <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Agentes Globais Padrão
                  </span>
                  {agents.filter(a => !a.isCustom).slice(0, 3).map((agent) => (
                    <div key={agent.id} className="text-xs p-2 mb-2 rounded bg-slate-100/50 border border-slate-200/50 text-slate-500">
                      <strong>{agent.label}</strong> ({agent.category})
                    </div>
                  ))}
                  <div className="text-[10px] text-center text-slate-400">Exibindo apenas alguns globais.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
