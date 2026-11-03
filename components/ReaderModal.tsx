// components/ReaderModal.tsx
'use client';

import { X, ExternalLink, Download } from 'lucide-react';

interface ReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfUrl: string;
  onMarkAsRead: () => void;
  isCompleted: boolean;
}

export default function ReaderModal({
  isOpen,
  onClose,
  title,
  pdfUrl,
  onMarkAsRead,
  isCompleted,
}: ReaderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="flex flex-col w-full max-w-5xl h-[92vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2 truncate pr-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
              FAB
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">{title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              title="Abrir em nova aba"
            >
              <ExternalLink size={18} />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Visualizador de PDF */}
        <div className="flex-1 bg-slate-950 w-full relative">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full border-none"
            title={title}
          />
        </div>

        {/* Rodapé com Ação de Conclusão */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-t border-slate-800">
          <span className="text-xs text-slate-400">
            {isCompleted ? '✅ Estudo registrado no seu perfil' : '⏳ Leitura pendente'}
          </span>
          <button
            onClick={onMarkAsRead}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isCompleted
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
            }`}
          >
            {isCompleted ? 'Concluído (Marcar novamente)' : 'Marcar como Lido'}
          </button>
        </div>
      </div>
    </div>
  );
}