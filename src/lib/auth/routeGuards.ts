// Guards de ROTA por módulo — OmniZeus
// Mesmo vocabulário de módulos usado no Sidebar (module: "..."):
//   omni-ia, contaazul, financeiro, tarefas, documentos, apresentacoes, whatsapp-bot, admin
// Semântica (idêntica ao menu):
//   - gestor / super_adm: nunca bloqueados.
//   - funcionario: só acessa a rota se o módulo dela estiver em allowedModules.
//   - rotas sem módulo (ex.: /dashboard): sempre acessíveis.
// Rotas SaaS (/dashboard-master, /empresas, /super-adm) são tratadas à parte.
import type { UserProfile } from "./roles";

export const ROUTE_MODULES: Record<string, string> = {
  "/omni-ia": "omni-ia",
  "/omni-contaazul-ia": "contaazul",
  "/treinar-agente": "omni-ia",
  "/estatisticas-ia": "omni-ia",
  "/financeiro": "financeiro",
  "/contratos": "financeiro",
  "/solicitacoes": "financeiro",
  "/contaazul": "contaazul",
  "/tarefas": "tarefas",
  "/documentos": "documentos",
  "/apresentacoes": "apresentacoes",
  "/whatsapp-bot": "whatsapp-bot",
  "/configuracoes": "admin",
  "/usuarios": "admin",
  "/permissoes": "admin",
};

export function getRouteModule(pathname: string): string | null {
  for (const [route, module] of Object.entries(ROUTE_MODULES)) {
    if (pathname === route || pathname.startsWith(route + "/")) return module;
  }
  return null;
}

export function canAccessRoute(user: UserProfile, pathname: string): boolean {
  if (!user.id) return true; // sessão não reidratada — nunca bloquear com base em default
  if (user.role !== "funcionario") return true; // gestor e super_adm acessam tudo do tenant
  const module = getRouteModule(pathname);
  if (!module) return true; // rotas sem módulo (Dashboard Executivo, etc.)
  return (user.allowedModules || []).includes(module);
}
