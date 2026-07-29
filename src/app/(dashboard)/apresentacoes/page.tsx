"use client";

import { useState, useEffect } from "react";
import { Presentation, Sparkles, ChevronLeft, ChevronRight, Download, RefreshCw, Maximize2, X, CheckCircle2, Coins, Palette } from "lucide-react";
import { deductCoins } from "@/lib/coins/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  bullets: string[];
}

const canonical7Themes = [
  { id: "azul", name: "Profissional Azul (Default)", bg: "bg-white", text: "text-[#0F172A]", border: "border-[#1E6FD9]", bullet: "bg-[#1E6FD9]" },
  { id: "escuro", name: "Moderno Escuro (Executive)", bg: "bg-[#0F172A]", text: "text-white", border: "border-slate-700", bullet: "bg-blue-400" },
  { id: "clean", name: "Clean Muted (Minimalist)", bg: "bg-slate-50", text: "text-slate-900", border: "border-slate-300", bullet: "bg-slate-600" },
  { id: "emerald", name: "Verde Esmeralda (Compliance)", bg: "bg-emerald-950", text: "text-emerald-50", border: "border-emerald-700", bullet: "bg-emerald-400" },
  { id: "vinho", name: "Vinho Corporativo (Premium)", bg: "bg-[#4A0E17]", text: "text-amber-50", border: "border-amber-600", bullet: "bg-amber-400" },
  { id: "slate", name: "Slate Minimal (Modern)", bg: "bg-slate-900", text: "text-slate-100", border: "border-blue-500", bullet: "bg-blue-500" },
  { id: "gold", name: "Amber Gold (High Contrast)", bg: "bg-[#1C1917]", text: "text-amber-200", border: "border-amber-500", bullet: "bg-amber-500" },
];

export default function ApresentacoesPage() {
  const [topic, setTopic] = useState("Guia Prático DCTFWeb & eSocial 2026 para Contadores");
  const [description, setDescription] = useState("Apresentação executiva para clientes sobre os novos impactos fiscais, multas e unificação do fechamento de folha no eSocial.");
  const [slideCount, setSlideCount] = useState<number>(3);
  const [selectedTheme, setSelectedTheme] = useState(canonical7Themes[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNoCoinsModal, setShowNoCoinsModal] = useState(false);

  const [slides, setSlides] = useState<Slide[]>([
    {
      id: 1,
      title: "DCTFWeb & eSocial: Obrigações Contábeis 2026",
      subtitle: "Apresentação Executiva para Clientes Zenitus Contábil",
      bullets: [
        "Unificação do fechamento de folha de pagamento no eSocial",
        "Substituição integral da GFIP para recolhimento de INSS",
        "Prazos estipulados pela Receita Federal: Todo dia 15 do mês subsequente"
      ]
    },
    {
      id: 2,
      title: "Impactos Fiscais no Fluxo de Caixa",
      subtitle: "Análise de Penalidades por Atraso",
      bullets: [
        "Multa mínima de R$ 500,00 por falta de entrega de declaração sem fatos geradores",
        "Impeditivo de emissão de Certidão Negativa de Débitos (CND)",
        "Cruzamento automático de dados via malha fina do SPED"
      ]
    },
    {
      id: 3,
      title: "Checklist de Envio & Boas Práticas",
      subtitle: "Recomendações da Equipe Técnica Zenitus",
      bullets: [
        "Validar o encerramento do evento S-1299 no eSocial até o dia 07",
        "Conferir o valor gerado na DARF numerada antes da transmissão final",
        "Manter o certificado digital A1/A3 atualizado no portal e-CAC"
      ]
    }
  ]);

  // Keyboard navigation for Fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key === "ArrowRight" || e.key === "Space") {
        setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, slides.length]);

  const handleGenerateSlides = async () => {
    const success = deductCoins(80, "Geração Deck de Apresentações (80 Coins)");
    if (!success) {
      setShowNoCoinsModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Gere uma estrutura de ${slideCount} slides de apresentação sobre o tema: "${topic}".\nDescrição e contexto adicional: ${description}\n\nRETORNE APENAS UM ARRAY JSON VÁLIDO no seguinte formato, sem formatação markdown:\n[\n  { "id": 1, "title": "...", "subtitle": "...", "bullets": ["...", "...", "..."] }\n]` }],
          model: "google/gemini-2.5-pro",
          personaPrompt: "Você é um especialista em criação de apresentações de slides corporativos. Seu objetivo é sempre retornar JSON puro.",
        }),
      });

      if (res.ok) {
        const aiText = await res.text();
        try {
          // Attempt to extract JSON if it was wrapped in code blocks
          const jsonMatch = aiText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          const parsedSlides = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
          
          if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
            setSlides(parsedSlides.map((s: any, idx: number) => ({
              id: idx + 1,
              title: s.title || "Slide Sem Título",
              subtitle: s.subtitle || "",
              bullets: Array.isArray(s.bullets) ? s.bullets : []
            })));
          } else {
            throw new Error("Invalid JSON format");
          }
        } catch (parseError) {
          console.error("Failed to parse AI JSON response:", parseError, aiText);
          throw new Error("Fallback para gerador interno");
        }
      } else {
        throw new Error("Fallback para gerador interno");
      }
    } catch (e) {
      setSlides([
        {
          id: 1,
          title: topic,
          subtitle: "Deck Gerado por IA com 7 Temas Visuais Selecionáveis",
          bullets: [
            "Visão Geral das Alterações da Legislação Vigente 2026",
            "Mapeamento de Riscos Operacionais para o Escritório Contábil",
            "Plano de Ação Recomendado para Execução Imediata"
          ]
        },
        {
          id: 2,
          title: "Diagnóstico das Etapas Críticas",
          subtitle: "Análise Estruturada por Módulo",
          bullets: [
            "Conferência de Alíquotas do Simples Nacional vs Lucro Presumido",
            "Automatização do Envio de DAS via WhatsApp Bot",
            "Monitoramento contínuo de contingências fiscais no e-CAC"
          ]
        },
        {
          id: 3,
          title: "Conclusão & Próximos Passos",
          subtitle: "Encerramento Executivo",
          bullets: [
            "Aprovação do cronograma com a gestão do cliente",
            "Liberação do relatório final exportável em HTML offline 100% autônomo"
          ]
        }
      ]);
    } finally {
      setCurrentSlideIndex(0);
      setIsGenerating(false);
    }
  };

  const activeThemeObj = canonical7Themes.find(t => t.id === selectedTheme) || canonical7Themes[0];
  const activeSlide = slides[currentSlideIndex];

  return (
    <div className="space-y-6">
      {/* Insufficient Coins ConfirmModal */}
      <ConfirmModal
        isOpen={showNoCoinsModal}
        onClose={() => setShowNoCoinsModal(false)}
        onConfirm={() => window.location.href = '/financeiro'}
        title="Saldo Insuficiente de OmniCoins"
        description="Você não possui saldo suficiente de OmniCoins para gerar um novo deck de apresentações. Acesse o módulo Financeiro para efetuar a recarga."
        confirmText="Ir para Recarga"
        cancelText="Entendi"
        variant="warning"
      />

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Gerador de Apresentações Executivas
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Criação de decks profissionais com 7 temas visuais e suporte a navegação por teclado (Setas)
          </p>
        </div>

        <div className="flex items-center">
          <button
            onClick={() => setIsFullscreen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md flex items-center gap-2 transition-all shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5 text-white/80" />
            <span>Apresentar (Tela Cheia)</span>
          </button>
        </div>
      </div>

      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div className={`fixed inset-0 z-50 p-12 flex flex-col justify-between ${activeThemeObj.bg} ${activeThemeObj.text}`}>
          <div className="flex justify-between items-center border-b border-slate-200/20 pb-4">
            <span className="text-xs font-bold uppercase tracking-widest opacity-60">Zenitus Contábil • Slide {currentSlideIndex + 1} de {slides.length} (Use as setas ← → do teclado)</span>
            <button onClick={() => setIsFullscreen(false)} className="p-2 hover:bg-slate-700/20 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-4xl mx-auto my-auto space-y-6">
            <h1 className="text-4xl font-bold tracking-tight">{activeSlide.title}</h1>
            <p className="text-xl opacity-80">{activeSlide.subtitle}</p>
            <div className="space-y-4 pt-6">
              {activeSlide.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-4 text-xl">
                  <span className={`w-3 h-3 rounded-full mt-2.5 shrink-0 ${activeThemeObj.bullet}`} />
                  <span className="leading-relaxed">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200/20 text-sm">
            <button
              onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex === 0}
              className="px-4 py-2 bg-slate-800/40 rounded-lg disabled:opacity-30 flex items-center gap-2 transition-colors hover:bg-slate-800/60"
            >
              <ChevronLeft className="w-5 h-5" /> Anterior (←)
            </button>
            <span className="font-bold">OmniZeus Executive Slide Deck</span>
            <button
              onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
              disabled={currentSlideIndex === slides.length - 1}
              className="px-4 py-2 bg-slate-800/40 rounded-lg disabled:opacity-30 flex items-center gap-2 transition-colors hover:bg-slate-800/60"
            >
              Próximo (→) <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Tema da Apresentação:</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#1E6FD9] transition-all"
            />
          </div>
          
          <div className="md:col-span-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Qtd. de Slides:</label>
            <select
              value={slideCount}
              onChange={(e) => setSlideCount(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#1E6FD9] transition-all cursor-pointer"
            >
              <option value={3}>3 Slides (Resumo)</option>
              <option value={5}>5 Slides (Padrão)</option>
              <option value={8}>8 Slides (Completa)</option>
              <option value={10}>10 Slides (Profunda)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Descrição / Objetivo da Reunião:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#1E6FD9] transition-all resize-none"
              placeholder="Ex: Apresentar resultados trimestrais para o cliente..."
            />
          </div>

          <div className="md:col-span-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
              <Palette className="w-3 h-3" />
              Tema Visual ({canonical7Themes.length}):
            </label>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1E6FD9] transition-all cursor-pointer"
            >
              {canonical7Themes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={handleGenerateSlides}
              disabled={isGenerating}
              className="w-full py-2.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Gerar Apresentação</span>
            </button>
          </div>
        </div>
      </div>

      {/* Presentation Viewer Screen */}
      <div className="flex flex-col items-center">
        <div className={`w-full max-w-4xl h-[460px] rounded-xl border-2 ${activeThemeObj.border} ${activeThemeObj.bg} ${activeThemeObj.text} p-8 lg:p-12 flex flex-col justify-between shadow-lg relative transition-all`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Slide {currentSlideIndex + 1} / {slides.length}</span>
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight mt-2">{activeSlide.title}</h2>
            <p className="text-sm opacity-70 mt-1 font-medium">{activeSlide.subtitle}</p>
          </div>

          <div className="space-y-3 my-auto">
            {activeSlide.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${activeThemeObj.bullet}`} />
                <span className="leading-relaxed font-medium">{b}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/20 pt-3 text-[10px] font-bold uppercase tracking-wider opacity-40">
            <span>Zenitus Inteligência Contábil</span>
            <span>Tema: {activeThemeObj.name}</span>
          </div>
        </div>

        {/* Slide Controls Footer */}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
            disabled={currentSlideIndex === 0}
            className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-900">
            Slide {currentSlideIndex + 1} de {slides.length}
          </span>
          <button
            onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
            disabled={currentSlideIndex === slides.length - 1}
            className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
