"use client";

import { useState, useEffect } from "react";
import { 
  Coins, 
  Search, 
  Bell, 
  Menu, 
  Command,
  X,
  LogOut,
  ShieldCheck,
  UserCheck,
  Briefcase
} from "lucide-react";
import { getCurrentUser, logoutUser, UserProfile, ROLE_LABELS } from "@/lib/auth/roles";
import { getCoinBalance } from "@/lib/coins/store";

import NotificationsFilter from "@/components/ui/NotificationsFilter";

export function Header({ 
  isCollapsed, 
  setIsMobileOpen 
}: { 
  isCollapsed: boolean;
  setIsMobileOpen: (val: boolean) => void;
}) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(getCurrentUser());
  const [balance, setBalance] = useState<number>(14250);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setBalance(getCoinBalance());

    const handleUserChange = () => setCurrentUser(getCurrentUser());
    const handleCoinsChange = () => setBalance(getCoinBalance());

    window.addEventListener("omnizeus_role_change", handleUserChange);
    window.addEventListener("omnizeus_user_change", handleUserChange);
    window.addEventListener("omnizeus_coins_change", handleCoinsChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleUserChange);
      window.removeEventListener("omnizeus_user_change", handleUserChange);
      window.removeEventListener("omnizeus_coins_change", handleCoinsChange);
    };
  }, []);

  return (
    <header 
      className={`h-14 bg-white border-b border-gray-200 fixed top-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 transition-all duration-300 ${
        isCollapsed ? "left-0 lg:left-16" : "left-0 lg:left-64"
      }`}
    >
      {/* Left: Mobile Toggle & Search */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Company Badge / Title */}
        <div className="hidden sm:flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-gray-900 tracking-tight">
              {currentUser.companyName || "Zenitus Inteligência Contábil"}
            </h2>
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium border border-gray-200">
              Matriz
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-normal">CNPJ: 42.189.902/0001-55</p>
        </div>

        {/* Global Search Input */}
        <div className="relative ml-2 sm:ml-6 hidden md:block">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar obrigações, guias, clientes ou IA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 lg:w-80 h-8 pl-8 pr-12 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:bg-white transition-all text-gray-900 placeholder:text-gray-400"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-200/60 rounded text-[9px] font-medium text-gray-500">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* OmniCoins Balance Widget (Hidden for Funcionario) */}
        {currentUser.role !== "funcionario" && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1 rounded-lg transition-all hover:bg-gray-100">
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            <div className="text-xs">
              <span className="text-gray-500 font-normal hidden xl:inline">Saldo OmniCoins: </span>
              <span className="font-semibold text-gray-900">{balance.toLocaleString('pt-BR')}</span>
              <span className="text-[10px] text-gray-400 ml-1 hidden lg:inline">(~R$ {(balance * 0.1).toFixed(2)})</span>
            </div>
          </div>
        )}

        {/* Interactive Notifications Trigger */}
        <NotificationsFilter />
        {/* Logged User Role Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700">
          {currentUser.role === 'super_adm' && <ShieldCheck className="w-3.5 h-3.5 text-gray-700" strokeWidth={1.5} />}
          {currentUser.role === 'gestor' && <UserCheck className="w-3.5 h-3.5 text-gray-700" strokeWidth={1.5} />}
          {currentUser.role === 'funcionario' && <Briefcase className="w-3.5 h-3.5 text-gray-700" strokeWidth={1.5} />}
          <span>{ROLE_LABELS[currentUser.role]?.label}</span>
        </div>

        {/* Clean User Profile Avatar & Logout Button */}
        <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
          <div className="w-7 h-7 rounded-lg bg-gray-900 text-white font-semibold flex items-center justify-center text-xs">
            {currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="text-xs hidden xl:block">
            <p className="font-semibold text-gray-900 leading-tight">{currentUser.name}</p>
            <p className="text-[10px] text-gray-400 font-normal">{currentUser.email}</p>
          </div>
          <button
            onClick={logoutUser}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Sair do Sistema (Logout)"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
  );
}
