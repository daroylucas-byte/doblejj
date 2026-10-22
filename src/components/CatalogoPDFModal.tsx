import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import PDFViewerModal from './PDFViewerModal';
import { generateCatalogPDF } from '../utils/pdfGenerator';
import type { ProductoCatalogo, TipoPrecioCatalogo } from '../utils/pdfGenerator';

export interface ProductoSeleccionado extends ProductoCatalogo {
    id: string;
    stock_actual: number;
}

interface CatalogoPDFModalProps {
    isOpen: boolean;
    onClose: () => void;
    productos: ProductoSeleccionado[];
}

const TIPOS_PRECIO: { value: TipoPrecioCatalogo; label: string }[] = [
    { value: 'precio_minorista', label: 'Minorista' },
    { value: 'precio_mayorista', label: 'Mayorista' },
    { value: 'precio_revendedor', label: 'Revendedor' },
];

const CatalogoPDFModal: React.FC<CatalogoPDFModalProps> = ({ isOpen, onClose, productos }) => {
    const [tipoPrecio, setTipoPrecio] = useState<TipoPrecioCatalogo>('precio_minorista');
    const [titulo, setTitulo] = useState('');
    const [blob, setBlob] = useState<Blob | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const tituloPorDefecto = () => `Lista de precios ${format(new Date(), 'dd/MM/yyyy')}`;

    useEffect(() => {
        if (isOpen) {
            setTitulo(tituloPorDefecto());
            setTipoPrecio('precio_minorista');
        }
    }, [isOpen]);

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const sinStock = productos.filter(p => p.stock_actual <= 0);
    const sinPrecio = productos.filter(p => !p[tipoPrecio] || p[tipoPrecio] <= 0);
    const nombreArchivo = `catalogo-doblejj-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

    const handleGenerar = () => {
        const result = generateCatalogPDF(productos, tipoPrecio, titulo.trim() || tituloPorDefecto());
        if (!result) return;
        setBlob(result);
        setPdfUrl(URL.createObjectURL(result));
    };

    const handleCerrarVista = () => {
        setPdfUrl(null);
        setBlob(null);
    };

    const handleDescargar = () => {
        if (!pdfUrl) return;
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = nombreArchivo;
        a.click();
    };

    const handleCompartir = async () => {
        if (!blob) return;
        const file = new File([blob], nombreArchivo, { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: titulo });
            } catch (e) {
                // El usuario cerró el menú de compartir: no es un error
                if ((e as Error).name !== 'AbortError') console.error('Error al compartir:', e);
            }
        } else {
            handleDescargar();
        }
    };

    if (!isOpen) return null;

    if (pdfUrl) {
        return (
            <PDFViewerModal
                isOpen
                onClose={handleCerrarVista}
                pdfUrl={pdfUrl}
                title="Catálogo de Productos"
                onDownload={handleDescargar}
                onShare={handleCompartir}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                    <div>
                        <h3 className="text-lg font-bold">Generar Catálogo PDF</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {productos.length} {productos.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Tipo de precio</label>
                        <div className="grid grid-cols-3 gap-2">
                            {TIPOS_PRECIO.map(t => (
                                <button
                                    key={t.value}
                                    onClick={() => setTipoPrecio(t.value)}
                                    className={`h-10 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoPrecio === t.value ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-600'}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Título</label>
                        <input
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                        />
                    </div>

                    {sinPrecio.length > 0 && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-600 text-xs font-bold">
                            {sinPrecio.length} {sinPrecio.length === 1 ? 'producto tiene' : 'productos tienen'} precio $0 en este tipo de precio:{' '}
                            {sinPrecio.slice(0, 3).map(p => p.nombre).join(', ')}{sinPrecio.length > 3 ? '...' : ''}
                        </div>
                    )}

                    {sinStock.length > 0 && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-amber-600 text-xs font-bold">
                            {sinStock.length} {sinStock.length === 1 ? 'producto está sin stock' : 'productos están sin stock'}:{' '}
                            {sinStock.slice(0, 3).map(p => p.nombre).join(', ')}{sinStock.length > 3 ? '...' : ''}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerar}
                        disabled={productos.length === 0}
                        className="px-6 py-3 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        Generar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CatalogoPDFModal;
