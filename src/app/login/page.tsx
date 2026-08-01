"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, ArrowRight, KeyRound, CheckCircle2, XCircle, ShieldAlert, Check } from "lucide-react";
import { setCurrentUser, setActiveCompanyContext } from "@/lib/auth/roles";
import { validatePasswordRequirements } from "@/lib/auth/passwordUtils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mandatory First Access State
  const [mustChangePasswordMode, setMustChangePasswordMode] = useState(false);
  const [loggedUser, setLoggedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changeErrorMsg, setChangeErrorMsg] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const passwordChecks = validatePasswordRequirements(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        // Sync client-side roles module
        setCurrentUser(data.user);

        // Todo login novo do Super ADM começa no modo SaaS (centro de controle),
        // descartando qualquer resíduo de tenant de sessão anterior.
        if (data.user.role === "super_adm") {
          setActiveCompanyContext(null);
        }

        // Check if mandatory first login password change is required
        if (data.mustChangePassword === true || data.user.mustChangePassword === true) {
          setLoggedUser(data.user);
          setMustChangePasswordMode(true);
        } else {
          // Super ADM entra direto no Dashboard Master SaaS (plataforma).
          // Gestores/funcionários vão para o Dashboard Executivo da empresa.
          window.location.href = data.user.role === "super_adm" ? "/dashboard-master" : "/dashboard";
        }
      } else {
        setErrorMsg(data.error || "Credenciais inválidas.");
      }
    } catch {
      setErrorMsg("Falha de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstAccessChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeErrorMsg(null);

    if (!newPassword || !confirmPassword) {
      setChangeErrorMsg("Preencha a nova senha e a confirmação.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeErrorMsg("A nova senha e a confirmação não coincidem.");
      return;
    }

    if (!passwordChecks.isValid) {
      setChangeErrorMsg("A senha deve cumprir todos os 5 requisitos de segurança abaixo.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: loggedUser?.id,
          newPassword,
          confirmPassword
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.user) {
          setCurrentUser(data.user);
          if (data.user.role === "super_adm") {
            setActiveCompanyContext(null);
          }
        }
        window.location.href = data.user?.role === "super_adm" ? "/dashboard-master" : "/dashboard";
      } else {
        setChangeErrorMsg(data.error || "Erro ao definir nova senha.");
      }
    } catch {
      setChangeErrorMsg("Falha de comunicação com o servidor.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAF8" }}
    >
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between p-12 flex-shrink-0 bg-primary"
      >
        <Link href="/" className="flex items-center gap-2.5 group w-fit">
          <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center group-hover:bg-white/90 transition-colors">
            <span className="text-primary font-bold" style={{ fontSize: 11 }}>Z</span>
          </div>
          <span className="text-white font-semibold text-base tracking-tight">OmniZeus</span>
        </Link>

        <div>
          <p className="text-[22px] font-medium text-white leading-snug tracking-tight mb-6">
            &ldquo;Centralizamos toda a operação do escritório. O que antes tomava horas, agora leva minutos.&rdquo;
          </p>
          <div>
            <p className="text-sm font-semibold text-white/90">Patricia Fischer</p>
            <p className="text-xs text-white/70 mt-0.5">Gestora de BPO · Grupo Fischer Contábil</p>
          </div>
        </div>

        <div>
          <p className="text-[11px] text-white/60 leading-relaxed">
            Plataforma SaaS para Escritórios Contábeis<br />e Prestadores de BPO Financeiro no Brasil.
          </p>
          <p className="text-[10px] text-white/40 mt-3">© 2025 OmniZeus</p>
        </div>
      </div>

      {/* Right panel — login form or first access mandatory change screen */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
              <span className="text-white font-bold" style={{ fontSize: 11 }}>Z</span>
            </div>
            <span className="text-gray-900 font-semibold text-base tracking-tight">OmniZeus</span>
          </Link>
        </div>

        <div className="w-full max-w-[400px]">
          {!mustChangePasswordMode ? (
            /* STANDARD LOGIN FORM */
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                  Acessar plataforma
                </h1>
                <p className="text-sm text-gray-500">
                  Insira suas credenciais de acesso para continuar.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    E-mail Corporativo
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="seu.email@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                    />
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-11 pl-10 pr-11 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                    />
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600 absolute right-3.5 top-3.5 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-primary hover:opacity-90 text-white font-semibold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  <span>{isLoading ? "Autenticando..." : "Entrar no Sistema"}</span>
                  {!isLoading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </>
          ) : (
            /* MANDATORY FIRST ACCESS PASSWORD CHANGE SCREEN */
            <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-lg">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-amber-100 border border-amber-200 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Primeiro Acesso Obligatório</h2>
                <p className="text-xs text-slate-600">
                  Bem-vindo à <strong>OmniZeus</strong>! Por razões de segurança, é necessário cadastrar uma nova senha pessoal para continuar.
                </p>
              </div>

              {changeErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{changeErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleFirstAccessChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-10 pl-9 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-primary"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-slate-400 hover:text-slate-600 absolute right-3 top-3"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-10 pl-9 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-primary"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                {/* Password Security Policy Checklist */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
                  <span className="font-bold text-slate-700 block mb-1">Requisitos de Segurança da Senha:</span>
                  <div className="grid grid-cols-1 gap-1">
                    <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.checks.minLength ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                      {passwordChecks.checks.minLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>Mínimo de 8 caracteres</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.checks.hasUpper ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                      {passwordChecks.checks.hasUpper ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>Pelo menos uma letra maiúscula (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.checks.hasLower ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                      {passwordChecks.checks.hasLower ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>Pelo menos uma letra minúscula (a-z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.checks.hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                      {passwordChecks.checks.hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>Pelo menos um número (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${passwordChecks.checks.hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                      {passwordChecks.checks.hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-300" />}
                      <span>Pelo menos um caractere especial (!@#$%&*)</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword || !passwordChecks.isValid}
                  className="w-full h-11 bg-primary hover:opacity-90 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                  <span>{isChangingPassword ? "Atualizando..." : "Definir Nova Senha & Acessar"}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
