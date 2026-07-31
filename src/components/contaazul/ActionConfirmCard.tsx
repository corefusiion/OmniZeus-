"use client";

import React from 'react';
import { 
  UserPlus, 
  DollarSign, 
  FileText, 
  Settings, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle
} from 'lucide-react';

export type ActionData = {
  id: string;
  type: string;
  label: string;
  description: string;
  data: Record<string, any>;
  requiresConfirmation: boolean;
  status: 'pending' | 'executing' | 'success' | 'error';
  errorReason?: string;
};

export type ActionConfirmCardProps = {
  action: ActionData;
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
};

export function ActionConfirmCard({ action, onConfirm, onCancel }: ActionConfirmCardProps) {
  
  const getIcon = () => {
    switch (action.type) {
      case 'CREATE_CLIENT': return <UserPlus size={24} className="text-blue-600" />;
      case 'CREATE_ENTRY': return <DollarSign size={24} className="text-emerald-600" />;
      case 'UPDATE_DOCUMENT': return <FileText size={24} className="text-purple-600" />;
      default: return <Settings size={24} className="text-slate-600" />;
    }
  };

  const getStatusIndicator = () => {
    switch (action.status) {
      case 'pending': 
        return <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" title="Aguardando confirmação" />;
      case 'executing': 
        return <Loader2 size={18} className="text-[#1E6FD9] animate-spin" title="Executando..." />;
      case 'success': 
        return <CheckCircle2 size={18} className="text-green-500" title="Concluído" />;
      case 'error': 
        return <XCircle size={18} className="text-red-500" title="Erro" />;
      default: 
        return null;
    }
  };

  const isPending = action.status === 'pending';

  return (
    <div className={`bg-white rounded-lg border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${
      action.status === 'success' ? 'border-green-200' : 
      action.status === 'error' ? 'border-red-200' : 
      'border-slate-200'
    }`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
               action.type === 'CREATE_CLIENT' ? 'bg-blue-50' : 
               action.type === 'CREATE_ENTRY' ? 'bg-emerald-50' : 
               action.type === 'UPDATE_DOCUMENT' ? 'bg-purple-50' : 
               'bg-slate-50'
            }`}>
              {getIcon()}
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                {action.label}
                {getStatusIndicator()}
              </h4>
              <p className="text-sm text-slate-500 mt-0.5">{action.description}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-md p-3 mb-5 border border-slate-100">
          <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Dados Propostos</h5>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(action?.data || {}).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-sm text-slate-800 font-medium truncate" title={String(value)}>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isPending && action.requiresConfirmation && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => onConfirm(action.id)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors flex justify-center items-center gap-2"
            >
              <CheckCircle2 size={16} />
              Aprovar Ação
            </button>
            <button
              onClick={() => onCancel(action.id)}
              className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2 px-4 rounded-md transition-colors flex justify-center items-center gap-2"
            >
              <XCircle size={16} />
              Descartar
            </button>
          </div>
        )}

        {action.status === 'error' && (
          <div className="mt-4 pt-4 border-t border-red-100">
            <div className="flex flex-col gap-1 text-red-600 text-sm font-medium bg-red-50 p-2.5 rounded border border-red-100">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <span>Ocorreu um erro ao processar esta ação.</span>
              </div>
              {action.errorReason && (
                <div className="text-xs text-red-500 font-normal mt-1 break-words">
                  {action.errorReason}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
