import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import PagoProveedorModal from '../components/PagoProveedorModal';
import { generateSupplierStatement } from '../utils/pdfGenerator';

interface Proveedor {
    id: string;
    razon_social: string;
    nombre_fantasia: string;
    cuit: string;
    telefono: string;
    email: string;
    direccion: string;
    localidad: string;
    categoria_proveedor: string;
    saldo_actual: number;
    limite_credito: number;
    notas: string;
    contacto_nombre: string;
    contacto_telefono: string;
}

interface Compra {
    id: string;
    nro_comprobante: string;
    fecha: string;
    total: number;
    estado: string;
}

interface MovimientoProveedor {
    id: string;
    fecha: string;
    tipo: 'cargo' | 'pago' | 'nota_credito' | 'nota_debito';
    concepto: string;
    monto: number;
    saldo_acumulado: number;
}

interface TopProductoProveedor {
    producto_nombre: string;
    cantidad_total: number;
    total_compras: number;
}

const ProveedorDetalle: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [proveedor, setProveedor] = useState<Proveedor | null>(null);
    const [compras, setCompras] = useState<Compra[]>([]);
    const [movimientos, setMovimientos] = useState<MovimientoProveedor[]>([]);
    const [topProductos, setTopProductos] = useState<TopProductoProveedor[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Ajuste de Saldo State
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [nuevoSaldoReal, setNuevoSaldoReal] = useState('');
    const [conceptoAjuste, setConceptoAjuste] = useState('Saldo Anterior');
    const [procesandoAjuste, setProcesandoAjuste] = useState(false);
    const [activeTab, setActiveTab] = useState<'movimientos' | 'compras' | 'stats'>('movimientos');

    // Filter State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isFiltering, setIsFiltering] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            // 1. Fetch Supplier Data
            const { data: provData, error: provErr } = await supabase
                .from('proveedores')
                .select('*')
                .eq('id', id)
                .single();
            if (provErr) throw provErr;
            setProveedor(provData);

            // 2. Fetch Purchase History
            const { data: purchasesData } = await supabase
                .from('compras')
                .select('id, nro_comprobante, fecha, total, estado')
                .eq('proveedor_id', id)
                .order('fecha', { ascending: false });
            setCompras(purchasesData || []);

            // 3. Fetch Movements with optional date filtering
            let movsQuery = supabase
                .from('cuenta_corriente_proveedores')
                .select('*')
                .eq('proveedor_id', id);

            if (startDate) movsQuery = movsQuery.gte('fecha', startDate);
            if (endDate) movsQuery = movsQuery.lte('fecha', endDate);

            const { data: movsData } = await movsQuery.order('created_at', { ascending: false });
            setMovimientos(movsData || []);

            // 4. Fetch Stats (Top Products Purchased from this Supplier)
            const { data: statsData } = await supabase
                .from('compra_items')
                .select(`
                    cantidad,
                    subtotal,
                    productos:producto_id (nombre),
                    compras!inner (proveedor_id)
                `)
                .eq('compras.proveedor_id', id);

            if (statsData) {
                const aggregation: Record<string, { q: number; v: number }> = {};
                statsData.forEach((item: any) => {
                    const name = item.productos?.nombre || 'Desconocido';
                    if (!aggregation[name]) aggregation[name] = { q: 0, v: 0 };
                    aggregation[name].q += Number(item.cantidad);
                    aggregation[name].v += Number(item.subtotal);
                });

                const sorted = Object.entries(aggregation)
                    .map(([name, data]) => ({
                        producto_nombre: name,
                        cantidad_total: data.q,
                        total_compras: data.v
                    }))
                    .sort((a, b) => b.cantidad_total - a.cantidad_total)
                    .slice(0, 5);

                setTopProductos(sorted);
            }

        } catch (error) {
            console.error('Error fetching supplier details:', error);
        } finally {
            setLoading(false);
            setIsFiltering(false);
        }
    }, [id, startDate, endDate]);

    const handleAjusteSaldo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proveedor || !id || nuevoSaldoReal === '') return;

        setProcesandoAjuste(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            // UI: Positive = Debt. DB: Negative = Debt.
            // Por lo tanto, invertimos el valor ingresado por el usuario para guardarlo en la DB
            const inputSaldo = Number(nuevoSaldoReal);
            const targetSaldo = -inputSaldo; 
            
            const currentSaldo = Number(proveedor.saldo_actual);
            const delta = targetSaldo - currentSaldo;

            if (delta === 0) {
                setShowAjusteModal(false);
                return;
            }

            // Si el delta es positivo, significa que el saldo de la DB se hace "más positivo" (menos deuda o más crédito) -> PAGO
            // Si el delta es negativo, significa que el saldo de la DB se hace "más negativo" (más deuda) -> CARGO
            const tipo: 'cargo' | 'pago' = delta > 0 ? 'pago' : 'cargo';
            const monto = delta; // El monto lo guardamos con su signo original para que la matemática coincida

            const { error: insertErr } = await supabase
                .from('cuenta_corriente_proveedores')
                .insert([{
                    proveedor_id: id,
                    fecha: new Date().toISOString().split('T')[0],
                    tipo,
                    concepto: conceptoAjuste || 'Ajuste de Saldo',
                    monto,
                    saldo_acumulado: targetSaldo,
                    usuario_id: user?.id
                }]);

            if (insertErr) throw insertErr;

            // Actualizar tabla de proveedores
            const { error: updateErr } = await supabase
                .from('proveedores')
                .update({ saldo_actual: targetSaldo })
                .eq('id', id);

            if (updateErr) throw updateErr;

            setShowAjusteModal(false);
            setNuevoSaldoReal('');
            setConceptoAjuste('Ajuste de Saldo');
            fetchData();
        } catch (error) {
            console.error('Error al ajustar saldo:', error);
            alert('Error al procesar el ajuste de saldo');
        } finally {
            setProcesandoAjuste(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <Layout>
                <div className="flex h-[80vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Cargando perfil...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!proveedor) return <Layout><div className="p-8 text-center text-red-500 font-bold">Proveedor no encontrado</div></Layout>;

    return (
        <Layout>
            <MainHeader title="Ficha de Proveedor">
                <div className="flex items-center gap-4">
                    <Link to="/proveedores" className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-bold">
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        <span>Volver al Listado</span>
                    </Link>
                    <Link
                        to={`/compras/nueva?proveedor_id=${id}`}
                        className="flex items-center justify-center gap-2 rounded-xl h-10 px-4 bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-sm">local_shipping</span>
                        <span>Registrar Compra</span>
                    </Link>
                </div>
            </MainHeader>

            <div className="p-8 max-w-[1600px] mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* Left Side: Profile */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden text-center p-8 transition-all hover:shadow-md">
                            <div className="size-24 bg-primary/10 text-primary rounded-2xl mx-auto flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-5xl">local_shipping</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-1">{proveedor.razon_social}</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary italic mb-2">"{proveedor.nombre_fantasia || 'Sin Fanatsía'}"</p>

                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest border border-primary/10">
                                    {proveedor.categoria_proveedor}
                                </span>
                                {proveedor.cuit && (
                                    <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-tight">
                                        CUIT: {proveedor.cuit}
                                    </span>
                                )}
                            </div>

                            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-zinc-800 text-left space-y-4">
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-primary text-xl">call</span>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Empresa</span>
                                        <span className="text-sm font-bold">{proveedor.telefono || 'N/A'}</span>
                                    </div>
                                </div>
                                {proveedor.contacto_nombre && (
                                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-primary text-xl">person</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Contacto: {proveedor.contacto_nombre}</span>
                                            <span className="text-sm font-bold">{proveedor.contacto_telefono || 'N/A'}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-primary text-xl">mail</span>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Email</span>
                                        <span className="text-sm font-bold truncate">{proveedor.email || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                                    <div className="text-sm font-bold">
                                        <p>{proveedor.direccion || 'N/A'}</p>
                                        <p className="text-[10px] uppercase font-black text-slate-400 mt-1 tracking-widest">{proveedor.localidad || 'Mendoza'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Balance Card */}
                        {/* En la DB: Negativo es Deuda. En la UI: Positivo es Deuda */}
                        <div className={`rounded-3xl p-6 text-white shadow-lg transition-all ${-proveedor.saldo_actual > 0 ? 'bg-gradient-to-br from-red-600 to-red-800 shadow-red-500/20' : 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/20'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80">Saldo en Cuenta Cte</h3>
                                <button 
                                    onClick={() => {
                                        setNuevoSaldoReal((-proveedor.saldo_actual).toString());
                                        setShowAjusteModal(true);
                                    }}
                                    className="p-1 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                                    title="Ajustar Saldo"
                                >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                            </div>
                            <div className="text-3xl font-black mb-2">$ {Math.abs(proveedor.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            <div className={`text-[10px] font-bold uppercase tracking-widest ${-proveedor.saldo_actual > 0 ? 'text-red-100' : 'text-emerald-100'}`}>
                                {-proveedor.saldo_actual > 0 ? 'Deuda a pagar' : 'A favor (Crédito)'}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Notas Especiales</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">{proveedor.notas || 'No hay notas adicionales para este proveedor.'}</p>
                        </div>
                    </div>

                    {/* Right Side: Content */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Tabs Container */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                            {/* Filter Bar */}
                            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/30 dark:bg-zinc-800/20">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-400 text-sm">calendar_month</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar por Período</span>
                                    </div>
                                    {isFiltering && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
                                            <div className="size-2 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                            <span className="text-[9px] font-black uppercase tracking-tighter text-primary animate-pulse">Actualizando datos...</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Inicio</label>
                                        <input 
                                            type="date" 
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase">Fin</label>
                                        <input 
                                            type="date" 
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                    {(startDate || endDate) && (
                                        <button 
                                            onClick={() => { setStartDate(''); setEndDate(''); }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                            title="Limpiar filtros"
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Tabs Switcher */}
                            <div className="flex border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/10">
                                <button
                                    onClick={() => setActiveTab('movimientos')}
                                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'movimientos' ? 'border-primary text-primary bg-white dark:bg-zinc-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Cuenta Corriente
                                </button>
                                <button
                                    onClick={() => setActiveTab('compras')}
                                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'compras' ? 'border-primary text-primary bg-white dark:bg-zinc-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Historial de Compras
                                </button>
                                <button
                                    onClick={() => setActiveTab('stats')}
                                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'stats' ? 'border-primary text-primary bg-white dark:bg-zinc-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Estadísticas de Compras
                                </button>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto">
                                {activeTab === 'movimientos' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                                            {(() => {
                                                const totalPagado = movimientos.reduce((acc, m) => acc + (['pago', 'nota_credito'].includes(m.tipo) ? Math.abs(m.monto) : 0), 0);
                                                const totalCompras = movimientos.reduce((acc, m) => acc + (['cargo', 'nota_debito'].includes(m.tipo) ? Math.abs(m.monto) : 0), 0);
                                                const balance = totalCompras - totalPagado; // Positivo = Deuda
                                                return (
                                                    <>
                                                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Total Pagado (Debe)</p>
                                                            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                                                                $ {totalPagado.toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">Total Compras (Haber)</p>
                                                            <p className="text-xl font-black text-rose-700 dark:text-rose-400">
                                                                $ {totalCompras.toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Balance de Período</p>
                                                            <p className={`text-xl font-black ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                {balance < 0 ? '-' : ''}$ {Math.abs(balance).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Movimientos de Cuenta</h4>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => generateSupplierStatement(proveedor!, movimientos, startDate, endDate)}
                                                    className="h-8 px-3 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-primary/20 hover:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">download</span>
                                                    Exportar PDF
                                                </button>
                                                <button 
                                                    onClick={() => setShowAjusteModal(true)}
                                                    className="h-8 px-3 bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-primary text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                                                >
                                                    Ajustar Saldo
                                                </button>
                                                <button 
                                                    onClick={() => setShowPagoModal(true)}
                                                    className="h-8 px-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-emerald-600/20 hover:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">payments</span>
                                                    Registrar Pago
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-zinc-800">
                                                        <th className="py-3">Fecha</th>
                                                        <th className="py-3">Concepto</th>
                                                        <th className="py-3">Tipo</th>
                                                        <th className="py-3 text-right">Debe</th>
                                                        <th className="py-3 text-right">Haber</th>
                                                        <th className="py-3 text-right">Saldo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                                                    {movimientos.map(m => {
                                                        const isHaber = ['cargo', 'nota_debito'].includes(m.tipo);
                                                        const isDebe = ['pago', 'nota_credito'].includes(m.tipo);
                                                        const saldoInvertido = -m.saldo_acumulado; // Para la UI, invertimos para que Deuda sea positivo
                                                        
                                                        return (
                                                            <tr key={m.id} className="text-sm group hover:bg-slate-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                                                                <td className="py-3 text-slate-500">{format(parseISO(m.fecha), 'dd/MM/yyyy')}</td>
                                                                <td className="py-3 font-bold text-slate-700 dark:text-zinc-200">{m.concepto}</td>
                                                                <td className="py-3 capitalize">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isDebe ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                        {m.tipo.replace('_', ' ')}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 text-right font-black text-emerald-600">
                                                                    {isDebe ? `$ ${Math.abs(m.monto).toLocaleString()}` : '-'}
                                                                </td>
                                                                <td className="py-3 text-right font-black text-slate-900 dark:text-white">
                                                                    {isHaber ? `$ ${Math.abs(m.monto).toLocaleString()}` : '-'}
                                                                </td>
                                                                <td className={`py-3 text-right font-black ${saldoInvertido > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                    {saldoInvertido < 0 ? '- ' : ''}$ {Math.abs(saldoInvertido).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {movimientos.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="py-12 text-center text-slate-400 font-bold italic">No hay movimientos registrados</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'compras' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {compras.map(c => (
                                            <div key={c.id} className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/20 group hover:border-primary/50 transition-all">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                         <p className="text-[10px] font-black text-slate-400 uppercase">{format(parseISO(c.fecha), 'dd/MM/yyyy')}</p>
                                                        <h5 className="font-black text-slate-900 dark:text-white">Comp. #{c.nro_comprobante || 'S/N'}</h5>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${c.estado === 'recibida' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                                        {c.estado}
                                                    </span>
                                                </div>
                                                <div className="mt-4 flex justify-between items-center">
                                                    <p className="text-lg font-black text-primary">$ {Number(c.total).toLocaleString()}</p>
                                                    <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                                                        <span className="material-symbols-outlined">receipt_long</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {compras.length === 0 && (
                                            <div className="col-span-2 py-12 text-center text-slate-400 font-bold italic">No se registran facturas recibidas</div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'stats' && (
                                    <div className="space-y-8">
                                        <div className="bg-slate-50 dark:bg-zinc-800/30 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Productos más Comprados</h4>
                                            <div className="space-y-6">
                                                {topProductos.map((p, idx) => (
                                                    <div key={idx} className="space-y-2">
                                                        <div className="flex justify-between items-end">
                                                            <div className="flex items-center gap-3">
                                                                <span className="size-6 rounded-lg bg-primary text-white text-[10px] font-black flex items-center justify-center">{idx + 1}</span>
                                                                <span className="text-sm font-black">{p.producto_nombre}</span>
                                                            </div>
                                                            <span className="text-[10px] font-black opacity-60">{p.cantidad_total} Unidades</span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary"
                                                                style={{ width: `${(p.cantidad_total / (topProductos[0]?.cantidad_total || 1)) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                        <p className="text-right text-[10px] font-bold text-primary">$ {p.total_compras.toLocaleString()}</p>
                                                    </div>
                                                ))}
                                                {topProductos.length === 0 && (
                                                    <p className="text-center text-slate-400 italic">Datos insuficientes para generar estadísticas</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ajuste de Saldo Modal */}
            {showAjusteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/10">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Ajustar Saldo</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Corrección manual de cuenta</p>
                            </div>
                            <button 
                                onClick={() => setShowAjusteModal(false)}
                                className="size-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleAjusteSaldo} className="p-6 space-y-6">
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Actual en Sistema</span>
                                    <span className={`text-xs font-black ${-proveedor.saldo_actual > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        $ {(-proveedor.saldo_actual).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nuevo Saldo Real</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input 
                                            autoFocus
                                            type="number"
                                            step="0.01"
                                            value={nuevoSaldoReal}
                                            onChange={(e) => setNuevoSaldoReal(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-lg font-black outline-none focus:border-primary transition-all"
                                            required
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold italic ml-1">
                                        * Ingresa el monto final de DEUDA con el proveedor (usa "-" si es saldo a tu favor).
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Concepto del Ajuste</label>
                                    <input 
                                        type="text"
                                        value={conceptoAjuste}
                                        onChange={(e) => setConceptoAjuste(e.target.value)}
                                        placeholder="Ej: Saldo Anterior, Corrección, etc."
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-bold outline-none focus:border-primary transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAjusteModal(false)}
                                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={procesandoAjuste || nuevoSaldoReal === ''}
                                    className="flex-[2] py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2"
                                >
                                    {procesandoAjuste ? (
                                        <>
                                            <div className="size-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            <span>Procesando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-base">check_circle</span>
                                            <span>Confirmar Ajuste</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Pago a Proveedor Modal */}
            <PagoProveedorModal 
                isOpen={showPagoModal}
                onClose={() => setShowPagoModal(false)}
                onSuccess={fetchData}
                proveedor={proveedor}
            />
        </Layout>
    );
};

export default ProveedorDetalle;
