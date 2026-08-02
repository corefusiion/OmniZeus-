"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import CompanyRagChat from "@/components/layout/CompanyRagChat";
import PostLoginBanner from "@/components/dashboard/PostLoginBanner";
import { getCurrentUser, getActiveCompanyId, rehydrateSession } from "@/lib/auth/roles";
import { canAccessRoute } from "@/lib/auth/routeGuards";
import { getCompanies, CompanyProfile } from "@/lib/company/store";
import { TenantProvider, useTenant } from "@/lib/tenant/TenantContext";
import { AlertTriangle, Lock, ExternalLink, ShieldAlert, CreditCard } from "lucide-react";

// Rotas exclusivas da PLATAFORMA SaaS (visíveis apenas para Super ADM em modo SaaS)
const SAAS_ROUTES = ["/dashboard-master", "/empresas", "/super-adm"];
// Rotas operacionais da EMPRESA (tenant). Quando Super ADM estiver em modo SaaS,
// essas rotas redirecionam para o Dashboard Master — dados de empresa nunca misturam.
const TENANT_ROUTES = [
  "/dashboard", "/omni-ia", "/omni-contaazul-ia", "/treinar-agente",
  "/estatisticas-ia", "/financeiro", "/contratos", "/solicitacoes",
  "/contaazul", "/tarefas", "/documentos", "/apresentacoes",
  "/configuracoes", "/usuarios", "/whatsapp-bot", "/permissoes"
];

function isRouteMatch(pathname: string, routes: string[]): boolean {
  return routes.some(r => pathname === r || pathname.startsWith(r + "/"));
}

function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeCompany, setActiveCompany] = useState<CompanyProfile | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [openingPortal, setOpeningPortal] = useState(false);

  const { isTenantMode, canSwitchCompany } = useTenant();

  // ── Guard de modo: Plataforma SaaS vs Empresa ──
  // Nunca misturar: rotas de empresa não são acessíveis em modo SaaS e vice-versa.
  useEffect(() => {
    if (!canSwitchCompany) return; // apenas Super ADM alterna modos
    if (isTenantMode && isRouteMatch(pathname, SAAS_ROUTES)) {
      router.replace("/dashboard");
    } else if (!isTenantMode && isRouteMatch(pathname, TENANT_ROUTES)) {
      router.replace("/dashboard-master");
    }
  }, [isTenantMode, pathname, router, canSwitchCompany]);

  // ── Guard de MÓDULOS (client-side) ──
  // Middleware cobre hard navigation; aqui cobrimos a navegação suave (router.push),
  // que não re-executa o middleware. Funcionário só acessa rotas dos módulos liberados;
  // gestor/super_adm nunca bloqueados; sessão não reidratada nunca bloqueia.
  useEffect(() => {
    if (!currentUser.id) return; // sessão ainda reidratando — não bloquear com default
    const isSuperAdmin = currentUser.role === "super_adm" || currentUser.email === "jsgleisson@gmail.com";
    if (!isSuperAdmin && isRouteMatch(pathname, SAAS_ROUTES)) {
      router.replace("/dashboard");
      return;
    }
    if (currentUser.role !== "funcionario") return;
    if (!canAccessRoute(currentUser, pathname)) {
      router.replace("/dashboard");
    }
  }, [pathname, currentUser, router]);

  const checkCompanyStatus = () => {
    setCurrentUser(getCurrentUser());
    const compId = getActiveCompanyId();
    const allComp = getCompanies();
    const found = allComp.find(c => c.id === compId);
    setActiveCompany(found || null);
  };

  useEffect(() => {
    // Rehydrate real user session from server HttpOnly cookie on mount
    rehydrateSession().then((user) => {
      if (user) {
        setCurrentUser(user);
        checkCompanyStatus();
      } else {
        checkCompanyStatus();
      }
    });

    window.addEventListener("omnizeus_company_context_change", checkCompanyStatus);
    window.addEventListener("omnizeus_companies_change", checkCompanyStatus);
    window.addEventListener("omnizeus_role_change", checkCompanyStatus);
    return () => {
      window.removeEventListener("omnizeus_company_context_change", checkCompanyStatus);
      window.removeEventListener("omnizeus_companies_change", checkCompanyStatus);
      window.removeEventListener("omnizeus_role_change", checkCompanyStatus);
    };
  }, []);

  const handleOpenStripePortal = async () => {
    if (!activeCompany) return;
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/checkout/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: activeCompany.id })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Não foi possível abrir o portal Stripe.");
        setOpeningPortal(false);
      }
    } catch (err) {
      alert("Falha de conexão com o servidor.");
      setOpeningPortal(false);
    }
  };

  const isSuperAdmin = currentUser.role === "super_adm" || currentUser.email === "jsgleisson@gmail.com";
  const isCompanySuspended = activeCompany && activeCompany.status === "Suspenso" && !isSuperAdmin;
  const isPastDueGrace = activeCompany && activeCompany.subscription_status === "past_due" && !isCompanySuspended;

  // Header com banner fixo fica mais alto quando o Super ADM está dentro de uma empresa
  const headerOffset = isTenantMode && canSwitchCompany ? "pt-[92px]" : "pt-16";

  // Render Suspended Access Screen for non-super_adm users
  if (isCompanySuspended) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] antialiased flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-200 shadow-2xl p-8 max-w-lg w-full text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200/80 flex items-center justify-center mx-auto shadow-2xs">
            <Lock className="w-7 h-7" strokeWidth={1.5} />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
              Acesso Temporariamente Suspenso
            </span>
            <h2 className="text-xl font-bold text-slate-900 pt-1">
              Assinatura com Pagamento Pendente
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              O acesso às funcionalidades da empresa <strong className="font-bold text-slate-900">{activeCompany.tradeName || activeCompany.corporateName}</strong> foi suspenso por pendência financeira no Stripe.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-left text-xs space-y-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              Seus Dados Estão 100% Preservados:
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Todos os seus saldos de OmniCoins, relatórios fiscais, minutas de documentos, tarefas da equipe e configurações da API Conta Azul permanecem salvos em segurança no banco de dados.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleOpenStripePortal}
              disabled={openingPortal}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>{openingPortal ? "Abrindo Stripe Portal..." : "Regularizar Assinatura no Stripe"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <p className="text-[10px] text-slate-400">
              Dúvidas? Entre em contato com o suporte do Super Admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] antialiased selection:bg-primary selection:text-white overflow-x-hidden">
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      <Header 
        isCollapsed={isCollapsed} 
        setIsMobileOpen={setIsMobileOpen}
      />

      <main 
        className={`${headerOffset} min-h-screen transition-all duration-300 ${
          isCollapsed ? "lg:pl-16" : "lg:pl-64"
        }`}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] w-full mx-auto space-y-6">
          {/* Grace Period Warning Banner */}
          {isPastDueGrace && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Aviso de Pagamento Pendente:</strong> Identificamos um problema no pagamento da sua assinatura. Sua conta está no período de tolerância
                  {activeCompany.grace_period_ends_at && (
                    <> até <strong className="font-bold">{new Date(activeCompany.grace_period_ends_at).toLocaleDateString('pt-BR')}</strong></>
                  )}.
                </span>
              </div>
              <button
                onClick={handleOpenStripePortal}
                disabled={openingPortal}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs self-start sm:self-auto"
              >
                <span>Atualizar Cartão no Stripe</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Banner pós-login: resumo do dia + caixa (uma vez por login) */}
          <PostLoginBanner />

          {children}
        </div>
      </main>

      {/* Assistente global "Pergunte sobre esta empresa" — apenas em modo empresa */}
      {isTenantMode && <CompanyRagChat />}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantProvider>
      <DashboardShell>{children}</DashboardShell>
    </TenantProvider>
  );
}

