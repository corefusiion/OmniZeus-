"use client";

import { useState, useEffect } from "react";
import { 
  Presentation, Sparkles, ChevronLeft, ChevronRight, Download, RefreshCw, 
  Maximize2, X, CheckCircle2, Coins, Palette, FileCode, Bot, Check, Layers,
  BarChart3, LayoutGrid, Award, Quote, Clock, FileSpreadsheet, ArrowRight,
  TrendingUp, ShieldCheck, CheckSquare, Layers2, Table
} from "lucide-react";
import { deductCoins } from "@/lib/coins/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface SlideCard {
  title: string;
  desc: string;
  stat?: string;
}

interface SlideMetric {
  label: string;
  value: string;
  detail: string;
}

interface TimelineStep {
  stepNumber: number;
  title: string;
  desc: string;
}

interface ComparisonSide {
  side: string;
  points: string[];
}

interface MatrixItem {
  quad: string;
  title: string;
  desc: string;
}

interface Slide {
  id: number;
  layoutType?: 'hero_cover' | 'single_stat_hero' | 'kpi_metrics' | 'comparison_before_after' | 'matrix_2x2' | 'process_timeline' | 'roadmap' | 'executive_table' | 'quote_highlight' | 'cards_grid' | 'bullets_pills';
  title: string;
  subtitle: string;
  bullets?: string[];
  cards?: SlideCard[];
  metrics?: SlideMetric[];
  timelineSteps?: TimelineStep[];
  comparison?: ComparisonSide[];
  matrix?: MatrixItem[];
  tableRows?: any[];
  singleStat?: { value: string; label: string; desc: string };
  quoteText?: string;
  quoteAuthor?: string;
}

const canonical7Themes = [
  { 
    id: "escuro", 
    name: "Gamma Executive (Dark Linear)", 
    bg: "bg-[#0F172A]", 
    text: "text-white", 
    border: "border-slate-700", 
    bullet: "bg-blue-400", 
    cardBg: "bg-slate-800/80 border-slate-700/80 shadow-md",
    accentText: "text-blue-400",
    accentBg: "bg-blue-600 text-white",
    badgeBg: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    tableHeaderBg: "bg-slate-800 text-blue-300 border-slate-700",
    fontFamily: "font-sans"
  },
  { 
    id: "azul", 
    name: "Stripe Corporate (Profissional Azul)", 
    bg: "bg-white", 
    text: "text-[#0F172A]", 
    border: "border-[#1E6FD9]/30", 
    bullet: "bg-[#1E6FD9]", 
    cardBg: "bg-slate-50 border-slate-200 shadow-xs",
    accentText: "text-[#1E6FD9]",
    accentBg: "bg-[#1E6FD9] text-white",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    tableHeaderBg: "bg-[#1E6FD9] text-white",
    fontFamily: "font-sans"
  },
  { 
    id: "clean", 
    name: "Vercel Minimalist (Clean Gray)", 
    bg: "bg-slate-50", 
    text: "text-slate-900", 
    border: "border-slate-300", 
    bullet: "bg-slate-700", 
    cardBg: "bg-white border-slate-200 shadow-xs",
    accentText: "text-slate-900 font-extrabold",
    accentBg: "bg-slate-900 text-white",
    badgeBg: "bg-slate-200 text-slate-800 border-slate-300",
    tableHeaderBg: "bg-slate-900 text-white",
    fontFamily: "font-mono"
  },
  { 
    id: "emerald", 
    name: "Tax Compliance (Verde Esmeralda)", 
    bg: "bg-[#022C22]", 
    text: "text-emerald-50", 
    border: "border-emerald-800", 
    bullet: "bg-emerald-400", 
    cardBg: "bg-emerald-950/80 border-emerald-800/80 shadow-md",
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-600 text-white",
    badgeBg: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    tableHeaderBg: "bg-emerald-900 text-emerald-200 border-emerald-800",
    fontFamily: "font-sans"
  },
  { 
    id: "vinho", 
    name: "Boardroom Premium (Vinho & Ouro)", 
    bg: "bg-[#3B0712]", 
    text: "text-amber-50", 
    border: "border-amber-700/60", 
    bullet: "bg-amber-400", 
    cardBg: "bg-[#2A050D] border-amber-800/60 shadow-md",
    accentText: "text-amber-300",
    accentBg: "bg-amber-600 text-white",
    badgeBg: "bg-amber-950 text-amber-300 border-amber-700/60",
    tableHeaderBg: "bg-amber-950 text-amber-200 border-amber-800",
    fontFamily: "font-serif"
  },
  { 
    id: "slate", 
    name: "Modern Slate (Cyber Dark)", 
    bg: "bg-slate-900", 
    text: "text-slate-100", 
    border: "border-indigo-500/40", 
    bullet: "bg-indigo-400", 
    cardBg: "bg-slate-800/90 border-indigo-500/30 shadow-md",
    accentText: "text-indigo-400",
    accentBg: "bg-indigo-600 text-white",
    badgeBg: "bg-indigo-950 text-indigo-300 border-indigo-800",
    tableHeaderBg: "bg-indigo-950 text-indigo-200 border-indigo-800",
    fontFamily: "font-sans"
  },
  { 
    id: "gold", 
    name: "Amber High-Contrast (Executive Gold)", 
    bg: "bg-[#1C1917]", 
    text: "text-amber-100", 
    border: "border-amber-600/40", 
    bullet: "bg-amber-500", 
    cardBg: "bg-stone-900 border-amber-600/30 shadow-md",
    accentText: "text-amber-400",
    accentBg: "bg-amber-600 text-white",
    badgeBg: "bg-stone-800 text-amber-300 border-amber-700/50",
    tableHeaderBg: "bg-stone-900 text-amber-300 border-amber-800",
    fontFamily: "font-sans"
  }
];

export default function ApresentacoesPage() {
  const [topic, setTopic] = useState("Proposta Comercial de BPO Financeiro & Gestão de Caixas");
  const [description, setDescription] = useState("Apresentação executiva para clientes de médio porte demonstrando a redução de custos com a terceirização de contas a pagar/receber, conciliação bancária diária e emissão de DRE gerencial.");
  const [slideCount, setSlideCount] = useState<number>(5);
  const [selectedTheme, setSelectedTheme] = useState(canonical7Themes[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNoCoinsModal, setShowNoCoinsModal] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const [slides, setSlides] = useState<Slide[]>([
    {
      id: 1,
      layoutType: "hero_cover",
      title: "BPO Financeiro e Gestão de Fluxo de Caixa",
      subtitle: "Proposta Comercial para otimização e controle financeiro institucional • Zenitus Contábil",
      cards: [
        { title: "Redução de Custos", desc: "Economia de até 65% em relação ao depto financeiro interno", stat: "-65%" },
        { title: "Acuracidade 100%", desc: "Conciliação diária de extratos OFX sem divergências", stat: "100%" },
        { title: "DRE Gerencial", desc: "Relatórios mensais em tempo real para tomada de decisão", stat: "24/7" }
      ]
    },
    {
      id: 2,
      layoutType: "single_stat_hero",
      title: "Impacto Financeiro Direto",
      subtitle: "Redução comprovada na folha operacional do setor financeiro",
      singleStat: {
        value: "65%",
        label: "Redução de Custo Fixo Operacional",
        desc: "Substituição de equipe interna CLT por BPO financeiro especializado com SLAs garantidos por contrato."
      }
    },
    {
      id: 3,
      layoutType: "comparison_before_after",
      title: "Comparativo Operacional",
      subtitle: "Transformação do Modelo Tradicional para o Ecossistema OmniZeus",
      comparison: [
        {
          side: "Antes (Gestão Interna Manual)",
          points: [
            "Lançamentos em planilhas dispersas e suscetíveis a erro",
            "Atrasos frequentes em pagamentos de fornecedores e impostos",
            "Falta de conciliação bancária diária e divergências no caixa"
          ]
        },
        {
          side: "Depois (BPO Financeiro Zenitus)",
          points: [
            "Conciliação bancária OFX automática integrada ao ContaAzul",
            "Agendamento de contas com dupla alçada de aprovação",
            "Emissão mensal de DRE gerencial e relatórios de fluxo"
          ]
        }
      ]
    },
    {
      id: 4,
      layoutType: "process_timeline",
      title: "Roadmap de Implantação (30 Dias)",
      subtitle: "Etapas estruturadas para transição transparente do seu financeiro",
      timelineSteps: [
        { stepNumber: 1, title: "Diagnóstico & Mapeamento", desc: "Coleta de histórico bancário e cadastro de fornecedores." },
        { stepNumber: 2, title: "Integração de APIs & Contas", desc: "Configuração do ContaAzul e acessos de leitura bancários." },
        { stepNumber: 3, title: "Operação Assistida & GO-LIVE", desc: "Acompanhamento diário com gestor financeiro dedicado." }
      ]
    },
    {
      id: 5,
      layoutType: "quote_highlight",
      title: "Compromisso com a Excelência",
      subtitle: "Garantia de Qualidade Zenitus Inteligência Contábil",
      quoteText: "Transformamos a rotina financeira do seu negócio em um motor estratégico de dados precisos, previsibilidade de caixa e tranquilidade operacional.",
      quoteAuthor: "Carlos Mendes — Diretor de BPO & Operações"
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
    const success = deductCoins(80, "Geração Deck Executivo (80 Coins)");
    if (!success) {
      setShowNoCoinsModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      const promptContent = `PRESENTATION INTELLIGENCE ENGINE V4.0 — MINIMAX & GAMMA DESIGN ENGINE:
Gere a estrutura completa de ${slideCount} slides para uma apresentação sobre o tema: "${topic}".
Descrição e objetivo: ${description}.

REGRAS ESTRITAS DE VARIABILIDADE VISUAL & STORYTELLING:
1. NUNCA REPITA O MESMO LAYOUT EM SLIDES CONSECUTIVOS.
2. Alterne obrigatoriamente entre as seguintes estruturas de layout:
   - "hero_cover": Capa Impactante (Título, subtítulo, estatísticas de topo).
   - "single_stat_hero": Destaque de Número Gigante (Single Stat Callout).
   - "kpi_metrics": 3 Métricas Numéricas de ROI / Estatísticas.
   - "comparison_before_after": Comparativo 2 Colunas ("Antes vs Depois").
   - "matrix_2x2": Matriz Quadrante 2x2 (4 áreas de análise).
   - "process_timeline": Fluxo de Processo Conectado (#1 → #2 → #3 → #4).
   - "roadmap": Cronograma de Implantação por fases.
   - "executive_table": Tabela Executiva Estruturada.
   - "quote_highlight": Citação de Conselho com destaque serifado.
   - "cards_grid": Cartões informativos (PERMITIDO NO MÁXIMO 1X em toda a apresentação!).

RETORNE APENAS UM ARRAY JSON VÁLIDO:
[
  {
    "id": 1,
    "layoutType": "hero_cover",
    "title": "...",
    "subtitle": "...",
    "cards": [
      { "title": "...", "desc": "...", "stat": "..." }
    ]
  },
  {
    "id": 2,
    "layoutType": "single_stat_hero",
    "title": "...",
    "subtitle": "...",
    "singleStat": { "value": "...", "label": "...", "desc": "..." }
  },
  {
    "id": 3,
    "layoutType": "comparison_before_after",
    "title": "...",
    "subtitle": "...",
    "comparison": [
      { "side": "Antes / Tradicional", "points": ["...", "..."] },
      { "side": "Depois / Com Solução", "points": ["...", "..."] }
    ]
  },
  {
    "id": 4,
    "layoutType": "process_timeline",
    "title": "...",
    "subtitle": "...",
    "timelineSteps": [
      { "stepNumber": 1, "title": "...", "desc": "..." }
    ]
  },
  {
    "id": 5,
    "layoutType": "quote_highlight",
    "title": "...",
    "subtitle": "...",
    "quoteText": "...",
    "quoteAuthor": "..."
  }
]`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: promptContent }],
          personaPrompt: "Você é o diretor de arte executivo da plataforma OmniZeus, especialista em storytelling e composição visual de apresentações.",
        }),
      });

      if (res.ok) {
        const aiText = await res.text();
        try {
          const jsonMatch = aiText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          const parsedSlides = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
          
          if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
            setSlides(parsedSlides.map((s: any, idx: number) => ({
              id: idx + 1,
              layoutType: s.layoutType || (idx === 0 ? 'hero_cover' : idx === 1 ? 'single_stat_hero' : idx === 2 ? 'comparison_before_after' : idx === 3 ? 'process_timeline' : 'quote_highlight'),
              title: s.title || "Slide Sem Título",
              subtitle: s.subtitle || "",
              bullets: Array.isArray(s.bullets) ? s.bullets : [],
              cards: Array.isArray(s.cards) ? s.cards : [],
              metrics: Array.isArray(s.metrics) ? s.metrics : [],
              timelineSteps: Array.isArray(s.timelineSteps) ? s.timelineSteps : [],
              comparison: Array.isArray(s.comparison) ? s.comparison : [],
              matrix: Array.isArray(s.matrix) ? s.matrix : [],
              tableRows: Array.isArray(s.tableRows) ? s.tableRows : [],
              singleStat: s.singleStat || s.single_stat,
              quoteText: s.quoteText || s.quote_text || "",
              quoteAuthor: s.quoteAuthor || s.quote_author || ""
            })));
          } else {
            throw new Error("Formato JSON Inválido");
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
          layoutType: "hero_cover",
          title: topic,
          subtitle: "Apresentação Executiva • Zenitus Contábil",
          cards: [
            { title: "Diagnóstico Completo", desc: "Mapeamento das rotinas contábeis e fiscais do cliente", stat: "100%" },
            { title: "Redução de Erros", desc: "Controle preventivo contra contingências na malha e-CAC", stat: "0%" }
          ]
        },
        {
          id: 2,
          layoutType: "comparison_before_after",
          title: "Comparativo de Performance",
          subtitle: "Evolução do Modelo Tradicional para o BPO Digital",
          comparison: [
            { side: "Gestão Tradicional", points: ["Processos manuais", "Risco de multas", "Falta de conciliação"] },
            { side: "BPO Digital Zenitus", points: ["Automação OFX", "Conformidade e-CAC", "DRE em tempo real"] }
          ]
        },
        {
          id: 3,
          layoutType: "quote_highlight",
          title: "Conclusão Estratégica",
          subtitle: "Encerramento Executivo",
          quoteText: "Garantimos previsibilidade e dados precisos para o crescimento sustentável da sua empresa.",
          quoteAuthor: "Equipe Técnica Zenitus Inteligência Contábil"
        }
      ]);
    } finally {
      setCurrentSlideIndex(0);
      setIsGenerating(false);
    }
  };

  // Native Microsoft PowerPoint (.pptx) Generator via API route
  const handleExportPowerPoint = async () => {
    try {
      setDownloadNotice("Gerando e baixando arquivo Microsoft PowerPoint (.pptx)...");
      const res = await fetch("/api/apresentacoes/export-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, topic })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `apresentacao_${topic.toLowerCase().replace(/\s+/g, '_')}.pptx`;
        a.click();
        URL.revokeObjectURL(url);

        setDownloadNotice("Download do PowerPoint concluído com sucesso!");
      } else {
        throw new Error("Falha ao gerar PPTX no servidor");
      }
    } catch (err) {
      console.error("Erro ao gerar PowerPoint PPTX:", err);
      setDownloadNotice("Erro ao gerar PPTX. Tente utilizar o exportador HTML.");
    } finally {
      setTimeout(() => setDownloadNotice(null), 3000);
    }
  };

  const handleDownloadHtmlDeck = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${topic} — Apresentação Executiva</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    .slide-container { display: none; }
    .slide-container.active { display: flex; }
  </style>
</head>
<body class="bg-slate-950 text-white min-h-screen flex flex-col justify-between p-6 lg:p-12">
  <div class="flex justify-between items-center border-b border-slate-800 pb-4">
    <div class="flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-blue-500"></span>
      <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Zenitus Contábil • Slide Deck Executivo</span>
    </div>
    <span class="text-xs font-bold text-slate-400" id="slideIndicator">Slide 1 de ${slides.length}</span>
  </div>

  <main class="my-auto max-w-5xl mx-auto w-full">
    ${slides.map((s, idx) => `
      <div id="slide-${idx}" class="slide-container ${idx === 0 ? 'active' : ''} flex-col space-y-6">
        <span class="text-xs font-bold uppercase tracking-widest text-blue-400">Slide ${s.id} • ${s.layoutType || 'Deck'}</span>
        <h1 class="text-3xl lg:text-5xl font-extrabold tracking-tight">${s.title}</h1>
        <p class="text-lg text-slate-400 font-medium">${s.subtitle}</p>

        ${s.cards && s.cards.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            ${s.cards.map(c => `
              <div class="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-2">
                ${c.stat ? `<span class="text-2xl font-extrabold text-blue-400 block">${c.stat}</span>` : ''}
                <h3 class="font-bold text-white text-base">${c.title}</h3>
                <p class="text-xs text-slate-400 leading-relaxed">${c.desc}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${s.singleStat ? `
          <div class="p-8 bg-slate-900 border border-blue-500/50 rounded-2xl my-6 space-y-2">
            <span class="text-5xl font-extrabold text-blue-400 block">${s.singleStat.value}</span>
            <h3 class="text-lg font-bold text-white">${s.singleStat.label}</h3>
            <p class="text-sm text-slate-400 leading-relaxed">${s.singleStat.desc}</p>
          </div>
        ` : ''}

        ${s.comparison && s.comparison.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            ${s.comparison.map((comp, cIdx) => `
              <div class="p-6 rounded-xl border ${cIdx === 0 ? 'bg-indigo-950/40 border-indigo-800' : 'bg-emerald-950/40 border-emerald-800'} space-y-3">
                <h3 class="font-bold text-base uppercase tracking-wider ${cIdx === 0 ? 'text-indigo-300' : 'text-emerald-300'}">${comp.side}</h3>
                <div class="space-y-2">
                  ${(comp.points || []).map(pt => `<p class="text-sm text-slate-200">✓ ${pt}</p>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${s.timelineSteps && s.timelineSteps.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            ${s.timelineSteps.map(st => `
              <div class="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-2 relative">
                <span class="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-2">#${st.stepNumber}</span>
                <h3 class="font-bold text-white text-base">${st.title}</h3>
                <p class="text-xs text-slate-400 leading-relaxed">${st.desc}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${s.quoteText ? `
          <div class="p-8 bg-slate-900 border-l-4 border-blue-500 rounded-r-xl my-6 space-y-3">
            <p class="text-xl italic font-serif leading-relaxed text-slate-200">"${s.quoteText}"</p>
            <p class="text-xs font-bold text-blue-400 uppercase tracking-wider">— ${s.quoteAuthor || 'Zenitus Contábil'}</p>
          </div>
        ` : ''}
      </div>
    `).join('')}
  </main>

  <footer class="flex justify-between items-center border-t border-slate-800 pt-4 text-xs text-slate-500">
    <button id="btnPrev" class="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-semibold rounded-lg">← Anterior</button>
    <span class="font-medium">Navegue pelas setas do teclado (← / →)</span>
    <button id="btnNext" class="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-semibold rounded-lg">Próximo →</button>
  </footer>

  <script>
    let current = 0;
    const total = ${slides.length};
    function showSlide(index) {
      document.querySelectorAll('.slide-container').forEach((el, idx) => {
        el.classList.toggle('active', idx === index);
      });
      document.getElementById('slideIndicator').innerText = 'Slide ' + (index + 1) + ' de ' + total;
    }
    document.getElementById('btnPrev').addEventListener('click', () => { current = Math.max(0, current - 1); showSlide(current); });
    document.getElementById('btnNext').addEventListener('click', () => { current = Math.min(total - 1, current + 1); showSlide(current); });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') { current = Math.min(total - 1, current + 1); showSlide(current); }
      if (e.key === 'ArrowLeft') { current = Math.max(0, current - 1); showSlide(current); }
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apresentacao_${topic.toLowerCase().replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);

    setDownloadNotice("Download do HTML concluído!");
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const activeThemeObj = canonical7Themes.find(t => t.id === selectedTheme) || canonical7Themes[0];
  const activeSlide = slides[currentSlideIndex];

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
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

      {/* Cleaned Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Gerador de Apresentações Executivas
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Criação autônoma de decks visuais com exportação nativa para Microsoft PowerPoint e HTML
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPowerPoint}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-orange-400" />
            <span>Baixar PowerPoint</span>
          </button>

          <button
            onClick={handleDownloadHtmlDeck}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs border border-slate-200"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>Baixar HTML</span>
          </button>

          <button
            onClick={() => setIsFullscreen(true)}
            className="px-4 py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Apresentar</span>
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
          <div className="md:col-span-8">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Tema da Apresentação:</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#1E6FD9] transition-all"
            />
          </div>
          
          <div className="md:col-span-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Qtd. de Slides:</label>
            <select
              value={slideCount}
              onChange={(e) => setSlideCount(parseInt(e.target.value))}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#1E6FD9] transition-all cursor-pointer"
            >
              <option value={3}>3 Slides (Resumo Executivo)</option>
              <option value={5}>5 Slides (Padrão Comercial)</option>
              <option value={8}>8 Slides (Apresentação Completa)</option>
              <option value={10}>10 Slides (Deck Profundo)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-end">
          <div className="md:col-span-6">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Descrição / Objetivo da Reunião:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#1E6FD9] transition-all resize-none"
              placeholder="Ex: Apresentar proposta comercial de BPO financeiro..."
            />
          </div>

          <div className="md:col-span-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#1E6FD9]" />
              Sistema de Design (7):
            </label>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1E6FD9] transition-all cursor-pointer"
            >
              {canonical7Themes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              onClick={handleGenerateSlides}
              disabled={isGenerating}
              className="w-full py-2.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Gerar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Presentation View */}
      {isFullscreen && (
        <div className={`fixed inset-0 z-50 p-6 lg:p-12 flex flex-col justify-between ${activeThemeObj.bg} ${activeThemeObj.text} ${activeThemeObj.fontFamily}`}>
          <div className="flex justify-between items-center border-b border-slate-200/20 pb-4">
            <span className="text-xs font-bold uppercase tracking-widest opacity-60">Zenitus Contábil • Slide {currentSlideIndex + 1} de {slides.length} (Setas ← → do teclado)</span>
            <button onClick={() => setIsFullscreen(false)} className="p-2 hover:bg-slate-700/20 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-5xl mx-auto my-auto w-full space-y-6">
            <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded border ${activeThemeObj.badgeBg}`}>
              Slide {activeSlide.id} • {(activeSlide.layoutType || 'HERO').toUpperCase()}
            </span>
            <h1 className={`text-3xl lg:text-5xl font-extrabold tracking-tight ${activeThemeObj.accentText}`}>{activeSlide.title}</h1>
            <p className="text-lg lg:text-xl opacity-80">{activeSlide.subtitle}</p>

            {/* Rich Layout Rendering inside Fullscreen */}
            {activeSlide.singleStat && (
              <div className={`p-8 rounded-2xl border ${activeThemeObj.cardBg} space-y-3 my-4`}>
                <span className={`text-5xl lg:text-6xl font-extrabold block tracking-tight ${activeThemeObj.accentText}`}>{activeSlide.singleStat.value}</span>
                <h3 className="font-bold text-lg lg:text-xl">{activeSlide.singleStat.label}</h3>
                <p className="text-xs lg:text-sm opacity-70 leading-relaxed">{activeSlide.singleStat.desc}</p>
              </div>
            )}

            {activeSlide.comparison && activeSlide.comparison.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {activeSlide.comparison.map((comp, idx) => (
                  <div key={idx} className={`p-6 rounded-xl border ${activeThemeObj.cardBg} space-y-3`}>
                    <h3 className={`font-bold text-sm uppercase tracking-wider ${activeThemeObj.accentText}`}>{comp.side}</h3>
                    <div className="space-y-2">
                      {(comp.points || []).map((pt, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${activeThemeObj.accentText}`} />
                          <span className="opacity-90 leading-relaxed">{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSlide.cards && activeSlide.cards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {activeSlide.cards.map((c, i) => (
                  <div key={i} className={`p-6 rounded-xl border ${activeThemeObj.cardBg} space-y-2`}>
                    {c.stat && <span className={`text-2xl font-extrabold block ${activeThemeObj.accentText}`}>{c.stat}</span>}
                    <h3 className="font-bold text-base">{c.title}</h3>
                    <p className="text-xs opacity-70 leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {activeSlide.metrics && activeSlide.metrics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {activeSlide.metrics.map((m, i) => (
                  <div key={i} className={`p-6 rounded-xl border ${activeThemeObj.cardBg} space-y-2`}>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-60 block">{m.label}</span>
                    <span className={`text-3xl font-extrabold block ${activeThemeObj.accentText}`}>{m.value}</span>
                    <p className="text-xs opacity-70 leading-relaxed">{m.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {activeSlide.timelineSteps && activeSlide.timelineSteps.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {activeSlide.timelineSteps.map((st, i) => (
                  <div key={i} className={`p-6 rounded-xl border ${activeThemeObj.cardBg} space-y-2 relative`}>
                    <span className={`w-8 h-8 rounded-full ${activeThemeObj.accentBg} font-bold flex items-center justify-center text-xs mb-2`}>#{st.stepNumber}</span>
                    <h3 className="font-bold text-base">{st.title}</h3>
                    <p className="text-xs opacity-70 leading-relaxed">{st.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {activeSlide.quoteText && (
              <div className={`p-8 border-l-4 rounded-r-xl my-6 space-y-3 ${activeThemeObj.cardBg}`}>
                <p className="text-2xl italic font-serif leading-relaxed opacity-90">"{activeSlide.quoteText}"</p>
                <p className={`text-xs font-bold uppercase tracking-wider ${activeThemeObj.accentText}`}>— {activeSlide.quoteAuthor || 'Zenitus Contábil'}</p>
              </div>
            )}
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

      {/* Presentation 16:9 Canvas Preview Pane */}
      <div className="flex flex-col items-center w-full">
        <div className={`w-full max-w-4xl aspect-[16/9] rounded-xl border-2 ${activeThemeObj.border} ${activeThemeObj.bg} ${activeThemeObj.text} ${activeThemeObj.fontFamily} p-6 sm:p-8 lg:p-10 flex flex-col justify-between shadow-lg relative transition-all overflow-hidden`}>
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/20 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Slide {currentSlideIndex + 1} de {slides.length}</span>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${activeThemeObj.badgeBg}`}>
                {activeSlide.layoutType ? activeSlide.layoutType.toUpperCase() : 'HERO'}
              </span>
            </div>

            {/* Sub-variant Cover Hero Layout styling when layoutType === 'hero_cover' */}
            {activeSlide.layoutType === 'hero_cover' ? (
              <div className="mt-4 space-y-2">
                <span className={`inline-block text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${activeThemeObj.accentBg}`}>
                  SLIDE EXECUTIVO DE CAPA DE ALTO IMPACTO
                </span>
                <h2 className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight ${activeThemeObj.accentText}`}>{activeSlide.title}</h2>
                <p className="text-xs sm:text-sm opacity-80 font-medium max-w-2xl">{activeSlide.subtitle}</p>
              </div>
            ) : (
              <>
                <h2 className={`text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight mt-3 line-clamp-2 ${activeThemeObj.accentText}`}>{activeSlide.title}</h2>
                <p className="text-xs sm:text-sm opacity-70 mt-0.5 font-medium line-clamp-1">{activeSlide.subtitle}</p>
              </>
            )}
          </div>

          {/* Dynamic Rich Layout Rendering */}
          <div className="my-auto py-2 overflow-y-auto max-h-[220px] custom-scrollbar">
            {activeSlide.layoutType === 'hero_cover' && activeSlide.cards && activeSlide.cards.length > 0 ? (
              /* Dedicated Hero Cover Split Encartes Layout */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {activeSlide.cards.map((c, i) => (
                  <div key={i} className={`p-3.5 rounded-xl border ${activeThemeObj.cardBg} flex flex-col justify-between space-y-1`}>
                    <div className="flex items-center justify-between">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {c.stat && <span className={`text-sm font-extrabold ${activeThemeObj.accentText}`}>{c.stat}</span>}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs">{c.title}</h3>
                      <p className="text-[10px] opacity-70 leading-relaxed line-clamp-2 mt-0.5">{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeSlide.singleStat ? (
              <div className={`p-4 sm:p-5 rounded-xl border ${activeThemeObj.cardBg} space-y-1 my-1`}>
                <span className={`text-3xl sm:text-4xl font-extrabold block ${activeThemeObj.accentText}`}>{activeSlide.singleStat.value}</span>
                <h3 className="font-bold text-xs sm:text-sm">{activeSlide.singleStat.label}</h3>
                <p className="text-[11px] opacity-70 leading-relaxed">{activeSlide.singleStat.desc}</p>
              </div>
            ) : activeSlide.comparison && activeSlide.comparison.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeSlide.comparison.map((comp, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border ${activeThemeObj.cardBg} space-y-1.5`}>
                    <h3 className={`font-bold text-xs uppercase tracking-wider ${activeThemeObj.accentText}`}>{comp.side}</h3>
                    <div className="space-y-1">
                      {(comp.points || []).map((pt, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-1.5 text-[11px]">
                          <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${activeThemeObj.accentText}`} />
                          <span className="opacity-90 line-clamp-2">{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : activeSlide.cards && activeSlide.cards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {activeSlide.cards.map((c, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${activeThemeObj.cardBg} space-y-1`}>
                    {c.stat && <span className={`text-lg font-extrabold block ${activeThemeObj.accentText}`}>{c.stat}</span>}
                    <h3 className="font-bold text-xs">{c.title}</h3>
                    <p className="text-[10px] opacity-70 leading-relaxed line-clamp-3">{c.desc}</p>
                  </div>
                ))}
              </div>
            ) : activeSlide.metrics && activeSlide.metrics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {activeSlide.metrics.map((m, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${activeThemeObj.cardBg} space-y-0.5`}>
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 block">{m.label}</span>
                    <span className={`text-xl font-extrabold block ${activeThemeObj.accentText}`}>{m.value}</span>
                    <p className="text-[10px] opacity-70 leading-relaxed line-clamp-2">{m.detail}</p>
                  </div>
                ))}
              </div>
            ) : activeSlide.timelineSteps && activeSlide.timelineSteps.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {activeSlide.timelineSteps.map((st, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${activeThemeObj.cardBg} space-y-0.5`}>
                    <span className={`w-5 h-5 rounded-full ${activeThemeObj.accentBg} font-bold flex items-center justify-center text-[9px] mb-1`}>#{st.stepNumber}</span>
                    <h3 className="font-bold text-xs">{st.title}</h3>
                    <p className="text-[10px] opacity-70 leading-relaxed line-clamp-2">{st.desc}</p>
                  </div>
                ))}
              </div>
            ) : activeSlide.quoteText ? (
              <div className={`p-4 border-l-4 rounded-r-xl space-y-1 ${activeThemeObj.cardBg}`}>
                <p className="text-xs sm:text-sm italic font-serif leading-relaxed opacity-90 line-clamp-3">"{activeSlide.quoteText}"</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${activeThemeObj.accentText}`}>— {activeSlide.quoteAuthor || 'Zenitus Contábil'}</p>
              </div>
            ) : activeSlide.bullets && activeSlide.bullets.length > 0 ? (
              <div className="space-y-1.5">
                {activeSlide.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${activeThemeObj.bullet}`} />
                    <span className="leading-relaxed font-medium line-clamp-2">{b}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/20 pt-2 text-[9px] font-bold uppercase tracking-wider opacity-50">
            <span>Zenitus Inteligência Contábil</span>
            <span>Design System: {activeThemeObj.name}</span>
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
