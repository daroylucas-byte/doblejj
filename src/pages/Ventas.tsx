import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';

interface Venta {
    id: string;
    numero: string;
    fecha: string;
    cliente: { razon_social: string };
    vendedor: { nombre: string; apellido: string };
    estado: 'presupuesto' | 'confirmada' | 'preparando' | 'lista' | 'entregada' | 'cancelada';
    total: number;
    tipo_comprobante: string;
}

interface Cliente {
    id: string;
    razon_social: string;
}

interface Vendedor {
    id: string;
    nombre: string;
    apellido: string;
}

const Ventas: React.FC = () => {
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [vendedores, setVendedores] = useState<Vendedor[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [clienteFilter, setClienteFilter] = useState('Todos');
    const [vendedorFilter, setVendedorFilter] = useState('Todos');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Clientes & Vendedores for filters
            const { data: clientsData } = await supabase.from('clientes').select('id, razon_social').order('razon_social');
            const { data: sellersData } = await supabase.from('profiles').select('id, nombre, apellido').order('nombre');
            setClientes(clientsData || []);
            setVendedores(sellersData || []);

            // Fetch Ventas
            let query = supabase
                .from('ventas')
                .select(`
                    id, numero, fecha, estado, total, tipo_comprobante,
                    cliente:cliente_id (razon_social),
                    vendedor:vendedor_id (nombre, apellido)
                `)
                .order('fecha', { ascending: false });

            if (statusFilter !== 'Todos') query = query.eq('estado', statusFilter.toLowerCase());
            if (clienteFilter !== 'Todos') query = query.eq('cliente_id', clienteFilter);
            if (vendedorFilter !== 'Todos') query = query.eq('vendedor_id', vendedorFilter);
            if (searchTerm) query = query.ilike('numero', `%${searchTerm}%`);

            const { data, error } = await query;
            if (error) throw error;
            setVentas(data as any[] || []);
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, clienteFilter, vendedorFilter, searchTerm]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            <MainHeader title="Gestión de Ventas">
                <Link
                    to="/ventas/nueva"
                    className="flex items-center justify-center gap-2 rounded-xl h-10 px-4 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Nueva Venta</span>
                </Link>
            </MainHeader>

            <div className="p-8 max-w-[1600px] mx-auto w-full space-y-6">

                {/* Filters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-all duration-300">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Buscar Orden</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-lg">search</span>
                            <input
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="Nro de comprobante..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cliente</label>
                        <select
                            className="bg-slate-50 dark:bg-zinc-800 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 cursor-pointer"
                            value={clienteFilter}
                            onChange={(e) => setClienteFilter(e.target.value)}
                        >
                            <option value="Todos">Todos los clientes</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Estado</label>
                        <select
                            className="bg-slate-50 dark:bg-zinc-800 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option>Todos</option>
                            <option>Presupuesto</option>
                            <option>Confirmada</option>
                            <option>Preparando</option>
                            <option>Lista</option>
                            <option>Entregada</option>
                            <option>Cancelada</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendedor</label>
                        <select
                            className="bg-slate-50 dark:bg-zinc-800 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 cursor-pointer"
                            value={vendedorFilter}
                            onChange={(e) => setVendedorFilter(e.target.value)}
                        >
                            <option value="Todos">Todos los vendedores</option>
                            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre} {v.apellido}</option>)}
                        </select>
                    </div>
                </div>

                {/* Sales Table Container */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-all duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Orden #</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Vendedor</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando órdenes...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : ventas.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block opacity-20">receipt_long</span>
                                            <p className="font-bold text-sm">No se encontraron ventas con estos filtros</p>
                                        </td>
                                    </tr>
                                ) : (
                                    ventas.map((v) => (
                                        <tr key={v.id} className="group hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                                            <td className="px-6 py-4 text-sm font-black text-primary">#{v.numero || 'S/N'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{new Date(v.fecha).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{v.cliente?.razon_social || 'N/A'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500 font-medium">{v.vendedor ? `${v.vendedor.nombre} ${v.vendedor.apellido}` : 'Sistema'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(v.estado)}`}>
                                                    {v.estado}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900 dark:text-white">$ {Number(v.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-all active:scale-90 group/btn">
                                                    <span className="material-symbols-outlined group-hover/btn:scale-110 transition-transform">visibility</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Placeholder */}
                    <div className="px-6 py-4 bg-slate-50/50 dark:bg-zinc-800/10 flex items-center justify-between border-t border-slate-100 dark:border-zinc-800">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Mostrando {ventas.length} registros</p>
                        <div className="flex items-center gap-1">
                            <button className="p-1 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-primary transition-colors disabled:opacity-50" disabled>
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <button className="size-8 rounded flex items-center justify-center bg-primary text-white text-[10px] font-black shadow-md shadow-primary/20">1</button>
                            <button className="p-1 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-primary transition-colors disabled:opacity-50" disabled>
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Ventas;
