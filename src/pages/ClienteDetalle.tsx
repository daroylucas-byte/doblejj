import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import { generateClientStatement, generateSaleTicket } from '../utils/pdfGenerator';

interface Cliente {
    id: string;
    razon_social: string;
    nombre_fantasia: string;
    cuit: string;
    dni: string;
    tipo: string;
    telefono: string;
    email: string;
    direccion: string;
    localidad: string;
    saldo_actual: number;
    limite_credito: number;
    notas: string;
}

interface Venta {
    id: string;
    numero: string;
    fecha: string;
    total: number;
    estado: string;
}

interface Movimiento {
    id: string;
    fecha: string;
    tipo: 'cargo' | 'pago' | 'nota_credito' | 'nota_debito';
    concepto: string;
    monto: number;
    saldo_acumulado: number;
}

interface TopProducto {
    producto_nombre: string;
    cantidad_total: number;
    total_ventas: number;
}

const ClienteDetalle: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [topProductos, setTopProductos] = useState<TopProducto[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [activeTab, setActiveTab] = useState<'movimientos' | 'compras' | 'stats'>('movimientos');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Ajuste de Saldo States
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [nuevoSaldoReal, setNuevoSaldoReal] = useState<string>('');
    const [conceptoAjuste, setConceptoAjuste] = useState('Saldo Anterior');
    const [procesandoAjuste, setProcesandoAjuste] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) return;
        
        // Only show global spinner if it's the initial load
        if (!cliente) {
            setLoading(true);
        } else {
            setIsFiltering(true);
        }

        try {
            // 1. Fetch Cliente Data (Historical indicator, not affected by date filter)
            const { data: clienteData, error: clienteErr } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', id)
                .single();
            if (clienteErr) throw clienteErr;
            setCliente(clienteData);

            // 2. Fetch Purchase History (Filtered)
            let ventasQuery = supabase
                .from('ventas')
                .select('id, numero, fecha, total, estado')
                .eq('cliente_id', id);

            if (startDate) ventasQuery = ventasQuery.gte('fecha', startDate);
            if (endDate) ventasQuery = ventasQuery.lte('fecha', endDate);

            const { data: ventasData } = await ventasQuery.order('fecha', { ascending: false });
            setVentas(ventasData || []);

            // 3. Fetch Current Account Movements (Filtered)
            let movsQuery = supabase
                .from('cuenta_corriente')
                .select('id, fecha, tipo, concepto, monto, saldo_acumulado')
                .eq('cliente_id', id);

            if (startDate) movsQuery = movsQuery.gte('fecha', startDate);
            if (endDate) movsQuery = movsQuery.lte('fecha', endDate);

            const { data: movsData } = await movsQuery.order('created_at', { ascending: false });
            setMovimientos(movsData || []);

            // 4. Fetch Stats (Top Products) - Filtered by date
            let statsQuery = supabase
                .from('venta_items')
                .select(`
                    cantidad,
                    subtotal,
                    productos:producto_id (nombre),
                    ventas!inner (cliente_id, fecha)
                `)
                .eq('ventas.cliente_id', id);

            if (startDate) statsQuery = statsQuery.gte('ventas.fecha', startDate);
            if (endDate) statsQuery = statsQuery.lte('ventas.fecha', endDate);

            const { data: statsData } = await statsQuery;

            if (statsData) {
                const aggregation: Record<string, { q: number; v: number }> = {};
                statsData.forEach((item: any) => {
                    const name = item.productos?.nombre || 'Producto Desconocido';
                    if (!aggregation[name]) aggregation[name] = { q: 0, v: 0 };
                    aggregation[name].q += Number(item.cantidad);
                    aggregation[name].v += Number(item.subtotal);
                });

                const sorted = Object.entries(aggregation)
                    .map(([name, data]) => ({
                        producto_nombre: name,
                        cantidad_total: data.q,
                        total_ventas: data.v
                    }))
                    .sort((a, b) => b.cantidad_total - a.cantidad_total)
                    .slice(0, 5);

                setTopProductos(sorted);
            }

        } catch (error) {
            console.error('Error fetching client details:', error);
        } finally {
            setLoading(false);
            setIsFiltering(false);
        }
    }, [id, startDate, endDate]);

    const handleAjusteSaldo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cliente || !id || nuevoSaldoReal === '') return;

        setProcesandoAjuste(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const targetSaldo = Number(nuevoSaldoReal);
            const currentSaldo = Number(cliente.saldo_actual);
            const delta = targetSaldo - currentSaldo;

            if (delta === 0) {
                setShowAjusteModal(false);
                return;
            }

            // --- LÓGICA DE SIGNOS ---
            // targetSaldo > currentSaldo significa que la DEUDA subió -> Cargo/Debe
            // targetSaldo < currentSaldo significa que la DEUDA bajó -> Pago/Haber
            const tipo: 'cargo' | 'pago' = delta > 0 ? 'cargo' : 'pago';
            const monto = Math.abs(delta);

            // 1. Insertar el movimiento en cuenta corriente
            const { error: insertErr } = await supabase
                .from('cuenta_corriente')
                .insert([{
                    cliente_id: id,
                    fecha: new Date().toISOString().split('T')[0],
                    tipo,
                    concepto: conceptoAjuste || 'Saldo Anterior',
                    monto,
                    saldo_acumulado: targetSaldo,
                    usuario_id: user?.id
                }]);

            if (insertErr) throw insertErr;

            // El resto de la lógica (conciliación de facturas) ahora se maneja 
            // automáticamente vía Trigger en la base de datos.
            
            setShowAjusteModal(false);
            setNuevoSaldoReal('');
            setConceptoAjuste('Saldo Anterior');
            fetchData();
        } catch (error) {
            console.error('Error al ajustar saldo:', error);
            alert('Error al procesar el ajuste de saldo');
        } finally {
            setProcesandoAjuste(false);
        }
    };

    const handleGenerateTicket = async (venta: Venta) => {
        try {
            // Fetch items for this sale
            const { data: items, error } = await supabase
                .from('venta_items')
                .select(`
                    id,
                    cantidad,
                    precio_unitario,
                    subtotal,
                    productos (nombre, codigo)
                `)
                .eq('venta_id', venta.id);

            if (error) throw error;

            // Prepare the venta object for the generator
            const ventaFull = {
                ...venta,
                clientes: cliente!
            };

            const itemsFormatted = items?.map((item: any) => ({
                ...item,
                productos: Array.isArray(item.productos) ? item.productos[0] : item.productos
            }));

            generateSaleTicket(ventaFull, (itemsFormatted as any) || []);
        } catch (error) {
            console.error('Error generating ticket:', error);
            alert('Error al generar el ticket');
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
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando perfil de cliente...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!cliente) return <Layout><div>Error: Cliente no encontrado</div></Layout>;

    return (
        <Layout>
            <MainHeader title="Ficha de Cliente">
                <Link to="/clientes" className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-sm font-bold">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    <span>Volver al Listado</span>
                </Link>
            </MainHeader>

            <div className="p-8 max-w-[1600px] mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* Left Panel: Profile & Details */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden text-center p-8 transition-all hover:shadow-md">
                            <div className="size-24 bg-primary/10 text-primary rounded-2xl mx-auto flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-5xl">person</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{cliente.razon_social}</h2>
                            {cliente.nombre_fantasia && (
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 italic">"{cliente.nombre_fantasia}"</p>
                            )}

                            <div className="mt-6 flex flex-wrap justify-center gap-2">
                                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                                    {cliente.tipo}
                                </span>
                                {cliente.cuit && (
                                    <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded-full text-[10px] font-mono">
                                        CUIT: {cliente.cuit}
                                    </span>
                                )}
                            </div>

                            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-zinc-800 text-left space-y-4">
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-primary text-xl">call</span>
                                    <span className="text-sm font-medium">{cliente.telefono || 'Sin teléfono'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-primary text-xl">mail</span>
                                    <span className="text-sm font-medium truncate">{cliente.email || 'Sin email'}</span>
                                </div>
                                <div className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                                    <div className="text-sm font-medium">
                                        <p>{cliente.direccion || 'Sin dirección'}</p>
                                        <p className="text-[10px] uppercase font-bold text-slate-400">{cliente.localidad}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Limit Card */}
                        <div className="bg-gradient-to-br from-primary to-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-primary/20">
                            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-4">Límite de Crédito</h3>
                            <div className="flex items-end justify-between">
                                <span className="text-3xl font-black">$ {cliente.limite_credito.toLocaleString()}</span>
                                <span className="material-symbols-outlined text-4xl opacity-40">credit_card</span>
                            </div>
                            <div className="mt-4 w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white transition-all duration-1000"
                                    style={{ width: `${Math.min(100, (Math.max(0, cliente.saldo_actual) / cliente.limite_credito) * 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] mt-2 font-bold opacity-70">Uso de línea de crédito</p>
                        </div>
                    </div>

                    {/* Right Panel: Tabs and Content */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* Indicators Top Bar */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Actual</p>
                                    <button 
                                        onClick={() => {
                                            setNuevoSaldoReal(cliente.saldo_actual.toString());
                                            setShowAjusteModal(true);
                                        }}
                                        className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
                                        title="Ajustar Saldo Manualmente"
                                    >
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                </div>
                                <p className={`text-2xl font-black ${cliente.saldo_actual > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    $ {Math.abs(cliente.saldo_actual).toLocaleString()}
                                </p>
                                <span className="text-[10px] font-bold text-slate-400">{cliente.saldo_actual > 0 ? 'Adeuda' : 'A favor'}</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventas Realizadas</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{ventas.length}</p>
                                <span className="text-[10px] font-bold text-slate-400">Desde que inició</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Total Comprado</p>
                                <p className="text-2xl font-black text-primary">
                                    $ {ventas.reduce((acc, v) => acc + Number(v.total), 0).toLocaleString()}
                                </p>
                                <span className="text-[10px] font-bold text-slate-400">Todo el historial</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ultima Actividad</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white mt-1">
                                    {ventas[0] ? format(parseISO(ventas[0].fecha), 'dd/MM/yyyy') : 'Sin actividad'}
                                </p>
                                <span className="text-[10px] font-bold text-slate-400">Fecha de última factura</span>
                            </div>
                        </div>

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
                                    Estadísticas de Productos
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 p-6 overflow-y-auto">

                                {activeTab === 'movimientos' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Movimientos Recientes</h4>
                                            <button 
                                                onClick={() => generateClientStatement(cliente, movimientos, startDate, endDate)}
                                                className="h-8 px-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-primary/20 hover:scale-95 transition-all"
                                            >
                                                Exportar PDF
                                            </button>
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
                                                        const isDebe = m.tipo === 'cargo' || m.tipo === 'nota_debito';
                                                        const isHaber = m.tipo === 'pago' || m.tipo === 'nota_credito';
                                                        
                                                        return (
                                                            <tr key={m.id} className="text-sm group hover:bg-slate-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                                                                <td className="py-3 text-slate-500">{format(parseISO(m.fecha), 'dd/MM/yyyy')}</td>
                                                                <td className="py-3 font-bold text-slate-700 dark:text-zinc-200">{m.concepto}</td>
                                                                <td className="py-3 capitalize">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isHaber ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                        {m.tipo.replace('_', ' ')}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 text-right font-black text-slate-900 dark:text-white">
                                                                    {isDebe ? `$ ${m.monto.toLocaleString()}` : '-'}
                                                                </td>
                                                                <td className="py-3 text-right font-black text-green-600">
                                                                    {isHaber ? `$ ${m.monto.toLocaleString()}` : '-'}
                                                                </td>
                                                                <td className={`py-3 text-right font-black ${m.saldo_acumulado > 0 ? 'text-red-500' : 'text-primary'}`}>
                                                                    $ {Math.abs(m.saldo_acumulado).toLocaleString()}
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
                                        {ventas.map(v => (
                                            <div key={v.id} className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/20 group hover:border-primary/50 transition-all">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase">{format(parseISO(v.fecha), 'dd/MM/yyyy')}</p>
                                                        <h5 className="font-black text-slate-900 dark:text-white">Factura #{v.numero || 'S/N'}</h5>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${v.estado === 'entregada' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                                        {v.estado}
                                                    </span>
                                                </div>
                                                <div className="mt-4 flex justify-between items-center">
                                                    <p className="text-lg font-black text-primary">$ {Number(v.total).toLocaleString()}</p>
                                                    <button 
                                                        onClick={() => handleGenerateTicket(v)}
                                                        className="p-2 text-slate-400 hover:text-primary transition-colors"
                                                        title="Generar Ticket"
                                                    >
                                                        <span className="material-symbols-outlined">receipt_long</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {ventas.length === 0 && (
                                            <div className="col-span-2 py-12 text-center text-slate-400 font-bold italic">No se registran facturas emitidas</div>
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
                                                                style={{ width: `${(p.cantidad_total / topProductos[0].cantidad_total) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                        <p className="text-right text-[10px] font-bold text-primary">$ {p.total_ventas.toLocaleString()}</p>
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

                        {/* Notes Section */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Notas Especiales</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{cliente.notas || 'No hay notas adicionales para este cliente.'}</p>
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
                                    <span className={`text-xs font-black ${cliente.saldo_actual > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        $ {cliente.saldo_actual.toLocaleString()}
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
                                        * Ingresa el monto que el cliente debe (Positivo = Deuda, Negativo = A favor).
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
        </Layout>
    );
};

export default ClienteDetalle;
