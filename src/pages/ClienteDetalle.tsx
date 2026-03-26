import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';

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
    const [activeTab, setActiveTab] = useState<'movimientos' | 'compras' | 'stats'>('movimientos');

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            // 1. Fetch Cliente Data
            const { data: clienteData, error: clienteErr } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', id)
                .single();
            if (clienteErr) throw clienteErr;
            setCliente(clienteData);

            // 2. Fetch Purchase History
            const { data: ventasData } = await supabase
                .from('ventas')
                .select('id, numero, fecha, total, estado')
                .eq('cliente_id', id)
                .order('fecha', { ascending: false });
            setVentas(ventasData || []);

            // 3. Fetch Current Account Movements
            const { data: movsData } = await supabase
                .from('cuenta_corriente')
                .select('id, fecha, tipo, concepto, monto, saldo_acumulado')
                .eq('cliente_id', id)
                .order('created_at', { ascending: false });
            setMovimientos(movsData || []);

            // 4. Fetch Stats (Top Products)
            // We join ventas -> venta_items -> productos
            const { data: statsData } = await supabase
                .from('venta_items')
                .select(`
                    cantidad,
                    subtotal,
                    productos:producto_id (nombre),
                    ventas!inner (cliente_id)
                `)
                .eq('ventas.cliente_id', id);

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
        }
    }, [id]);

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
                                    style={{ width: `${Math.min(100, (Math.max(0, -cliente.saldo_actual) / cliente.limite_credito) * 100)}%` }}
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
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Actual</p>
                                <p className={`text-2xl font-black ${cliente.saldo_actual < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    $ {Math.abs(cliente.saldo_actual).toLocaleString()}
                                </p>
                                <span className="text-[10px] font-bold text-slate-400">{cliente.saldo_actual < 0 ? 'Adeuda' : 'A favor'}</span>
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
                                            <button className="h-8 px-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-primary/20 hover:scale-95 transition-all">Exportar PDF</button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-zinc-800">
                                                        <th className="py-3">Fecha</th>
                                                        <th className="py-3">Concepto</th>
                                                        <th className="py-3">Tipo</th>
                                                        <th className="py-3 text-right">Monto</th>
                                                        <th className="py-3 text-right">Saldo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                                                    {movimientos.map(m => (
                                                        <tr key={m.id} className="text-sm">
                                                            <td className="py-3 text-slate-500">{format(parseISO(m.fecha), 'dd/MM/yyyy')}</td>
                                                            <td className="py-3 font-bold">{m.concepto}</td>
                                                            <td className="py-3 capitalize">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${m.tipo === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {m.tipo.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            <td className={`py-3 text-right font-black ${m.tipo === 'pago' ? 'text-green-600' : 'text-slate-900 dark:text-white'}`}>
                                                                $ {m.monto.toLocaleString()}
                                                            </td>
                                                            <td className="py-3 text-right font-black text-primary/80">
                                                                $ {m.saldo_acumulado.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {movimientos.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="py-12 text-center text-slate-400 font-bold italic">No hay movimientos registrados</td>
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
                                                    <button className="p-2 text-slate-400 hover:text-primary transition-colors">
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
        </Layout>
    );
};

export default ClienteDetalle;
