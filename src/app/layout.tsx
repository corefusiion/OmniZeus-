import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OmniZeus — Plataforma SaaS B2B para Contabilidade & BPO',
  description: 'Plataforma All-in-One de Inteligência Artificial, Gestão Financeira, WhatsApp Bot e Tarefas Operacionais para escritórios contábeis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased selection:bg-primary selection:text-white">
        {children}
      </body>
    </html>
  );
}
