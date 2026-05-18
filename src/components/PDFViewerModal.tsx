import React from 'react';

interface PDFViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string | null;
    title?: string;
    onDownload?: () => void;
}

const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ 
    isOpen, 
    onClose, 
    pdfUrl, 
    title = 'Comprobante de Venta',
    onDownload
}) => {
    if (!isOpen || !pdfUrl) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined font-bold">description</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">{title}</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Vista Previa del Documento</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onDownload && (
                            <button 
                                onClick={onDownload}
                                className="h-10 px-4 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">download</span>
                                Descargar
                            </button>
                        )}
                        <button 
                            onClick={onClose} 
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-slate-100 dark:bg-zinc-800 p-4">
                    <iframe 
                        src={pdfUrl} 
                        className="w-full h-full rounded-xl shadow-inner border border-slate-200 dark:border-zinc-700 bg-white"
                        title="PDF Viewer"
                    />
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all"
                    >
                        Cerrar y Volver
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PDFViewerModal;
