import Link from "next/link";
import { ChevronRight, ArrowLeft, FileText, ShieldCheck } from "lucide-react";

export const LEGAL_LAST_UPDATED = "2 de agosto de 2026";
export const LEGAL_VERSION = "1.0";

export interface LegalDoc {
  label: string;
  href: string;
  description: string;
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    label: "Termos de Uso",
    href: "/legal/termos-de-uso",
    description: "Entenda as regras, responsabilidades e condições de utilização da plataforma.",
  },
  {
    label: "Política de Privacidade",
    href: "/legal/politica-de-privacidade",
    description: "Saiba como os dados pessoais são coletados, utilizados, armazenados e protegidos.",
  },
  {
    label: "Conformidade LGPD",
    href: "/legal/conformidade-lgpd",
    description: "Conheça as práticas adotadas pela plataforma em relação à proteção de dados pessoais.",
  },
  {
    label: "Segurança & Criptografia",
    href: "/legal/seguranca-criptografia",
    description: "Conheça os mecanismos de proteção utilizados na plataforma e na comunicação com serviços externos.",
  },
];

const DOCUMENT_ICONS: Record<string, React.ReactNode> = {
  "Termos de Uso": <FileText className="w-4 h-4" strokeWidth={1.5} />,
  "Política de Privacidade": <FileText className="w-4 h-4" strokeWidth={1.5} />,
  "Conformidade LGPD": <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />,
  "Segurança & Criptografia": <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />,
};

export function LegalBreadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
      <Link href="/legal" className="hover:text-primary transition-colors font-medium">
        Segurança & Legal
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-slate-300" strokeWidth={1.5} />
      <span className="text-slate-700 font-semibold">{current}</span>
    </nav>
  );
}

export function LegalLayout({
  current,
  children,
}: {
  current: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F8FAFC] antialiased">
      <div className="border-b border-slate-200/80 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <LegalBreadcrumb current={current} />
          <div className="flex items-start justify-between gap-4 mt-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center shrink-0">
                {DOCUMENT_ICONS[current] || <ShieldCheck className="w-4.5 h-4.5 text-primary" strokeWidth={1.5} />}
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{current}</h1>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  OmniZeus — Documento da seção Segurança & Legal
                </p>
              </div>
            </div>
            <Link
              href="/legal"
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-primary border border-slate-200/80 hover:border-primary/30 bg-white rounded-lg px-3 py-2 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              Voltar para Segurança & Legal
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <article className="bg-white border border-slate-200/70 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 sm:px-10 py-8 sm:py-12">{children}</div>
        </article>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200/70 rounded-xl px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">Versão: {LEGAL_VERSION}</span>
            <span className="text-slate-300">|</span>
            <span>Última atualização: {LEGAL_LAST_UPDATED}</span>
          </div>
          <Link
            href="/legal"
            className="sm:hidden inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Voltar para Segurança & Legal
          </Link>
        </div>

        <div className="mt-8 border-t border-slate-200/80 pt-6">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3">
            Outros documentos da seção
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LEGAL_DOCS.filter((d) => d.label !== current).map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className="flex items-center gap-2 text-xs text-slate-600 hover:text-primary bg-white border border-slate-200/70 hover:border-primary/30 rounded-lg px-3.5 py-2.5 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" strokeWidth={1.5} />
                <span className="font-semibold">{doc.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export function LegalSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="pt-8 first:pt-0">
      <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
      <div className="mt-3.5 space-y-3.5">{children}</div>
    </section>
  );
}

export function LegalSubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 space-y-2.5">{children}</div>
    </div>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-slate-600">{children}</p>;
}

export function LegalUl({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-600">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-4 py-3 text-[12px] leading-relaxed text-slate-600">
      {children}
    </div>
  );
}
