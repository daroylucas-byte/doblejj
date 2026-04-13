import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Cliente {
    id: string;
    razon_social: string;
    saldo_actual: number;
}

interface VentaPendiente {
    id: string;
    numero: string;
    fecha: string;
    total: number;
    total_pagado: number;
    saldo_pendiente: number;
}

interface CobroModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    cliente: Cliente | null;
}

const CobroModal: React.FC<CobroModalProps> = ({ isOpen, onClose, onSuccess, cliente }) => {
    const [monto, setMonto] = useState<number>(0);
    const [formaPago, setFormaPago] = useState<'efectivo' | 'transferencia' | 'cheque' | 'icheque'>('efectivo');
    const [fechaVencimiento, setFechaVencimiento] = useState(new Date().toISOString().split('T')[0]);
    const [referencia, setReferencia] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ventasPendientes, setVentasPendientes] = useState<VentaPendiente[]>([]);

    useEffect(() => {
        if (isOpen && cliente) {
            fetchVentasPendientes();
            setMonto(0);
            setReferencia('');
        }
    }, [isOpen, cliente]);

    const fetchVentasPendientes = async () => {
        if (!cliente) return;
        try {
            const { data, error } = await supabase
                .from('ventas')
                .select('id, numero, fecha, total, total_pagado, saldo_pendiente')
                .eq('cliente_id', cliente.id)
                .gt('saldo_pendiente', 0)
                .not('estado', 'in', '("presupuesto","cancelada")')
                .order('fecha', { ascending: true });

            if (error) throw error;
            setVentasPendientes(data || []);
        } catch (err) {
            console.error('Error fetching pending sales:', err);
        }
    };

    if (!isOpen || !cliente) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (monto <= 0) {
            setError('El monto debe ser mayor a 0');
            return;
        }

        if ((formaPago === 'cheque' || formaPago === 'icheque') && !fechaVencimiento) {
            setError('La fecha de vencimiento es obligatoria para cobros con cheque.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const currentUserId = user?.id;

            let remainingAmount = monto;
            const appliedPayments = [];

            // 1. Distribute among pending sales (FIFO)
            for (const venta of ventasPendientes) {
                if (remainingAmount <= 0) break;

                const appliedToThisVenta = Math.min(remainingAmount, Number(venta.saldo_pendiente));
                
                // Create payment record for this sale
                const { error: pagoErr } = await supabase
                    .from('pagos')
                    .insert([{
                        venta_id: venta.id,
                        cliente_id: cliente.id,
                        monto: appliedToThisVenta,
                        forma_pago: formaPago,
                        referencia: referencia || `Pago FIFO - Ref Venta #${venta.numero || venta.id.slice(0,6)}`,
                        fecha: new Date().toISOString().split('T')[0],
                        fecha_vencimiento: (formaPago === 'cheque' || formaPago === 'icheque') ? fechaVencimiento : null,
                        estado: 'acreditado',
                        usuario_id: currentUserId
                    }])
                    .select()
                    .single();

                if (pagoErr) throw pagoErr;
                
                appliedPayments.push({ ventaId: venta.id, amount: appliedToThisVenta });
                remainingAmount -= appliedToThisVenta;
            }

            // 2. Handle Surplus (A Cuenta)
            if (remainingAmount > 0) {
                const { error: surplusErr } = await supabase
                    .from('pagos')
                    .insert([{
                        venta_id: null, // Allowable now due to migration
                        cliente_id: cliente.id,
                        monto: remainingAmount,
                        forma_pago: formaPago,
                        referencia: referencia || 'Pago a Cuenta (Excedente FIFO)',
                        fecha: new Date().toISOString().split('T')[0],
                        fecha_vencimiento: (formaPago === 'cheque' || formaPago === 'icheque') ? fechaVencimiento : null,
                        estado: 'acreditado',
                        usuario_id: currentUserId
                    }]);
                if (surplusErr) throw surplusErr;
            }

            // 3. Register ONE entry in Cuenta Corriente for the TOTAL amount
            // This ensures the client's total balance is updated correctly in one go
            // fetch current client balance first
            const { data: latestCliente, error: lErr } = await supabase
                .from('clientes')
                .select('saldo_actual')
                .eq('id', cliente.id)
                .single();
            
            if (lErr) throw lErr;
            const currentSaldo = Number(latestCliente.saldo_actual);

            const { error: ccErr } = await supabase
                .from('cuenta_corriente')
                .insert([{
                    cliente_id: cliente.id,
                    fecha: new Date().toISOString().split('T')[0],
                    tipo: 'pago',
                    concepto: `Cobro General - ${formaPago.toUpperCase()}${referencia ? ` (${referencia})` : ''}`,
                    monto: monto,
                    saldo_acumulado: currentSaldo - monto,
                    usuario_id: currentUserId
                }]);

            if (ccErr) throw ccErr;

            alert(`Cobro de $${monto.toLocaleString()} registrado con éxito.`);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error processing cobro:', err);
            setError(err.message || 'Error al procesar el cobro');
        } finally {
            setLoading(false);
        }
    };

    const deudaTotal = ventasPendientes.reduce((sum, v) => sum + Number(v.saldo_pendiente), 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <span className="material-symbols-outlined font-bold">payments</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Registrar Cobro</h3>
                            <p className="text-xs text-slate-500 font-medium">Cliente: {cliente.razon_social}</p>
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
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deuda Total Pendiente</p>
                            <p className="text-2xl font-black text-rose-600">$ {deudaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ventas con Saldo</p>
                            <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{ventasPendientes.length}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Monto a Cobrar ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={monto}
                                onChange={(e) => setMonto(parseFloat(e.target.value))}
                                className="w-full h-14 px-6 bg-emerald-50/30 dark:bg-emerald-500/5 border-2 border-emerald-100 dark:border-emerald-500/20 rounded-2xl text-2xl font-black text-emerald-600 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all"
                                placeholder="0.00"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Forma de Pago</label>
                                <select
                                    value={formaPago}
                                    onChange={(e) => setFormaPago(e.target.value as any)}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="cheque">Cheque Físico</option>
                                    <option value="icheque">e-Cheque (Digital)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Referencia (Opcional)</label>
                                <input
                                    type="text"
                                    value={referencia}
                                    onChange={(e) => setReferencia(e.target.value)}
                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50"
                                    placeholder="Nro comprobante / Banco..."
                                />
                            </div>
                        </div>

                        {(formaPago === 'cheque' || formaPago === 'icheque') && (
                            <div className="">
                                <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">event_upcoming</span>
                                    Fecha de Vencimiento del Cheque
                                </label>
                                <input
                                    type="date"
                                    value={fechaVencimiento}
                                    onChange={(e) => setFechaVencimiento(e.target.value)}
                                    className="w-full h-12 px-6 bg-rose-50/30 dark:bg-rose-500/5 border-2 border-rose-100 dark:border-rose-500/20 rounded-xl text-lg font-bold text-rose-600 focus:ring-4 focus:ring-rose-500/20 outline-none transition-all"
                                    required
                                />
                                <p className="text-[9px] text-slate-400 mt-1 ml-1 font-medium italic">* Campo obligatorio para cobros con cheque.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                        <div className="flex gap-3">
                            <span className="material-symbols-outlined text-blue-500">info</span>
                            <div className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                                <p className="font-bold uppercase tracking-wider mb-1">Lógica FIFO aplicada:</p>
                                <p>El cobro se aplicará automáticamente a las facturas más antiguas primero. Si sobra dinero, se acreditará como <strong>Saldo a Favor</strong> en la cuenta del cliente.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
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
                            className="flex-[2] h-12 rounded-xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <span>Confirmar Cobro</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CobroModal;
