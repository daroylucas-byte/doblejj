import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';
import { 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    format, 
    parseISO, 
    startOfMonth
} from 'date-fns';
import { es } from 'date-fns/locale';

// Helper to format currency
const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
};

interface VentaReciente {
    id: string;
    numero: string;
    fecha: string;
    total: number;
    estado: string;
    cliente: { razon_social: string; cuit: string };
    vendedor: { nombre: string; apellido: string };
}

interface AlertaStock {
    id: string;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
}

interface ChartData {
    dayName: string;
    ventas: number;
    compras: number;
    gastos: number;
}

interface TopProducto {
    id: string;
    nombre: string;
    cantidad: number;
    categoria: string;
    unidad_medida: string;
}

const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);

    // Filters state
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // KPIs state
    const [ventasDelDia, setVentasDelDia] = useState(0);
    const [cobrosPendientes, setCobrosPendientes] = useState(0);
    const [clientesConSaldo, setClientesConSaldo] = useState(0);
    const [stockBajoMinimo, setStockBajoMinimo] = useState(0);

    // Period Totals state
    const [ventasPeriodo, setVentasPeriodo] = useState(0);
    const [gastosPeriodo, setGastosPeriodo] = useState(0);
    const [comprasPeriodo, setComprasPeriodo] = useState(0);

    // Weekly Chart state 
    const [weeklyData, setWeeklyData] = useState<ChartData[]>([]);
    const [maxChartValue, setMaxChartValue] = useState(100);

    // Lists state
    const [ventasRecientes, setVentasRecientes] = useState<VentaReciente[]>([]);
    const [alertasStock, setAlertasStock] = useState<AlertaStock[]>([]);
    const [topProductos, setTopProductos] = useState<TopProducto[]>([]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            
            // Current Week calculation for the bar chart
            const now = new Date();
            const weekStart = startOfWeek(now, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

            // 1. Snapshot Metrics (Global/Static)
            const [resHoy, resClientes, resProductos] = await Promise.all([
                supabase.from('ventas').select('total').eq('fecha', todayStr).in('estado', ['confirmada', 'entregada', 'preparando', 'lista', 'en distribucion']),
                supabase.from('clientes').select('saldo_actual').gt('saldo_actual', 0),
                supabase.from('productos').select('id, nombre, stock_actual, stock_minimo')
            ]);

            if (resHoy.data) setVentasDelDia(resHoy.data.reduce((a, b) => a + Number(b.total), 0));
            if (resClientes.data) {
                setClientesConSaldo(resClientes.data.length);
                setCobrosPendientes(resClientes.data.reduce((a, b) => a + Number(b.saldo_actual), 0));
            }
            if (resProductos.data) {
                const lowStock = resProductos.data.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo));
                setStockBajoMinimo(lowStock.length);
                setAlertasStock(lowStock.slice(0, 10));
            }

            // 2. Period Performance (Filtered by Date Range)
            const [resVPeriodo, resGPeriodo, resCPeriodo] = await Promise.all([
                supabase.from('ventas').select('total').gte('fecha', startDate).lte('fecha', endDate).in('estado', ['confirmada', 'entregada', 'preparando', 'lista', 'en distribucion']),
                supabase.from('gastos').select('monto').gte('fecha', startDate).lte('fecha', endDate),
                supabase.from('compras').select('total').gte('fecha', startDate).lte('fecha', endDate).in('estado', ['confirmada', 'recibida'])
            ]);

            setVentasPeriodo(resVPeriodo.data?.reduce((a, b) => a + Number(b.total), 0) || 0);
            setGastosPeriodo(resGPeriodo.data?.reduce((a, b) => a + Number(b.monto), 0) || 0);
            setComprasPeriodo(resCPeriodo.data?.reduce((a, b) => a + Number(b.total), 0) || 0);

            // 3. Weekly Stats
            const [resVWeekly, resCWeekly, resGWeekly] = await Promise.all([
                supabase.from('ventas').select('fecha, created_at, total').gte('fecha', format(weekStart, 'yyyy-MM-dd')).lte('fecha', format(weekEnd, 'yyyy-MM-dd')).in('estado', ['confirmada', 'entregada', 'preparando', 'lista', 'en distribucion']),
                supabase.from('compras').select('fecha, created_at, total').gte('fecha', format(weekStart, 'yyyy-MM-dd')).lte('fecha', format(weekEnd, 'yyyy-MM-dd')).in('estado', ['confirmada', 'recibida']),
                supabase.from('gastos').select('fecha, created_at, monto').gte('fecha', format(weekStart, 'yyyy-MM-dd')).lte('fecha', format(weekEnd, 'yyyy-MM-dd'))
            ]);

            const daysInterval = eachDayOfInterval({ start: weekStart, end: weekEnd });
            let maxValue = 1000;

            const formattedWeekly = daysInterval.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const dv = (resVWeekly.data || []).filter(v => (v.fecha === dayStr)).reduce((a, b) => a + Number(b.total), 0);
                const dc = (resCWeekly.data || []).filter(c => (c.fecha === dayStr)).reduce((a, b) => a + Number(b.total), 0);
                const dg = (resGWeekly.data || []).filter(g => (g.fecha === dayStr)).reduce((a, b) => a + Number(b.monto), 0);
                
                const localMax = Math.max(dv, dc, dg);
                if (localMax > maxValue) maxValue = localMax;

                return {
                    dayName: format(day, 'EEE', { locale: es }),
                    ventas: dv,
                    compras: dc,
                    gastos: dg
                };
            });
            setWeeklyData(formattedWeekly);
            setMaxChartValue(maxValue * 1.1);

            // 4. Top Sold Items 
            const { data: itemsv } = await supabase
                .from('venta_items')
                .select(`
                    cantidad, producto_id, 
                    productos(
                        nombre, 
                        unidad_medida,
                        categorias(nombre)
                    ),
                    ventas!inner(fecha, estado)
                `)
                .gte('ventas.fecha', startDate)
                .lte('ventas.fecha', endDate)
                .in('ventas.estado', ['confirmada', 'entregada', 'preparando', 'lista', 'en distribucion'])
                .limit(2000);

            if (itemsv) {
                const agg: Record<string, TopProducto> = {};
                itemsv.forEach((item: any) => {
                    const pid = item.producto_id;
                    if (!item.productos) return;
                    if (!agg[pid]) agg[pid] = { 
                        id: pid, 
                        nombre: item.productos.nombre, 
                        cantidad: 0,
                        categoria: item.productos.categorias?.nombre || 'Sin Categoría',
                        unidad_medida: item.productos.unidad_medida || 'uds'
                    };
                    agg[pid].cantidad += Number(item.cantidad);
                });
                const sorted = Object.values(agg).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
                setTopProductos(sorted);
            }

            // 5. Recent Sales 
            const { data: recientes } = await supabase
                .from('ventas')
                .select(`
                    id, numero, fecha, total, estado,
                    cliente:cliente_id (razon_social, cuit),
                    vendedor:vendedor_id (nombre, apellido)
                `)
                .gte('fecha', startDate)
                .lte('fecha', endDate)
                .order('created_at', { ascending: false })
                .limit(5);

            if (recientes) setVentasRecientes(recientes as any[]);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [startDate, endDate]);

    const getStatusColor = (estado: string) => {
        switch (estado) {
            case 'presupuesto': return 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400';
            case 'confirmada': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'preparando': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'lista': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'entregada': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'cancelada': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    return (
        <Layout>
            <MainHeader title="Dashboard General">
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-r border-slate-100 dark:border-zinc-800">
                        <span className="material-symbols-outlined text-slate-400 text-sm">calendar_month</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none p-0 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400 focus:ring-0 cursor-pointer"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5">
                        <input 
                            type="date" 
                            className="bg-transparent border-none p-0 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400 focus:ring-0 cursor-pointer"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        <button 
                            onClick={fetchDashboardData}
                            className="size-6 flex items-center justify-center bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                        >
                            <span className="material-symbols-outlined text-sm">refresh</span>
                        </button>
                    </div>
                </div>
            </MainHeader>

            {loading ? (
                <div className="p-8 flex-1 flex flex-col items-center justify-center">
                    <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Cargando métricas...</p>
                </div>
            ) : (
                <div className="p-8 space-y-8 flex-1">
                    {/* Primary Summary Card */}
                    <div className="bg-gradient-to-br from-primary to-primary-dark p-1 rounded-3xl shadow-2xl shadow-primary/20">
                        <div className="bg-white dark:bg-zinc-950 p-8 rounded-[22px] flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Resumen del Período</p>
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
                                    {format(parseISO(startDate), 'dd MMM', { locale: es })} - {format(parseISO(endDate), 'dd MMM', { locale: es })}
                                </h2>
                            </div>
                            
                            <div className="flex flex-wrap justify-center md:justify-end gap-12 w-full md:w-auto">
                                <div className="text-center md:text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Ventas</p>
                                    <p className="text-2xl font-black text-emerald-500">{formatCurrency(ventasPeriodo)}</p>
                                </div>
                                <div className="text-center md:text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Compras</p>
                                    <p className="text-2xl font-black text-slate-400">{formatCurrency(comprasPeriodo)}</p>
                                </div>
                                <div className="text-center md:text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Gastos</p>
                                    <p className="text-2xl font-black text-rose-500">{formatCurrency(gastosPeriodo)}</p>
                                </div>
                                <div className="h-12 w-px bg-slate-100 dark:bg-zinc-800 hidden lg:block"></div>
                                <div className="text-center md:text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Margen Bruto</p>
                                    <p className="text-3xl font-black text-primary">{formatCurrency(ventasPeriodo - gastosPeriodo - comprasPeriodo)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KPI Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                                    <span className="material-symbols-outlined">trending_up</span>
                                </div>
                                <span className="text-xs font-bold text-green-600">Hoy</span>
                            </div>
                            <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Ventas del día</p>
                            <h3 className="text-2xl font-bold mt-1 uppercase tracking-tighter">{formatCurrency(ventasDelDia)}</h3>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                                    <span className="material-symbols-outlined">pending_actions</span>
                                </div>
                            </div>
                            <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Cobros Pendientes</p>
                            <h3 className="text-2xl font-bold mt-1 text-amber-600 uppercase tracking-tighter">{formatCurrency(cobrosPendientes)}</h3>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg">
                                    <span className="material-symbols-outlined">priority_high</span>
                                </div>
                                {stockBajoMinimo > 0 && (
                                    <span className="px-2 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] rounded-full font-bold uppercase tracking-wider">Crítico</span>
                                )}
                            </div>
                            <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Stock Bajo Mínimo</p>
                            <h3 className="text-2xl font-bold mt-1 uppercase tracking-tighter">{stockBajoMinimo} <span className="text-xs text-slate-400 font-medium">Productos</span></h3>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-transform hover:scale-[1.02]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <span className="material-symbols-outlined">account_balance</span>
                                </div>
                            </div>
                            <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Clientes con Saldo</p>
                            <h3 className="text-2xl font-bold mt-1 uppercase tracking-tighter">{clientesConSaldo} <span className="text-xs text-slate-400 font-medium">Cuentas</span></h3>
                        </div>
                    </div>

                    {/* Weekly Performance Multi-Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="font-bold text-lg italic uppercase tracking-widest text-primary">Rendimiento Semanal Actual</h3>
                                    <p className="text-xs text-slate-500 font-medium">Ventas vs Compras vs Gastos (Lu-Dom)</p>
                                </div>
                                <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                                    <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-primary"></div> Ventas</div>
                                    <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-slate-300 dark:bg-zinc-700"></div> Compras</div>
                                    <div className="flex items-center gap-1.5"><div className="size-2 rounded-full border-2 border-primary"></div> Gastos</div>
                                </div>
                            </div>
                            
                            <div className="h-64 flex items-end justify-between gap-4 py-2 border-b border-slate-100 dark:border-zinc-800 relative">
                                <div className="absolute top-0 left-0 w-full h-px bg-slate-100 dark:bg-zinc-800"></div>
                                <div className="absolute top-1/2 left-0 w-full h-px bg-slate-50 dark:bg-zinc-800/50"></div>

                                {weeklyData.map((day, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                        <div className="flex items-end gap-1 w-full h-full pb-1">
                                            <div 
                                                className="flex-1 bg-primary rounded-t-sm transition-all duration-500 hover:brightness-110" 
                                                style={{ height: `${(day.ventas / maxChartValue) * 100}%` }}
                                            ></div>
                                            <div 
                                                className="flex-1 bg-slate-300 dark:bg-zinc-700 rounded-t-sm transition-all duration-500" 
                                                style={{ height: `${(day.compras / maxChartValue) * 100}%` }}
                                            ></div>
                                            <div 
                                                className="flex-1 border-x-2 border-t-2 border-primary/40 rounded-t-sm transition-all duration-500" 
                                                style={{ height: `${(day.gastos / maxChartValue) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-400 mt-2">{day.dayName}</span>
                                        
                                        <div className="absolute bottom-full mb-2 bg-zinc-900 text-white p-2 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap shadow-xl">
                                            <p className="font-black border-b border-zinc-700 mb-1 pb-1">{day.dayName.toUpperCase()}</p>
                                            <p className="flex justify-between gap-4">Ventas: <span className="font-bold text-primary">{formatCurrency(day.ventas)}</span></p>
                                            <p className="flex justify-between gap-4">Compras: <span className="font-bold">{formatCurrency(day.compras)}</span></p>
                                            <p className="flex justify-between gap-4">Gastos: <span className="font-bold">{formatCurrency(day.gastos)}</span></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col">
                            <h3 className="font-bold text-lg mb-6 italic uppercase tracking-widest text-primary text-center">Más Vendidos del Período</h3>
                            <div className="space-y-4 flex-1">
                                {topProductos.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-4 text-center">Sin datos de ventas en este rango.</p>
                                ) : (
                                    topProductos.map((p, i) => (
                                        <div key={i} className="group cursor-default">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{p.categoria}</span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate pr-2">{p.nombre}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-black text-primary block leading-none">
                                                        {Number.isInteger(p.cantidad) ? p.cantidad : p.cantidad.toFixed(3)}
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase text-slate-400">{p.unidad_medida}</span>
                                                </div>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary rounded-full transition-all duration-1000 origin-left"
                                                    style={{ width: `${(p.cantidad / (topProductos[0]?.cantidad || 1)) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <Link to="/productos" className="mt-6 w-full py-2.5 border-2 border-primary/10 text-primary rounded-lg text-xs font-black uppercase tracking-widest text-center hover:bg-primary hover:text-white transition-all">
                                Ver Catálogo Completo
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Low Stock Alerts */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-lg italic uppercase tracking-widest text-primary">Reponer Stock</h3>
                                <Link className="text-xs text-primary font-bold hover:underline" to="/productos">Ver Todo</Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {alertasStock.length === 0 ? (
                                    <p className="text-sm text-slate-500 py-4 col-span-2">No hay alertas críticas.</p>
                                ) : (
                                    alertasStock.slice(0, 6).map(p => (
                                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
                                            <div className="size-8 rounded bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600">
                                                <span className="material-symbols-outlined text-sm">inventory</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase truncate text-slate-800 dark:text-zinc-100">{p.nombre}</p>
                                                <p className="text-[9px] font-black text-red-600 dark:text-red-400">STOCK: {p.stock_actual} / MIN: {p.stock_minimo}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Quick Recent Sales */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg italic uppercase tracking-widest text-primary">Últimos Movimientos del Período</h3>
                                <Link to="/ventas" className="text-xs text-slate-400 hover:text-primary font-black uppercase tracking-widest">Historial</Link>
                            </div>
                            <div className="space-y-2">
                                {ventasRecientes.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-8 text-center uppercase tracking-widest">No hay ventas en este rango</p>
                                ) : (
                                    ventasRecientes.map(venta => (
                                        <div key={venta.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors border-l-4 border-l-primary/40 bg-slate-50/30">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-900 dark:text-zinc-100">ORD {venta.numero}</span>
                                                <span className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">{venta.cliente?.razon_social}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-900 dark:text-zinc-100">{formatCurrency(venta.total)}</p>
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${getStatusColor(venta.estado)}`}>
                                                    {venta.estado}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Dashboard;
