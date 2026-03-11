import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import MainHeader from '../components/MainHeader';
import { supabase } from '../lib/supabase';

interface Venta {
    id: string;
    numero: string;
    fecha: string;
    cliente: { razon_social: string; cuit: string };
    vendedor: { nombre: string; apellido: string };
    estado: 'presupuesto' | 'confirmada' | 'preparando' | 'lista' | 'entregada' | 'cancelada';
    total: number;
    tipo_comprobante: string;
}

interface VentaItem {
    id: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    productos: { nombre: string; codigo: string } | null;
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

    // Modal state
    const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
    const [ventaItems, setVentaItems] = useState<VentaItem[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

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
                    cliente:cliente_id (razon_social, cuit),
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

    const handleOpenModal = async (venta: Venta) => {
        setSelectedVenta(venta);
        setShowModal(true);
        setItemsLoading(true);
        setVentaItems([]);

        try {
            const { data, error } = await supabase
                .from('venta_items')
                .select(`
                    id, 
                    cantidad, 
                    precio_unitario, 
                    subtotal,
                    productos:producto_id (
                        nombre, 
                        codigo
                    )
                `)
                .eq('venta_id', venta.id);

            if (error) throw error;
            setVentaItems(data as any[] || []);
        } catch (err) {
            console.error('Error fetching items:', err);
        } finally {
            setItemsLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedVenta(null);
        setVentaItems([]);
    };

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
                                                <button 
                                                    onClick={() => handleOpenModal(v)}
                                                    className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-all active:scale-90 group/btn"
                                                >
                                                    <span className="material-symbols-outlined group-hover/btn:scale-110 transition-transform">visibility</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Venta Detail Modal */}
            {showModal && selectedVenta && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-start bg-slate-50/50 dark:bg-zinc-800/30">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full">Comprobante de Venta</span>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(selectedVenta.estado)}`}>
                                        {selectedVenta.estado}
                                    </span>
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">ORDEN #{selectedVenta.numero}</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{new Date(selectedVenta.fecha).toLocaleString()}</p>
                            </div>
                            <button 
                                onClick={handleCloseModal}
                                className="size-12 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all active:scale-90"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            
                            {/* Client & Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 bg-slate-50 dark:bg-zinc-800/50 rounded-3xl border border-slate-100 dark:border-zinc-800">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Cliente</label>
                                    <p className="font-black text-slate-900 dark:text-white uppercase leading-tight">{selectedVenta.cliente?.razon_social}</p>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1">CUIT: {selectedVenta.cliente?.cuit || 'S/D'}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Vendedor</label>
                                    <p className="font-black text-slate-900 dark:text-white uppercase leading-tight">
                                        {selectedVenta.vendedor ? `${selectedVenta.vendedor.nombre} ${selectedVenta.vendedor.apellido}` : 'Sistema'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Tipo de Comprobante</label>
                                    <p className="font-black text-primary uppercase leading-tight">{selectedVenta.tipo_comprobante || 'PRESUPUESTO'}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-4 ml-2">Detalle de Productos</h3>
                                <div className="rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden min-h-[100px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 dark:bg-zinc-800/80">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Producto</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Cant.</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Unitario</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                            {itemsLoading ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="size-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest">Cargando ítems...</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : ventaItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                                        No se encontraron productos para esta venta.
                                                    </td>
                                                </tr>
                                            ) : (
                                                ventaItems.map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                                                        <td className="px-6 py-4">
                                                            <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-none">{item.productos?.nombre || 'Producto Desconocido'}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">COD: {item.productos?.codigo || 'N/A'}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-black text-slate-600 dark:text-zinc-400">{item.cantidad}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">$ {Number(item.precio_unitario).toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-right font-black text-primary">$ {Number(item.subtotal).toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex justify-between items-center">
                            <button className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-primary hover:border-primary/20 transition-all active:scale-95">
                                <span className="material-symbols-outlined text-lg">print</span>
                                Imprimir Comprobante
                            </button>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total de la Orden</p>
                                <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">$ {Number(selectedVenta.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Ventas;
