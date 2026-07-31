"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Building2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  RefreshCw
} from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id") || "";

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);

  const fetchOrder = async () => {
    try {
      const res = await fetch("/api/db?table=purchase_orders");
      if (res.ok) {
        const json = await res.json();
        const orders = json.data || [];
        const found = orders.find((o: any) => o.id === orderId || o.order_number === orderId);
        if (found) {
          setOrder(found);
        }
      }
    } catch (err) {
      console.error("Error fetching order:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      // Poll every 3 seconds to auto-update when Webhook confirms payment
      const interval = setInterval(fetchOrder, 3000);
      return () => clearInterval(interval);
    }
  }, [orderId]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 flex flex-col justify-center items-center p-4 md:p-8">
      <div className="max-w-xl w-full bg-white border border-slate-200 shadow-xl rounded-2xl p-6 md:p-10 space-y-8">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
            <CheckCircle2 size={32} className="stroke-[1.5]" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
            Pedido de Compra Registrado
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Obrigado por escolher a OmniZeus!
          </h1>
          <p className="text-slate-600 text-xs md:text-sm max-w-lg">
            Seu pedido de compra foi recebido e está sendo processado pelo fluxo oficial de cobrança do Stripe.
          </p>
        </div>

        {/* Order Details Card */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
            Carregando detalhes do pedido...
          </div>
        ) : order ? (
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Número do Pedido
                </span>
                <div className="text-base font-bold text-slate-900 font-mono">{order.id}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Status
                </span>
                <div>
                  {order.status === "PROVISIONADO" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 size={12} /> Empresa Provisionada
                    </span>
                  ) : order.status === "PAGAMENTO_CONFIRMADO" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                      <Clock size={12} /> Pago • Aguardando Provisionamento
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      <RefreshCw size={11} className="animate-spin text-amber-600" /> Processando Confirmação Stripe...
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Empresa</span>
                <span className="font-semibold text-slate-800">{order.empresa_nome}</span>
                <span className="text-[10px] text-slate-400 block font-mono">{order.empresa_cnpj}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Responsável</span>
                <span className="font-semibold text-slate-800">{order.responsavel_nome}</span>
                <span className="text-[10px] text-slate-400 block">{order.responsavel_email}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Plano Contratado</span>
                <span className="font-bold text-slate-900">{order.plan_name}</span>
                <span className="text-[10px] text-emerald-600 font-medium block">
                  {order.coins_franchise?.toLocaleString("pt-BR")} OmniCoins/mês
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Valor Inicial</span>
                <span className="font-bold text-slate-900">
                  R$ {order.total_initial_payment?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                {order.incluir_conta_azul && (
                  <span className="text-[10px] text-slate-500 block">+ Setup Conta Azul (R$ 39,90)</span>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Workflow Info Alert */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5 flex gap-3 items-start text-xs text-slate-600">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900">Homologação e Provisionamento de Agentes</h4>
            <p className="leading-relaxed text-slate-500 text-[11px]">
              Assim que o Webhook do Stripe confirmar a transação, a equipe Master efetuará o provisionamento da sua empresa e enviará as credenciais de primeiro acesso para o seu e-mail cadastrado.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={() => router.push("/")}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            Voltar para a Página Inicial
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs">Carregando...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
