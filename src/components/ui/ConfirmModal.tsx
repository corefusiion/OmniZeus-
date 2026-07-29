"use client";

import { AlertTriangle, Trash2, X, CheckCircle2, Info } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const iconVariants = {
    danger: { bg: 'bg-red-50 text-red-600 border-red-200', btn: 'bg-red-600 hover:bg-red-700 text-white', icon: Trash2 },
    warning: { bg: 'bg-amber-50 text-amber-600 border-amber-200', btn: 'bg-amber-600 hover:bg-amber-700 text-white', icon: AlertTriangle },
    info: { bg: 'bg-blue-50 text-[#1E6FD9] border-blue-200', btn: 'bg-[#1E6FD9] hover:bg-blue-600 text-white', icon: Info },
    success: { bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700 text-white', icon: CheckCircle2 },
  };

  const currentVariant = iconVariants[variant];
  const IconComponent = currentVariant.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xl max-w-sm w-full p-6 space-y-4 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-xs ${currentVariant.bg}`}>
            <IconComponent className="w-5 h-5" strokeWidth={1.75} />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">{title}</h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors shadow-xs"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors ${currentVariant.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
