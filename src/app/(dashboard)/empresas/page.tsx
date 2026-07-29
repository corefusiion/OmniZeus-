"use client";

import { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";

export default function EmpresasPage() {
  const [role, setRole] = useState<UserRole>("gestor");

  useEffect(() => {
    setRole(getActiveRole());
    const handleRoleChange = () => setRole(getActiveRole());
    window.addEventListener("omnizeus_role_change", handleRoleChange);
    return () => window.removeEventListener("omnizeus_role_change", handleRoleChange);
  }, []);

  if (role === "funcionario") {
    return (
      <div className="p-6 text-center text-slate-500 font-medium">
        Acesso restrito a Gestores.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Gestão de Empresas (Tenants)
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Administre as empresas e clientes associados ao seu escritório.
          </p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4 text-center text-slate-500 py-12">
        <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="font-semibold">Módulo em construção</p>
        <p className="text-xs">A listagem completa de clientes e filiais estará disponível nas próximas atualizações.</p>
      </div>
    </div>
  );
}
