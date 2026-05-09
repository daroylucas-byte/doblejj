import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Proveedor {
    id: string;
    razon_social: string;
    saldo_actual: number;
}

interface PagoProveedorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    proveedor: Proveedor | null;
}

const PagoProveedorModal: React.FC<PagoProveedorModalProps> = ({ isOpen, onClose, onSuccess, proveedor }) => {
    const [monto, setMonto] = useState<number>(0);
    const [formaPago, setFormaPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'cuenta_corriente'>('efectivo');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [referencia, setReferencia] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && proveedor) {
            setMonto(0);
            setReferencia('');
            setError(null);
        }
    }, [isOpen, proveedor]);

    if (!isOpen || !proveedor) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (monto <= 0) {
            setError('El monto debe ser mayor a 0');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const currentUserId = user?.id;

            // 1. Register the payment in pagos_proveedores (remains same)
            const { error: pagoErr } = await supabase
                .from('pagos_proveedores')
                .insert([{
                    proveedor_id: proveedor.id,
                    monto: monto,
                    forma_pago: formaPago,
                    referencia: referencia,
                    fecha: fecha,
                    estado: 'acreditado',
                    usuario_id: currentUserId
                }]);

            if (pagoErr) throw pagoErr;

            // BUG 2 FIX: Register in account history without 'saldo_acumulado'
            // The view 'vista_cuenta_corriente_proveedores' handles all calculations.
            // Removed legacy balance fetch (Step 2) and manual update (Step 4).
            const { error: ccErr } = await supabase
                .from('cuenta_corriente_proveedores')
                .insert([{
                    proveedor_id: proveedor.id,
                    fecha: fecha,
                    tipo: 'pago',
                    concepto: `Pago a Proveedor - ${formaPago.toUpperCase()}${referencia ? ` (${referencia})` : ''}`,
                    monto: monto,
                    usuario_id: currentUserId
                }]);

            if (ccErr) throw ccErr;

            alert(`Pago de $${monto.toLocaleString()} registrado con éxito.`);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error processing supplier payment:', err);
            setError(err.message || 'Error al procesar el pago');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <span className="material-symbols-outlined font-bold">payments</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Registrar Pago a Proveedor</h3>
                            <p className="text-xs text-slate-500 font-medium">{proveedor.razon_social}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 flex items-center gap-3 rounded-r-lg">
                            <span className="material-symbols-outlined">error</span>
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Actual</p>
                            {/* BUG 2 FIX: Use Math.abs and check > 0 for debt (Vista Convention) */}
                            <p className={`text-2xl font-black ${proveedor.saldo_actual > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                $ {Math.abs(proveedor.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</p>
                            <p className={`text-sm font-bold ${proveedor.saldo_actual > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {proveedor.saldo_actual > 0 ? 'DEUDA' : 'SALDO A FAVOR'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fecha de Pago</label>
                                <input
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Forma de Pago</label>
                                <select
                                    value={formaPago}
                                    onChange={(e) => setFormaPago(e.target.value as any)}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Monto a Pagar ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={monto}
                                onChange={(e) => setMonto(parseFloat(e.target.value))}
                                className="w-full h-14 px-6 bg-indigo-50/30 dark:bg-indigo-500/5 border-2 border-indigo-100 dark:border-indigo-500/20 rounded-2xl text-2xl font-black text-indigo-600 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                                placeholder="0.00"
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Referencia / Observaciones</label>
                            <input
                                type="text"
                                value={referencia}
                                onChange={(e) => setReferencia(e.target.value)}
                                className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                placeholder="Nro operación, banco, etc..."
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] h-12 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <span>Confirmar Pago</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PagoProveedorModal;
