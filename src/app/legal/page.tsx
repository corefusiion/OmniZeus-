import Link from "next/link";
import { ArrowRight, ShieldCheck, FileText } from "lucide-react";
import { LEGAL_DOCS, LEGAL_VERSION, LEGAL_LAST_UPDATED } from "@/components/legal/LegalLayout";

const DOC_ICONS: Record<string, React.ReactNode> = {
  "Termos de Uso": <FileText className="w-5 h-5 text-primary" strokeWidth={1.5} />,
  "Política de Privacidade": <FileText className="w-5 h-5 text-primary" strokeWidth={1.5} />,
  "Conformidade LGPD": <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.5} />,
  "Segurança & Criptografia": <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.5} />,
};

export const metadata = {
  title: "Segurança & Legal — OmniZeus",
  description:
    "Transparência, proteção de dados e segurança para a operação da sua empresa: Termos de Uso, Política de Privacidade, Conformidade LGPD e Segurança & Criptografia.",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] antialiased">
      <div className="border-b border-slate-200/80 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/5 border border-primary/15 px-3 py-1 rounded-full">
              Documentos Institucionais
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            Segurança & Legal
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-3 max-w-2xl leading-relaxed">
            Transparência, proteção de dados e segurança para a operação da sua empresa.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEGAL_DOCS.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="group bg-white border border-slate-200/70 hover:border-primary/30 rounded-2xl p-6 sm:p-7 transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-center group-hover:bg-primary/5 group-hover:border-primary/20 transition-colors">
                  {DOC_ICONS[doc.label]}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-4 tracking-tight">{doc.label}</h2>
              <p className="text-xs text-slate-500 leading-relaxed mt-1.5">{doc.description}</p>
              <span className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-bold text-primary">
                Ver documento
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10 bg-white border border-slate-200/70 rounded-2xl p-6 sm:p-7">
          <h2 className="text-sm font-bold text-slate-900">Nossa abordagem de segurança</h2>
          <p className="text-[13px] leading-relaxed text-slate-600 mt-2.5">
            A OmniZeus é uma plataforma SaaS B2B que opera com dados empresariais, informações de usuários
            e colaboradores, dados financeiros, integrações com serviços externos (Conta Azul, Stripe e
            provedores de inteligência artificial) e automações operacionais.
          </p>
          <p className="text-[13px] leading-relaxed text-slate-600 mt-2.5">
            Nosso compromisso é descrever nestes documentos, de forma transparente, como a plataforma
            funciona: quais dados são tratados, como o acesso é controlado, como o isolamento entre
            empresas é estruturado e quais mecanismos de proteção estão efetivamente implementados.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-200/70 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-500">
            <span>
              <span className="font-semibold text-slate-700">Versão:</span> {LEGAL_VERSION}
            </span>
            <span>
              <span className="font-semibold text-slate-700">Última atualização:</span> {LEGAL_LAST_UPDATED}
            </span>
            <span className="text-slate-300">|</span>
            <span>Documentos sujeitos a atualização conforme evolução da plataforma.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
