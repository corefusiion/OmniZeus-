"use client";

import React, { useState, useMemo } from "react";
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  File,
  Check,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export type ColumnDef = {
  key: string;
  label: string;
  sortable?: boolean;
  type?: 'text' | 'currency' | 'date' | 'status' | 'badge';
};

export type DynamicTableProps = {
  columns: ColumnDef[];
  rows: Record<string, any>[];
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void;
  onFilter?: (query: string) => void;
  onSelect?: (selectedIds: string[]) => void;
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void;
  onBulkAction?: (action: string, selectedIds: string[]) => void;
  bulkActions?: { key: string; label: string; icon?: React.ReactNode; variant?: 'default' | 'danger' }[];
  emptyMessage?: string;
  pageSize?: number;
};

export function DynamicTable({
  columns,
  rows,
  onSort,
  onFilter,
  onSelect,
  onExport,
  onBulkAction,
  bulkActions,
  emptyMessage = "Nenhum dado encontrado.",
  pageSize = 5
}: DynamicTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Normalizar definições de colunas para aceitar tanto strings quanto objetos ColumnDef
  const normalizedColumns: ColumnDef[] = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    return columns.map((col: any) => {
      if (typeof col === "string") {
        return { key: col, label: col };
      }
      return {
        key: col.key || col.label || "col",
        label: col.label || col.key || "Coluna",
        type: col.type,
        sortable: col.sortable
      };
    });
  }, [columns]);

  const getRowValue = (row: Record<string, any>, col: ColumnDef) => {
    if (!row) return undefined;
    if (row[col.key] !== undefined && row[col.key] !== null) return row[col.key];

    const keyLower = col.key.toLowerCase();
    const labelLower = col.label.toLowerCase();

    // Property Aliases Fallbacks
    if (keyLower.includes("nome") || keyLower.includes("name") || labelLower.includes("nome") || labelLower.includes("razão")) {
      return row.name || row.nome || row.company_name || row.razao_social || row.tradeName || row.description || row.desc;
    }
    if (keyLower.includes("doc") || keyLower.includes("cnpj") || keyLower.includes("cpf") || labelLower.includes("doc") || labelLower.includes("cnpj")) {
      return row.document || row.documento || row.cnpj || row.cpf || row.cpf_cnpj;
    }
    if (keyLower.includes("email") || keyLower.includes("mail") || labelLower.includes("email") || labelLower.includes("contato")) {
      return row.email || row.contato || row.phone || row.telefone;
    }
    if (keyLower.includes("valor") || keyLower.includes("val") || labelLower.includes("valor") || labelLower.includes("preço")) {
      return row.valor || row.value || row.value_brl || row.amount;
    }
    if (keyLower.includes("situacao") || keyLower.includes("status") || labelLower.includes("status")) {
      return row.situacao || row.status;
    }
    if (keyLower.includes("vencimento") || keyLower.includes("data") || labelLower.includes("vencimento")) {
      return row.due_date || row.vencimento || row.data || row.data_vencimento;
    }

    return undefined;
  };

  // Filtrar dados pela busca
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(row => 
      normalizedColumns.some(col => {
        const val = getRowValue(row, col);
        return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
      })
    );
  }, [rows, normalizedColumns, searchQuery]);

  // Ordenar dados
  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const col = normalizedColumns.find(c => c.key === sortConfig.key) || { key: sortConfig.key, label: sortConfig.key };
      const valA = getRowValue(a, col);
      const valB = getRowValue(b, col);

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }

      return sortConfig.direction === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredRows, sortConfig, normalizedColumns]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);
  
  const paginatedRows = useMemo(() => {
    const start = (currentPageClamped - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPageClamped, pageSize]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = sortedRows.map((r, i) => r.id || String(i));
      const newSet = new Set(allIds);
      setSelectedIds(newSet);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
    onSelect?.(Array.from(newSet));
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    onSort?.(key, direction);
  };

  const renderCell = (row: Record<string, any>, col: ColumnDef) => {
    const value = getRowValue(row, col);

    if (col.type === 'currency') {
      const num = typeof value === 'number' ? value : parseFloat(String(value || 0));
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isNaN(num) ? 0 : num);
    }

    if (col.type === 'status') {
      const statusStr = String(value || '').toLowerCase();
      let colorClass = "bg-slate-100 text-slate-700 border-slate-200";
      if (statusStr.includes("ativo") || statusStr.includes("pago") || statusStr.includes("sucesso")) {
        colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
      } else if (statusStr.includes("inativo") || statusStr.includes("cancelado") || statusStr.includes("erro")) {
        colorClass = "bg-rose-50 text-rose-700 border-rose-200";
      } else if (statusStr.includes("pendente") || statusStr.includes("aguardando")) {
        colorClass = "bg-amber-50 text-amber-700 border-amber-200";
      }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${colorClass}`}>
          {String(value || 'N/A')}
        </span>
      );
    }

    if (col.type === 'badge') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          {String(value || 'N/A')}
        </span>
      );
    }

    return String(value ?? '-');
  };

  const isAllSelected = sortedRows.length > 0 && sortedRows.every((r, i) => selectedIds.has(r.id || String(i)));
  const isIndeterminate = sortedRows.some((r, i) => selectedIds.has(r.id || String(i))) && !isAllSelected;

  return (
    <div className="w-full bg-white border border-[#E2E8F0] rounded-lg shadow-2xs overflow-hidden">
      
      {/* Search & Export Toolbar */}
      <div className="p-3 border-b border-[#E2E8F0] flex items-center justify-between gap-3 bg-slate-50/50">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Filtrar dados na tabela..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-1 bg-white border border-[#E2E8F0] rounded-md text-xs outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Total: <strong>{sortedRows.length}</strong> registros</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 w-8">
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                />
              </th>
              {normalizedColumns.map(col => (
                <th 
                  key={col.key} 
                  className={`px-3 py-2.5 whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer hover:bg-slate-100 transition-colors select-none' : ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && (
                      <span className="inline-flex flex-col text-slate-400">
                        {sortConfig && sortConfig.key === col.key ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-emerald-600" /> : <ChevronDown size={12} className="text-emerald-600" />
                        ) : (
                          <ChevronDown size={12} className="opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={normalizedColumns.length + 1} className="px-4 py-6 text-center text-slate-400 font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, i) => {
                const rowId = row.id || String(i);
                const isSelected = selectedIds.has(rowId);
                return (
                  <tr key={rowId} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-emerald-50/20' : ''}`}>
                    <td className="px-3 py-2">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                      />
                    </td>
                    {normalizedColumns.map(col => (
                      <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de Paginação Embutida */}
      {sortedRows.length > pageSize && (
        <div className="p-2.5 border-t border-[#E2E8F0] bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Página <strong>{currentPageClamped}</strong> de <strong>{totalPages}</strong> ({sortedRows.length} registros)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPageClamped <= 1}
              className="px-2.5 py-1 bg-white border border-[#E2E8F0] hover:bg-slate-50 disabled:opacity-40 rounded font-medium transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPageClamped >= totalPages}
              className="px-2.5 py-1 bg-white border border-[#E2E8F0] hover:bg-slate-50 disabled:opacity-40 rounded font-medium transition-colors flex items-center gap-1"
            >
              Próximo <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
