"use client";

import React, { useRef, useState } from 'react';
import { Upload, FileText, FileSpreadsheet, Image as ImageIcon, X, CheckCircle, File as FileIcon } from 'lucide-react';

export type FileImportZoneProps = {
  onFileSelected: (file: File) => void;
  acceptedTypes?: string[];
  isProcessing?: boolean;
  progress?: number;
  label?: string;
};

export function FileImportZone({
  onFileSelected,
  acceptedTypes = ['.pdf', '.xlsx', '.xls', '.csv', '.docx', '.png', '.jpg', '.jpeg'],
  isProcessing = false,
  progress = 0,
  label = "Arraste e solte o arquivo aqui, ou clique para selecionar"
}: FileImportZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      checkAndSelectFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      checkAndSelectFile(file);
    }
  };

  const checkAndSelectFile = (file: File) => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (acceptedTypes.includes(extension) || acceptedTypes.includes(file.type)) {
      setSelectedFile(file);
      onFileSelected(file);
    } else {
      alert(`Tipo de arquivo não suportado. Aceitamos: ${acceptedTypes.join(', ')}`);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return <FileText size={32} className="text-red-500" />;
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileSpreadsheet size={32} className="text-green-500" />;
    if (['png', 'jpg', 'jpeg'].includes(ext || '')) return <ImageIcon size={32} className="text-blue-500" />;
    return <FileIcon size={32} className="text-slate-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      <div 
        className={`relative border-2 border-dashed rounded-lg p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${
          isDragging ? 'border-[#1E6FD9] bg-blue-50' : 
          selectedFile ? 'border-green-300 bg-green-50' : 
          'border-slate-300 bg-slate-50 hover:bg-slate-100'
        } ${isProcessing ? 'opacity-80 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept={acceptedTypes.join(',')}
        />

        {!selectedFile ? (
          <>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4 text-[#1E6FD9]">
              <Upload size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">{label}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tipos suportados: {acceptedTypes.join(', ')}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center w-full max-w-sm">
            <div className="flex items-center gap-4 w-full bg-white p-3 rounded border border-slate-200 shadow-sm relative">
              {getFileIcon(selectedFile.name)}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{formatSize(selectedFile.size)}</p>
              </div>
              
              {!isProcessing && (
                <button 
                  onClick={handleClear}
                  className="p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                  title="Remover arquivo"
                >
                  <X size={18} />
                </button>
              )}
              {isProcessing && progress === 100 && (
                <CheckCircle size={20} className="text-green-500" />
              )}
            </div>

            {isProcessing && (
              <div className="w-full mt-4">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Processando arquivo...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#1E6FD9] transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
