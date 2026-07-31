"use client";

import React from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";

interface CardProps {
  number: string;
  title: string;
  description: string;
  colorTheme?: "orange" | "blue" | "purple";
  className?: string;
  rotate?: string;
  colors?: {
    bg: string;
    text: string;
    border: string;
  };
}

const Pin = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M16 3a1 1 0 0 1 .117 1.993l-.117 .007v4.764l1.894 3.789a1 1 0 0 1 .1 .331l.006 .116v2a1 1 0 0 1 -.883 .993l-.117 .007h-4v4a1 1 0 0 1 -1.993 .117l-.007 -.117v-4h-4a1 1 0 0 1 -.993 -.883l-.007 -.117v-2a1 1 0 0 1 .06 -.34l.046 -.107l1.894 -3.791v-4.762a1 1 0 0 1 -.117 -1.993l.117 -.007h8z" />
  </svg>
);

const Card = ({
  number,
  title,
  description,
  colorTheme = "blue",
  className = "",
  rotate = "",
  colors: customColors,
}: CardProps) => {
  const defaultBgColors = {
    orange: "bg-amber-50/90 dark:bg-amber-500/10",
    blue: "bg-blue-50/90 dark:bg-blue-500/10",
    purple: "bg-indigo-50/90 dark:bg-indigo-500/10",
  };
  const defaultTextColors = {
    orange: "text-amber-600 dark:text-amber-400",
    blue: "text-blue-600 dark:text-blue-400",
    purple: "text-indigo-600 dark:text-indigo-400",
  };
  const defaultBorderColors = {
    orange: "border-amber-200 dark:border-amber-500/20",
    blue: "border-blue-200 dark:border-blue-500/20",
    purple: "border-indigo-200 dark:border-indigo-500/20",
  };

  const bgColor = customColors?.bg || defaultBgColors[colorTheme];
  const textColor = customColors?.text || defaultTextColors[colorTheme];
  const borderColor = customColors?.border || defaultBorderColors[colorTheme];

  const rotateClass = rotate ? `md:${rotate}` : "";

  return (
    <div
      className={`relative w-full md:w-[280px] transition-transform duration-300 hover:z-30 hover:scale-105 ${rotateClass} ${className}`}
    >
      <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-[25px] shadow-[0px_10px_25px_0px_rgba(0,0,0,0.06)] dark:shadow-none border border-neutral-200/80 dark:border-neutral-800">
        <Pin className={`w-8 h-8 ${textColor} z-20 mb-4 mx-auto`} />
        <div
          className={`${bgColor} border ${borderColor} rounded-[15px] p-5 h-full flex flex-col relative overflow-hidden`}
        >
          <span
            className={`${textColor} text-4xl font-extrabold mb-3 font-mono tracking-tight`}
          >
            {number}
          </span>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-snug mb-2">
            {title}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 text-xs leading-relaxed tracking-tight">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export interface Step {
  title: string;
  description: string;
  colorTheme?: "orange" | "blue" | "purple";
  colors?: {
    bg: string;
    text: string;
    border: string;
  };
}

export interface StepPosition {
  className?: string;
  rotate?: string;
}

export interface HowItWorksProps {
  features?: Step[];
  className?: string;
  stepPositions?: StepPosition[];
}

const DEFAULT_CARD_POSITIONS: StepPosition[] = [
  { className: "md:absolute md:top-0 md:left-[12%]", rotate: "rotate-3" },
  {
    className: "md:absolute md:top-[120px] md:right-[12%]",
    rotate: "-rotate-3",
  },
  { className: "md:absolute md:top-[450px] md:left-[12%]", rotate: "rotate-3" },
  {
    className: "md:absolute md:top-[570px] md:right-[10%]",
    rotate: "-rotate-3",
  },
  { className: "md:absolute md:top-[850px] md:left-[12%]", rotate: "rotate-3" },
];

export default function HowItWorks({
  features,
  className = "",
  stepPositions,
}: HowItWorksProps) {
  const defaultFeatures: Step[] = [
    {
      title: "1. Escolha o Plano & Franquia",
      description:
        "Selecione a franquia mensal de OmniCoins ideal para a escala da sua empresa contábil ou prestador de BPO.",
      colorTheme: "orange",
    },
    {
      title: "2. Checkout Seguro via Stripe",
      description:
        "Realize o pagamento transparente com ativação imediata, recebendo credenciais com alteração obrigatória de senha.",
      colorTheme: "blue",
    },
    {
      title: "3. Calibração do Contexto IA",
      description:
        "Configure o segmento, regras fiscais e diretrizes do seu escritório para alimentar os 15 modelos de inteligência artificial.",
      colorTheme: "purple",
    },
    {
      title: "4. Conexão Conta Azul & Bot",
      description:
        "Sincronize a API do Conta Azul para conciliação em tempo real e conecte a Evolution API para atendimento no WhatsApp.",
      colorTheme: "orange",
    },
    {
      title: "5. Escala & Previsibilidade",
      description:
        "Gerencie tarefas com timer, distribua SOPs e monitore o consumo transparente de OmniCoins sem surpresas na fatura.",
      colorTheme: "blue",
    },
  ];

  const data = features && features.length > 0 ? features : defaultFeatures;
  const positions = stepPositions || DEFAULT_CARD_POSITIONS;

  let height = 1130;
  if (data.length === 1) height = 400;
  else if (data.length === 2) height = 450;
  else if (data.length === 3) height = 800;
  else if (data.length === 4) height = 900;
  else height = 1130;

  return (
    <LazyMotion features={domAnimation}>
      <section className={`py-20 bg-slate-50/60 dark:bg-black relative border-b border-slate-200/70 ${className}`} id="como-funciona">
        {/* Background Grid Accent */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.12]"
          style={{
            backgroundImage: "linear-gradient(#000 1px, transparent 1px)",
            backgroundSize: "100% 32px",
            marginTop: "4px",
          }}
        ></div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3.5 py-1 rounded-full border border-primary/20">
              Jornada de Implantação
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              Como Funciona o OmniZeus
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Do onboarding à operação diária: veja como transformar seu escritório contábil em uma central de inteligência financeira.
            </p>
          </div>

          <div
            className="relative w-full max-w-[1000px] mx-auto flex flex-col space-y-8 md:space-y-0 md:block h-auto md:h-[var(--md-height)]"
            style={{ "--md-height": `${height}px` } as React.CSSProperties}
          >
            {data.length > 1 && (
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none hidden md:block z-0"
                viewBox={`0 0 1000 ${height}`}
                preserveAspectRatio="none"
              >
                {(() => {
                  const pathD = data.reduce((acc, _, index) => {
                    if (index >= data.length - 1) return acc;
                    if (index === 0)
                      return "M 290 150 C 500 150, 550 270, 710 270"; // 1 -> 2
                    if (index === 1)
                      return acc + " C 850 270, 500 350, 290 450"; // 2 -> 3
                    if (index === 2)
                      return acc + " C 290 600, 550 720, 750 720"; // 3 -> 4
                    if (index === 3)
                      return acc + " C 950 720, 500 800, 290 850"; // 4 -> 5
                    return acc;
                  }, "");
                  return (
                    <m.path
                      d={pathD}
                      stroke="currentColor"
                      className="text-slate-300 dark:text-neutral-700"
                      strokeWidth="2"
                      strokeDasharray="8 6"
                      fill="none"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      initial={{ strokeDashoffset: 0 }}
                      animate={{
                        strokeDashoffset: -140, // Multiple of 14 (8+6) for seamless loop
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  );
                })()}
              </svg>
            )}

            {data.map((step, index) => {
              const position = positions[index % positions.length];

              return (
                <Card
                  key={step.title}
                  number={`0${index + 1}`}
                  title={step.title}
                  description={step.description}
                  colorTheme={step.colorTheme || "blue"}
                  colors={step.colors}
                  rotate={position.rotate}
                  className={position.className}
                />
              );
            })}
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
