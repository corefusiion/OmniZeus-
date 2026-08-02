export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import pptxgen from "pptxgenjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { slides, topic } = await req.json();

    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_16x9";
    pptx.author = "Zenitus Inteligência Contábil";
    pptx.company = "OmniZeus Accounting BPO";
    pptx.title = topic || "Apresentação Executiva";

    (slides || []).forEach((slide: any) => {
      const s = pptx.addSlide();
      s.background = { color: "0F172A" }; // Dark Executive Slate

      // Brand Tag Header
      s.addText(`ZENITUS CONTÁBIL • SLIDE ${slide.id} DE ${slides.length}`, {
        x: 0.8, y: 0.4, w: 8.0, h: 0.4,
        fontSize: 10, color: "94A3B8", bold: true
      });

      // Title
      s.addText(slide.title || "Slide Sem Título", {
        x: 0.8, y: 0.9, w: 11.5, h: 0.8,
        fontSize: 22, color: "FFFFFF", bold: true
      });

      // Subtitle
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8, y: 1.7, w: 11.5, h: 0.5,
          fontSize: 13, color: "94A3B8"
        });
      }

      // 1. Comparison Layout (Antes vs Depois / Sem BPO vs Com BPO)
      if (slide.layoutType === "comparison_before_after" || (slide.comparison && slide.comparison.length > 0)) {
        const items = slide.comparison || [
          { side: "Antes / Tradicional", points: ["Processos manuais em papel", "Atrasos em guias fiscais", "Risco de multas no e-CAC"] },
          { side: "Depois / Com OmniZeus", points: ["Fluxo 100% digital e conciliação OFX", "Envio automatizado de DAS via WhatsApp", "Zero pendências no DRE"] }
        ];
        items.forEach((comp: any, idx: number) => {
          const xPos = 0.8 + (idx * 5.8);
          s.addShape(pptx.ShapeType.rect, {
            x: xPos, y: 2.5, w: 5.5, h: 3.8,
            fill: { color: idx === 0 ? "1E1B4B" : "064E3B" }, line: { color: idx === 0 ? "4338CA" : "059669", width: 1.5 }
          });
          s.addText((comp.side || (idx === 0 ? "Antes" : "Depois")).toUpperCase(), {
            x: xPos + 0.3, y: 2.7, w: 4.9, h: 0.5,
            fontSize: 14, color: idx === 0 ? "A5B4FC" : "6EE7B7", bold: true
          });
          (comp.points || []).forEach((pt: string, pIdx: number) => {
            s.addText(`• ${pt}`, {
              x: xPos + 0.3, y: 3.4 + (pIdx * 0.7), w: 4.9, h: 0.6,
              fontSize: 12, color: "FFFFFF"
            });
          });
        });
      }

      // 2. Matrix 2x2 Layout
      else if (slide.layoutType === "matrix_2x2" || (slide.matrix && slide.matrix.length > 0)) {
        const mItems = slide.matrix || [
          { quad: "Q1 — Alta Urgência / Alto Impacto", title: "Compliance Fiscal", desc: "Entrega de obrigações acessórias sem erros" },
          { quad: "Q2 — Alta Estratégia", title: "BPO Financeiro", desc: "Conciliação diária e fluxo de caixa previsível" },
          { quad: "Q3 — Operacional", title: "Certificados Digitais", desc: "Renovação e guarda segura de chaves A1" },
          { quad: "Q4 — Acompanhamento", title: "DRE Mensal", desc: "Reuniões gerenciais de resultado" }
        ];
        mItems.forEach((q: any, idx: number) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const xPos = 0.8 + (col * 5.8);
          const yPos = 2.5 + (row * 1.9);
          s.addShape(pptx.ShapeType.rect, {
            x: xPos, y: yPos, w: 5.5, h: 1.7,
            fill: { color: "1E293B" }, line: { color: "38BDF8", width: 1 }
          });
          s.addText((q.quad || `Quadrante ${idx + 1}`).toUpperCase(), {
            x: xPos + 0.2, y: yPos + 0.15, w: 5.1, h: 0.35,
            fontSize: 9, color: "38BDF8", bold: true
          });
          s.addText(q.title || "", {
            x: xPos + 0.2, y: yPos + 0.5, w: 5.1, h: 0.45,
            fontSize: 13, color: "FFFFFF", bold: true
          });
          s.addText(q.desc || "", {
            x: xPos + 0.2, y: yPos + 0.95, w: 5.1, h: 0.6,
            fontSize: 10, color: "94A3B8"
          });
        });
      }

      // 3. Executive Table Layout (Native PPTX Table!)
      else if (slide.layoutType === "executive_table" || (slide.tableRows && slide.tableRows.length > 0)) {
        const rows = slide.tableRows || [
          ["Escrituração Fiscal", "Apuração de impostos e DCTFWeb", "Mensal", "Ativo"],
          ["BPO Financeiro", "Conciliação OFX e Contas a Pagar", "Diário", "Ativo"],
          ["Consultoria Societária", "Alteração contratual e e-CAC", "Pontual", "Concluído"]
        ];

        const tableHeader = [
          { text: "SERVIÇO / MÓDULO", options: { bold: true, fill: "1E6FD9", color: "FFFFFF", fontSize: 11 } },
          { text: "ESCOPO DETALHADO", options: { bold: true, fill: "1E6FD9", color: "FFFFFF", fontSize: 11 } },
          { text: "FREQUÊNCIA", options: { bold: true, fill: "1E6FD9", color: "FFFFFF", fontSize: 11 } },
          { text: "STATUS", options: { bold: true, fill: "1E6FD9", color: "FFFFFF", fontSize: 11 } }
        ];

        const tableBody = rows.map((r: any) => [
          { text: Array.isArray(r) ? (r[0] || "") : (r.service || ""), options: { fill: "1E293B", color: "FFFFFF", fontSize: 10 } },
          { text: Array.isArray(r) ? (r[1] || "") : (r.scope || ""), options: { fill: "1E293B", color: "CBD5E1", fontSize: 10 } },
          { text: Array.isArray(r) ? (r[2] || "") : (r.freq || ""), options: { fill: "1E293B", color: "38BDF8", fontSize: 10 } },
          { text: Array.isArray(r) ? (r[3] || "") : (r.status || ""), options: { fill: "1E293B", color: "34D399", fontSize: 10, bold: true } }
        ]);

        s.addTable([tableHeader, ...tableBody], {
          x: 0.8, y: 2.5, w: 11.5,
          border: { pt: 1, color: "334155" },
          autoPage: false
        });
      }

      // 4. Single Stat Hero
      else if (slide.layoutType === "single_stat_hero" || slide.singleStat) {
        const stat = slide.singleStat || { value: "-65%", label: "Economia Real em Custos Operacionais", desc: "Comparado à contratação de equipe própria CLT com encargos e infraestrutura." };
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 2.5, w: 11.5, h: 3.8,
          fill: { color: "1E293B" }, line: { color: "38BDF8", width: 2 }
        });
        s.addText(stat.value, {
          x: 1.2, y: 2.8, w: 10.7, h: 1.2,
          fontSize: 48, color: "38BDF8", bold: true
        });
        s.addText(stat.label.toUpperCase(), {
          x: 1.2, y: 4.1, w: 10.7, h: 0.5,
          fontSize: 14, color: "FFFFFF", bold: true
        });
        s.addText(stat.desc, {
          x: 1.2, y: 4.7, w: 10.7, h: 1.2,
          fontSize: 12, color: "94A3B8"
        });
      }

      // 5. Cards Layout
      else if (slide.cards && slide.cards.length > 0) {
        slide.cards.forEach((card: any, idx: number) => {
          const xPos = 0.8 + (idx * 3.8);
          s.addShape(pptx.ShapeType.rect, {
            x: xPos, y: 2.5, w: 3.5, h: 3.8,
            fill: { color: "1E293B" }, line: { color: "334155", width: 1 }
          });
          if (card.stat) {
            s.addText(card.stat, {
              x: xPos + 0.3, y: 2.7, w: 2.9, h: 0.6,
              fontSize: 22, color: "38BDF8", bold: true
            });
          }
          s.addText(card.title || "", {
            x: xPos + 0.3, y: 3.4, w: 2.9, h: 0.6,
            fontSize: 14, color: "FFFFFF", bold: true
          });
          s.addText(card.desc || "", {
            x: xPos + 0.3, y: 4.1, w: 2.9, h: 1.8,
            fontSize: 11, color: "94A3B8"
          });
        });
      }

      // 6. Metrics Layout
      else if (slide.metrics && slide.metrics.length > 0) {
        slide.metrics.forEach((m: any, idx: number) => {
          const xPos = 0.8 + (idx * 3.8);
          s.addShape(pptx.ShapeType.rect, {
            x: xPos, y: 2.5, w: 3.5, h: 3.8,
            fill: { color: "1E293B" }, line: { color: "38BDF8", width: 1.5 }
          });
          s.addText((m.label || "").toUpperCase(), {
            x: xPos + 0.3, y: 2.7, w: 2.9, h: 0.4,
            fontSize: 10, color: "94A3B8", bold: true
          });
          s.addText(m.value || "", {
            x: xPos + 0.3, y: 3.3, w: 2.9, h: 0.8,
            fontSize: 24, color: "38BDF8", bold: true
          });
          s.addText(m.detail || "", {
            x: xPos + 0.3, y: 4.3, w: 2.9, h: 1.6,
            fontSize: 11, color: "CBD5E1"
          });
        });
      }

      // 7. Timeline / Roadmap Steps
      else if ((slide.timelineSteps && slide.timelineSteps.length > 0) || (slide.roadmap && slide.roadmap.length > 0)) {
        const steps = slide.timelineSteps || slide.roadmap || [];
        steps.forEach((st: any, idx: number) => {
          const xPos = 0.8 + (idx * 3.8);
          s.addShape(pptx.ShapeType.rect, {
            x: xPos, y: 2.5, w: 3.5, h: 3.8,
            fill: { color: "1E293B" }, line: { color: "334155", width: 1 }
          });
          s.addText(`ETAPA #${st.stepNumber || st.phase || (idx + 1)}`, {
            x: xPos + 0.3, y: 2.7, w: 2.9, h: 0.4,
            fontSize: 12, color: "38BDF8", bold: true
          });
          s.addText(st.title || "", {
            x: xPos + 0.3, y: 3.3, w: 2.9, h: 0.6,
            fontSize: 14, color: "FFFFFF", bold: true
          });
          s.addText(st.desc || "", {
            x: xPos + 0.3, y: 4.0, w: 2.9, h: 1.8,
            fontSize: 11, color: "94A3B8"
          });
        });
      }

      // 8. Quote Layout
      else if (slide.quoteText) {
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 2.5, w: 11.5, h: 3.5,
          fill: { color: "1E293B" }, line: { color: "38BDF8", width: 2 }
        });
        s.addText(`"${slide.quoteText}"`, {
          x: 1.2, y: 2.9, w: 10.7, h: 1.8,
          fontSize: 18, color: "E2E8F0", italic: true
        });
        if (slide.quoteAuthor) {
          s.addText(`— ${slide.quoteAuthor}`, {
            x: 1.2, y: 4.9, w: 10.7, h: 0.5,
            fontSize: 12, color: "38BDF8", bold: true
          });
        }
      }

      // Default Bullets
      else if (slide.bullets && slide.bullets.length > 0) {
        slide.bullets.forEach((b: string, idx: number) => {
          s.addText(`• ${b}`, {
            x: 1.0, y: 2.5 + (idx * 0.8), w: 11.0, h: 0.6,
            fontSize: 14, color: "E2E8F0"
          });
        });
      }
    });

    const buffer = await pptx.write({ outputType: "nodebuffer" });
    const filename = `apresentacao_${(topic || "deck").toLowerCase().replace(/\s+/g, "_")}.pptx`;

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (err: any) {
    console.error("Error generating PPTX in API route:", err);
    return NextResponse.json({ error: err.message || "Error generating PPTX" }, { status: 500 });
  }
}

