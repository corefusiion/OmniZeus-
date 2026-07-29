"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, ArrowRight } from "lucide-react";
import { loginUser } from "@/lib/auth/roles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = loginUser(email, password);
      setIsLoading(false);
      if (res.success) {
        router.push("/dashboard");
      } else {
        setErrorMsg(res.error || "Credenciais inválidas.");
      }
    }, 400);
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAF8" }}
    >
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between p-12 flex-shrink-0"
        style={{ background: "#181818" }}
      >
        <Link href="/" className="flex items-center gap-2.5 group w-fit">
          <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center group-hover:bg-gray-100 transition-colors">
            <span className="text-gray-900 font-bold" style={{ fontSize: 11 }}>Z</span>
          </div>
          <span className="text-white font-semibold text-base tracking-tight">OmniZeus</span>
        </Link>

        <div>
          <p className="text-[22px] font-medium text-white leading-snug tracking-tight mb-6">
            &ldquo;Centralizamos toda a operação do escritório. O que antes tomava horas, agora leva minutos.&rdquo;
          </p>
          <div>
            <p className="text-sm font-semibold text-gray-300">Patricia Fischer</p>
            <p className="text-xs text-gray-500 mt-0.5">Gestora de BPO · Grupo Fischer Contábil</p>
          </div>
        </div>

        <div>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Plataforma SaaS para Escritórios Contábeis<br />e Prestadores de BPO Financeiro no Brasil.
          </p>
          <p className="text-[10px] text-gray-700 mt-3">© 2025 OmniZeus</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-900 rounded-md flex items-center justify-center">
              <span className="text-white font-bold" style={{ fontSize: 11 }}>Z</span>
            </div>
            <span className="text-gray-900 font-semibold text-base tracking-tight">OmniZeus</span>
          </Link>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
              Acessar plataforma
            </h1>
            <p className="text-sm text-gray-500">
              Digite suas credenciais para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div
                className="p-3.5 rounded-lg border text-sm flex items-start gap-2.5"
                style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#DC2626" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                E-mail corporativo
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  style={{ width: 15, height: 15, strokeWidth: 1.5 }}
                />
                <input
                  id="login-email"
                  type="email"
                  placeholder="seu@escritorio.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="w-full h-11 pl-10 pr-4 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-700">Senha</label>
                <a href="#" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  Esqueci a senha
                </a>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  style={{ width: 15, height: 15, strokeWidth: 1.5 }}
                />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-11 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Mostrar/ocultar senha"
                >
                  {showPassword
                    ? <EyeOff style={{ width: 15, height: 15, strokeWidth: 1.5 }} />
                    : <Eye style={{ width: 15, height: 15, strokeWidth: 1.5 }} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Autenticando…
                </>
              ) : (
                <>
                  Entrar na plataforma
                  <ArrowRight style={{ width: 15, height: 15 }} />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-8">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              ← Voltar para a página inicial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
