import React, { useState, useEffect } from 'react';
import { MOTIVOS_ANULACION } from '../utils/anulaciones';
import type { MotivoAnulacion } from '../utils/anulaciones';

interface AnularMotivoModalProps {
    isOpen: boolean;
    onClose: () => void;
    titulo: string;
    resumen: string;
    descripcion?: string;
    advertencia: string;
    textoBoton: string;
    onConfirm: (motivo: MotivoAnulacion, detalle: string | null) => Promise<void>;
}

const AnularMotivoModal: React.FC<AnularMotivoModalProps> = ({
    isOpen, onClose, titulo, resumen, descripcion, advertencia, textoBoton, onConfirm
}) => {
    const [motivo, setMotivo] = useState<MotivoAnulacion>('error_carga');
    const [detalle, setDetalle] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setMotivo('error_carga');
            setDetalle('');
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (motivo === 'otro' && !detalle.trim()) {
            setError('El motivo "Otro" requiere un detalle.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await onConfirm(motivo, detalle.trim() || null);
            onClose();
        } catch (err: any) {
            console.error('Error en anulación:', err);
            setError(err.message || 'Error al anular');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                    <div>
                        <h3 className="text-lg font-bold">{titulo}</h3>
                        <p className="text-xs text-slate-500 font-medium">{resumen}</p>
                        {descripcion && <p className="text-[10px] text-slate-400 line-clamp-1">{descripcion}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-sm font-medium rounded-r-lg">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo</label>
                        {MOTIVOS_ANULACION.map(m => (
                            <label
                                key={m.value}
                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${motivo === m.value ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'}`}
                            >
                                <input
                                    type="radio"
                                    name="motivo"
                                    checked={motivo === m.value}
                                    onChange={() => setMotivo(m.value)}
                                    className="mt-1 accent-primary"
                                />
                                <span>
                                    <span className="block text-sm font-bold">{m.label}</span>
                                    <span className="block text-[11px] text-slate-500">{m.ayuda}</span>
                                </span>
                            </label>
                        ))}
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            Detalle {motivo === 'otro' ? '(obligatorio)' : '(opcional)'}
                        </label>
                        <textarea
                            value={detalle}
                            onChange={(e) => setDetalle(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50"
                            placeholder="Ej: se cargó en otro cliente"
                        />
                    </div>

                    <p className="text-[11px] text-slate-500">{advertencia}</p>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Anulando...' : textoBoton}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AnularMotivoModal;
