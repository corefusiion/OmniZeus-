"use client";

import * as React from "react";
import {
  Bell,
  Info,
  AlertCircle,
  Calendar,
  Filter,
  CheckCircle2
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

export type NotificationCategory = "all" | "updates" | "alerts" | "reminders";

export interface NotificationItem {
  id: string;
  category: "updates" | "alerts" | "reminders";
  icon: React.ReactNode;
  title: string;
  description: string;
  time: string;
  read?: boolean;
}

const defaultNotifications: NotificationItem[] = [
  {
    id: "1",
    category: "alerts",
    icon: <AlertCircle className="h-4 w-4 text-red-500" />,
    title: "Guia DAS Pendente",
    description: "A guia do Simples Nacional (Posto Shell) vence amanhã.",
    time: "há 12 min",
    read: false,
  },
  {
    id: "2",
    category: "reminders",
    icon: <Calendar className="h-4 w-4 text-amber-500" />,
    title: "Vencimento de Certificado A1",
    description: "O certificado digital da Construtora S/A expira em 5 dias.",
    time: "há 1 hora",
    read: false,
  },
  {
    id: "3",
    category: "updates",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    title: "Análise da Folha (IA)",
    description: "Gemini 2.5 Pro concluiu a revisão do eSocial com sucesso.",
    time: "há 3 horas",
    read: true,
  },
  {
    id: "4",
    category: "updates",
    icon: <Info className="h-4 w-4 text-blue-500" />,
    title: "Atualização OmniZeus",
    description: "Novos recursos de WhatsApp Kanban foram liberados.",
    time: "ontem",
    read: true,
  },
];

const categories = [
  { key: "all", label: "Todas" },
  { key: "updates", label: "Atualizações" },
  { key: "alerts", label: "Alertas" },
  { key: "reminders", label: "Lembretes" },
];

export default function NotificationsFilter() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<NotificationCategory>("all");
  const [items, setItems] = useState<NotificationItem[]>(defaultNotifications);
  
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredItems =
    selected === "all"
      ? items
      : items.filter((item) => item.category === selected);

  const unreadCount = items.filter(i => !i.read).length;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        title="Notificações"
      >
        <Bell className="w-5 h-5" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header with filter icon */}
          <div className="flex justify-between items-center border-b border-gray-100 px-4 py-3 bg-gray-50/50">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> 
              Notificações
            </h2>
            {unreadCount > 0 && (
              <button
                onClick={() => setItems(items.map(i => ({ ...i, read: true })))}
                className="text-[10px] text-primary hover:underline font-semibold"
              >
                Marcar lidas
              </button>
            )}
          </div>

          {/* Category buttons */}
          <div className="flex gap-2 px-4 py-2.5 border-b border-gray-100 overflow-x-auto custom-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelected(cat.key as NotificationCategory)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selected === cat.key 
                    ? "bg-primary text-white" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Notifications list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 bg-white">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center flex flex-col items-center gap-2">
                <Bell className="w-6 h-6 text-gray-300" />
                <p>Nenhuma notificação na categoria.</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-default ${!item.read ? 'bg-primary/10/20' : ''}`}
                >
                  <div className="flex justify-between items-start mb-1.5 gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${!item.read ? 'bg-white shadow-xs' : 'bg-transparent'}`}>
                        {item.icon}
                      </div>
                      <span className={`text-sm ${!item.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {item.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 shrink-0 mt-0.5">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed pl-8">
                    {item.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
