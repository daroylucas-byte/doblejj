import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';

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
    numero_factura: string;
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
    const [activeTab, setActiveTab] = useState<'movimientos' | 'compras' | 'stats'>('movimientos');

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
                .select('id, numero_factura, fecha, total, estado')
                .eq('proveedor_id', id)
                .order('fecha', { ascending: false });
            setCompras(purchasesData || []);

            // 3. Fetch Current Account Movements
            const { data: movsData } = await supabase
                .from('cuenta_corriente_proveedores')
                .select('id, fecha, tipo, concepto, monto, saldo_acumulado')
                .eq('proveedor_id', id)
                .order('created_at', { ascending: false });
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
                        <div className={`rounded-3xl p-6 text-white shadow-lg transition-all ${proveedor.saldo_actual < 0 ? 'bg-gradient-to-br from-red-600 to-red-800 shadow-red-500/20' : 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/20'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest opacity-80">Saldo en Cuenta Cte</h3>
                                <span className="material-symbols-outlined text-xl opacity-50">account_balance_wallet</span>
                            </div>
                            <div className="text-3xl font-black mb-2">$ {Math.abs(proveedor.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            <div className={`text-[10px] font-bold uppercase tracking-widest ${proveedor.saldo_actual < 0 ? 'text-red-100' : 'text-emerald-100'}`}>
                                {proveedor.saldo_actual < 0 ? 'Deuda a pagar' : 'A favor'}
                            </div>
                        </div>

                        {/* Credit Limit */}
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Límite de Crédito</h3>
                            <div className="text-xl font-black text-slate-900 dark:text-white">$ {proveedor.limite_credito.toLocaleString()}</div>
                            <div className="mt-4 w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-1000"
                                    style={{ width: `${Math.min((Math.abs(proveedor.saldo_actual) / (proveedor.limite_credito || 1)) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tight text-right">Utilizado: {Math.min(Math.round((Math.abs(proveedor.saldo_actual) / (proveedor.limite_credito || 1)) * 100), 100)}%</p>
                        </div>
                    </div>

                    {/* Right Side: Content */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Tabs Navigation */}
                        <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-zinc-800/50 rounded-2xl w-fit">
                            {[
                                { id: 'movimientos', label: 'Cuenta Corriente', icon: 'account_balance' },
                                { id: 'compras', label: 'Facturas/Compras', icon: 'receipt_long' },
                                { id: 'stats', label: 'Estadísticas', icon: 'bar_chart' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                        ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm scale-105'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm min-h-[500px] transition-all">
                            {activeTab === 'movimientos' ? (
                                <div className="p-0 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Concepto</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Monto</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Saldo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                            {movimientos.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                        <span className="material-symbols-outlined text-4xl mb-2 block opacity-20">history</span>
                                                        <p className="font-bold text-sm">Sin movimientos registrados</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                movimientos.map(m => (
                                                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                                        <td className="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">{new Date(m.fecha).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`material-symbols-outlined text-base ${m.tipo === 'pago' ? 'text-emerald-500' : 'text-red-500'
                                                                    }`}>{m.tipo === 'pago' ? 'payments' : 'receipt_long'}</span>
                                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">{m.concepto}</span>
                                                            </div>
                                                        </td>
                                                        <td className={`px-6 py-4 text-right text-sm font-black ${m.monto < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                            {m.monto > 0 ? '+' : ''} $ {m.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-sm font-black text-slate-900 dark:text-white">
                                                            $ {m.saldo_acumulado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : activeTab === 'compras' ? (
                                <div className="p-0 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nro Factura</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                            {compras.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                        <span className="material-symbols-outlined text-4xl mb-2 block opacity-20">receipt</span>
                                                        <p className="font-bold text-sm">No hay compras registradas</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                compras.map(c => (
                                                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                                                        <td className="px-6 py-4">
                                                            <div className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">#{c.numero_factura || 'S/N'}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(c.fecha).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${c.estado === 'recibida' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                                : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                                                                }`}>
                                                                {c.estado}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-sm font-black text-slate-900 dark:text-white">
                                                            $ {c.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 space-y-8">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-6">Productos más comprados</h4>
                                        <div className="space-y-4">
                                            {topProductos.length === 0 ? (
                                                <p className="text-sm text-slate-400 font-bold italic">Sin estadísticas suficientes para este proveedor.</p>
                                            ) : (
                                                topProductos.map((p, i) => (
                                                    <div key={i} className="flex items-center gap-4 bg-slate-50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
                                                        <div className="size-10 rounded-xl bg-primary text-white flex items-center justify-center font-black">{i + 1}</div>
                                                        <div className="flex-1">
                                                            <div className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none mb-1">{p.producto_nombre}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cantidad total: {p.cantidad_total} unidades</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-black text-primary">$ {p.total_compras.toLocaleString()}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Volumen Compra</div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    <div className="pt-8 border-t border-slate-100 dark:border-zinc-800">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 dark:bg-zinc-800/20 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Frecuencia Compras</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">0.0</p>
                                                <p className="text-[10px] text-slate-500 font-bold mt-1">Órdenes / Mes</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-zinc-800/20 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ticket Promedio</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">$ 0,00</p>
                                                <p className="text-[10px] text-slate-500 font-bold mt-1">Por Transacción</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ProveedorDetalle;
